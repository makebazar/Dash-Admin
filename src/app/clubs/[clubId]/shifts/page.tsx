"use client"

import { useEffect, useState, useMemo, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Clock, DollarSign, FileText, TrendingUp, Wallet, Edit, CheckCircle, CalendarDays, Sun, Moon, Trash2, ArrowUpDown, ChevronRight, RefreshCw, AlertTriangle } from "lucide-react"
import { ShiftExcelImport } from "@/components/payroll/ShiftExcelImport"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"

const DATE_MASK_TEMPLATE = "__.__.____"
const DATE_EDITABLE_POSITIONS = [0, 1, 3, 4, 6, 7, 8, 9] as const
const DATE_COMPLETE_REGEX = /^(\d{2})\.(\d{2})\.(\d{4})$/

const buildMaskedDateDisplay = (digits: string[]) => {
    const chars = DATE_MASK_TEMPLATE.split("")
    let hasAnyDigits = false

    DATE_EDITABLE_POSITIONS.forEach((pos, index) => {
        const digit = digits[index] && /\d/.test(digits[index]) ? digits[index] : "_"
        if (digit !== "_") hasAnyDigits = true
        chars[pos] = digit
    })

    return hasAnyDigits ? chars.join("") : ""
}

const extractMaskedDateDigits = (display: string) =>
    DATE_EDITABLE_POSITIONS.map((pos) => {
        const char = display[pos] || "_"
        return /\d/.test(char) ? char : "_"
    })

const dateToInternal = (displayStr: string) => {
    const match = displayStr.match(DATE_COMPLETE_REGEX)
    if (!match) return ""

    const [, dd, mm, yyyy] = match
    const day = Number(dd)
    const month = Number(mm)
    const year = Number(yyyy)

    if (month < 1 || month > 12 || day < 1) return ""

    const parsed = new Date(`${yyyy}-${mm}-${dd}T00:00:00`)
    if (Number.isNaN(parsed.getTime())) return ""
    if (
        parsed.getFullYear() !== year ||
        parsed.getMonth() + 1 !== month ||
        parsed.getDate() !== day
    ) {
        return ""
    }

    return `${yyyy}-${mm}-${dd}`
}

const dateToDisplay = (internalStr: string) => {
    if (!internalStr) return ''
    const parts = internalStr.split('-')
    if (parts.length !== 3) return ''
    const [y, m, d] = parts
    return `${d}.${m}.${y}`
}

type MaskedDateInputProps = Omit<React.ComponentProps<typeof Input>, "value" | "onChange"> & {
    value: string
    onValueChange: (displayValue: string, internalValue: string) => void
}

function MaskedDateInput({ value, onValueChange, className, placeholder = "ДД.ММ.ГГГГ", ...props }: MaskedDateInputProps) {
    const inputRef = useRef<HTMLInputElement>(null)

    const setCaretToSlot = useCallback((slot: number) => {
        const safeSlot = Math.max(0, Math.min(slot, DATE_EDITABLE_POSITIONS.length - 1))
        const caretPos = DATE_EDITABLE_POSITIONS[safeSlot]
        requestAnimationFrame(() => {
            inputRef.current?.setSelectionRange(caretPos, caretPos)
        })
    }, [])

    const setCaretToPosition = useCallback((position: number) => {
        requestAnimationFrame(() => {
            inputRef.current?.setSelectionRange(position, position)
        })
    }, [])

    const findSlotAtOrAfter = useCallback((position: number) => {
        return DATE_EDITABLE_POSITIONS.findIndex((pos) => pos >= position)
    }, [])

    const findSlotAtOrBefore = useCallback((position: number) => {
        for (let i = DATE_EDITABLE_POSITIONS.length - 1; i >= 0; i -= 1) {
            if (DATE_EDITABLE_POSITIONS[i] <= position) return i
        }
        return -1
    }, [])

    const commitDigits = useCallback((digits: string[], nextCaretSlot?: number) => {
        const nextDisplay = buildMaskedDateDisplay(digits)
        onValueChange(nextDisplay, dateToInternal(nextDisplay))
        if (typeof nextCaretSlot === "number") {
            setCaretToSlot(nextCaretSlot)
        }
    }, [onValueChange, setCaretToSlot])

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        const currentValue = value || ""
        const digits = extractMaskedDateDigits(currentValue)
        const selectionStart = e.currentTarget.selectionStart ?? 0

        if (/^\d$/.test(e.key)) {
            e.preventDefault()
            const slot = findSlotAtOrAfter(selectionStart)
            if (slot === -1) return
            digits[slot] = e.key
            commitDigits(digits, Math.min(slot + 1, DATE_EDITABLE_POSITIONS.length - 1))
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
            if (slot === -1) {
                setCaretToPosition(0)
            } else {
                setCaretToSlot(slot)
            }
            return
        }

        if (e.key === "ArrowRight") {
            e.preventDefault()
            const slot = findSlotAtOrAfter(selectionStart + 1)
            if (slot === -1) {
                setCaretToPosition(DATE_MASK_TEMPLATE.length)
            } else {
                setCaretToSlot(slot)
            }
            return
        }

        if (e.key === "Home") {
            e.preventDefault()
            setCaretToPosition(0)
            return
        }

        if (e.key === "End") {
            e.preventDefault()
            setCaretToPosition(DATE_MASK_TEMPLATE.length)
        }
    }, [commitDigits, findSlotAtOrAfter, findSlotAtOrBefore, setCaretToPosition, setCaretToSlot, value])

    const handlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault()
        const pastedDigits = e.clipboardData.getData("text").replace(/\D/g, "")
        if (!pastedDigits) return

        const digits = extractMaskedDateDigits(value || "")
        const selectionStart = e.currentTarget.selectionStart ?? 0
        let slot = findSlotAtOrAfter(selectionStart)
        if (slot === -1) slot = 0

        for (const digit of pastedDigits) {
            if (slot >= digits.length) break
            digits[slot] = digit
            slot += 1
        }

        commitDigits(digits, Math.min(slot, DATE_EDITABLE_POSITIONS.length - 1))
    }, [commitDigits, findSlotAtOrAfter, value])

    const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
        if (!e.currentTarget.value) {
            setCaretToPosition(0)
        }
    }, [setCaretToPosition])

    return (
        <Input
            {...props}
            ref={inputRef}
            value={value}
            onChange={() => {}}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onFocus={handleFocus}
            inputMode="numeric"
            autoComplete="off"
            placeholder={placeholder}
            className={className}
        />
    )
}

const DATE_TIME_MASK_TEMPLATE = "__.__.____, __:__"
const DATE_TIME_EDITABLE_POSITIONS = [0, 1, 3, 4, 6, 7, 8, 9, 12, 13, 15, 16] as const
const DATE_TIME_COMPLETE_REGEX = /^(\d{2})\.(\d{2})\.(\d{4}), (\d{2}):(\d{2})$/

const buildMaskedDateTimeDisplay = (digits: string[]) => {
    const chars = DATE_TIME_MASK_TEMPLATE.split("")
    let hasAnyDigits = false

    DATE_TIME_EDITABLE_POSITIONS.forEach((pos, index) => {
        const digit = digits[index] && /\d/.test(digits[index]) ? digits[index] : "_"
        if (digit !== "_") hasAnyDigits = true
        chars[pos] = digit
    })

    return hasAnyDigits ? chars.join("") : ""
}

const extractMaskedDateTimeDigits = (display: string) =>
    DATE_TIME_EDITABLE_POSITIONS.map((pos) => {
        const char = display[pos] || "_"
        return /\d/.test(char) ? char : "_"
    })

const displayToLocalDateTime = (display: string) => {
    const match = display.match(DATE_TIME_COMPLETE_REGEX)
    if (!match) return ""

    const [, dd, mm, yyyy, hh, min] = match
    const day = Number(dd)
    const month = Number(mm)
    const year = Number(yyyy)
    const hours = Number(hh)
    const minutes = Number(min)

    if (month < 1 || month > 12 || day < 1 || hours > 23 || minutes > 59) return ""

    const parsed = new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:00`)
    if (Number.isNaN(parsed.getTime())) return ""
    if (
        parsed.getFullYear() !== year ||
        parsed.getMonth() + 1 !== month ||
        parsed.getDate() !== day ||
        parsed.getHours() !== hours ||
        parsed.getMinutes() !== minutes
    ) {
        return ""
    }

    return `${yyyy}-${mm}-${dd}T${hh}:${min}`
}

type MaskedDateTimeInputProps = Omit<React.ComponentProps<typeof Input>, "value" | "onChange"> & {
    value: string
    onValueChange: (displayValue: string, internalValue: string) => void
}

function MaskedDateTimeInput({ value, onValueChange, className, placeholder = "ДД.ММ.ГГГГ, ЧЧ:ММ", ...props }: MaskedDateTimeInputProps) {
    const inputRef = useRef<HTMLInputElement>(null)

    const setCaretToSlot = useCallback((slot: number) => {
        const safeSlot = Math.max(0, Math.min(slot, DATE_TIME_EDITABLE_POSITIONS.length - 1))
        const caretPos = DATE_TIME_EDITABLE_POSITIONS[safeSlot]
        requestAnimationFrame(() => {
            inputRef.current?.setSelectionRange(caretPos, caretPos)
        })
    }, [])

    const setCaretToPosition = useCallback((position: number) => {
        requestAnimationFrame(() => {
            inputRef.current?.setSelectionRange(position, position)
        })
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
            if (slot === -1) {
                setCaretToPosition(0)
            } else {
                setCaretToSlot(slot)
            }
            return
        }

        if (e.key === "ArrowRight") {
            e.preventDefault()
            const slot = findSlotAtOrAfter(selectionStart + 1)
            if (slot === -1) {
                setCaretToPosition(DATE_TIME_MASK_TEMPLATE.length)
            } else {
                setCaretToSlot(slot)
            }
            return
        }

        if (e.key === "Home") {
            e.preventDefault()
            setCaretToPosition(0)
            return
        }

        if (e.key === "End") {
            e.preventDefault()
            setCaretToPosition(DATE_TIME_MASK_TEMPLATE.length)
        }
    }, [commitDigits, findSlotAtOrAfter, findSlotAtOrBefore, setCaretToPosition, setCaretToSlot, value])

    const handlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault()
        const pastedDigits = e.clipboardData.getData("text").replace(/\D/g, "")
        if (!pastedDigits) return

        const digits = extractMaskedDateTimeDigits(value || "")
        const selectionStart = e.currentTarget.selectionStart ?? 0
        let slot = findSlotAtOrAfter(selectionStart)
        if (slot === -1) slot = 0

        for (const digit of pastedDigits) {
            if (slot >= digits.length) break
            digits[slot] = digit
            slot += 1
        }

        commitDigits(digits, Math.min(slot, DATE_TIME_EDITABLE_POSITIONS.length - 1))
    }, [commitDigits, findSlotAtOrAfter, value])

    const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
        if (!e.currentTarget.value) {
            setCaretToPosition(0)
        }
    }, [setCaretToPosition])

    return (
        <Input
            {...props}
            ref={inputRef}
            value={value}
            onChange={() => {}}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onFocus={handleFocus}
            inputMode="numeric"
            autoComplete="off"
            placeholder={placeholder}
            className={className}
        />
    )
}

interface Shift {
    id: string
    user_id: string
    employee_name: string
    check_in: string
    check_out: string | null
    total_hours: number
    cash_income: number
    card_income: number
    expenses: number
    report_comment: string
    report_data: Record<string, any>
    report_mode?: 'FULL_REPORT' | 'NO_REPORT'
    actor_role_name_snapshot?: string | null
    status: string
    shift_type: 'DAY' | 'NIGHT'
    has_owner_corrections?: boolean
    owner_notes?: string
}

interface ShiftDetails {
    shift: Shift
    checklists: any[]
    transactions: any[]
    inventory_checks: any[]
    maintenance_tasks: any[]
    product_sales?: any[]
    inventory_discrepancies?: any[]
    metric_labels?: Record<string, string>
}

export default function ShiftsPage({ params }: { params: Promise<{ clubId: string }> }) {
    const router = useRouter()
    const [clubId, setClubId] = useState('')
    const [shifts, setShifts] = useState<Shift[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [selectedShift, setSelectedShift] = useState<Shift | null>(null)
    const [selectedShiftDetails] = useState<ShiftDetails | null>(null)
    const [isLoadingDetails] = useState(false)
    const [editingShift, setEditingShift] = useState<Shift | null>(null)
    const [isSaving, setIsSaving] = useState(false)

    // Edit form state
    const [editCashIncome, setEditCashIncome] = useState('')
    const [editCardIncome, setEditCardIncome] = useState('')
    const [editExpenses, setEditExpenses] = useState('')
    const [editComment, setEditComment] = useState('')
    const [editCheckIn, setEditCheckIn] = useState('')
    const [editCheckOut, setEditCheckOut] = useState('')
    const [editCheckInDisplay, setEditCheckInDisplay] = useState('')
    const [editCheckOutDisplay, setEditCheckOutDisplay] = useState('')
    const [editCustomFields, setEditCustomFields] = useState<Record<string, any>>({})
    const [editOwnerNotes, setEditOwnerNotes] = useState('')
    const [clubTimezone, setClubTimezone] = useState('Europe/Moscow')

    // Create shift modal state
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [employees, setEmployees] = useState<{ id: string, full_name: string }[]>([])
    const [newShiftEmployee, setNewShiftEmployee] = useState('')
    const [newShiftCheckIn, setNewShiftCheckIn] = useState('')
    const [newShiftCheckOut, setNewShiftCheckOut] = useState('')
    const [newShiftCheckInDisplay, setNewShiftCheckInDisplay] = useState('')
    const [newShiftCheckOutDisplay, setNewShiftCheckOutDisplay] = useState('')
    const [newShiftCashIncome, setNewShiftCashIncome] = useState('')
    const [newShiftCardIncome, setNewShiftCardIncome] = useState('')
    const [newShiftExpenses, setNewShiftExpenses] = useState('')
    const [newShiftComment, setNewShiftComment] = useState('')
    const [newShiftCustomFields, setNewShiftCustomFields] = useState<Record<string, any>>({})
    const [isCreating, setIsCreating] = useState(false)

    // Date filter state
    const [filterStartDate, setFilterStartDate] = useState('')
    const [filterEndDate, setFilterEndDate] = useState('')
    const [filterStartDateDisplay, setFilterStartDateDisplay] = useState('')
    const [filterEndDateDisplay, setFilterEndDateDisplay] = useState('')
    const [filterEmployee, setFilterEmployee] = useState('')
    const [selectedMonth, setSelectedMonth] = useState<string>('0')
    const [editShiftType, setEditShiftType] = useState<'DAY' | 'NIGHT'>('DAY')

    const [reportFields, setReportFields] = useState<any[]>([])
    const [lastRevenue, setLastRevenue] = useState<number | null>(null)

    // Sort state
    const [sortBy, setSortBy] = useState<string>('check_in')
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
    
    // Inventory expansion state
    const [expandedInventories, setExpandedInventories] = useState<Record<string, boolean>>({})

    // Abort controller ref for fetching shifts
    const fetchAbortController = useRef<AbortController | null>(null)

    const calculateShiftTotalIncome = useCallback((shift: Shift) => {
        const cash = getMetricValue(shift, 'cash_income')
        const card = getMetricValue(shift, 'card_income')
        const customIncome = reportFields
            .filter(f => f.field_type === 'INCOME')
            .reduce((sum, f) => sum + getMetricValue(shift, f.metric_key), 0)
        return cash + card + customIncome
    }, [reportFields])

    useEffect(() => {
        params.then(p => {
            setClubId(p.clubId)
            fetchClubSettings(p.clubId)
            fetchReportTemplate(p.clubId)
            fetchEmployees(p.clubId)
        })
    }, [params])

    const fetchReportTemplate = async (id: string) => {
        try {
            const res = await fetch(`/api/clubs/${id}/settings/reports`)
            const data = await res.json()
            if (res.ok && data.currentTemplate) {
                const standardKeys = ['cash_income', 'card_income', 'expenses_cash', 'shift_comment', 'expenses']
                const customFields = data.currentTemplate.schema.filter((f: any) =>
                    !standardKeys.includes(f.metric_key) &&
                    !standardKeys.some(k => f.metric_key.includes(k))
                )
                setReportFields(customFields)
            }
        } catch (error) {
            console.error('Error fetching report template:', error)
        }
    }

    const fetchClubSettings = async (id: string) => {
        try {
            const res = await fetch(`/api/clubs/${id}/settings`)
            const data = await res.json()
            if (res.ok && data.club?.timezone) {
                setClubTimezone(data.club.timezone)
            }
        } catch (error) {
            console.error('Error fetching club settings:', error)
        }
    }

    const fetchEmployees = async (id: string) => {
        try {
            const res = await fetch(`/api/clubs/${id}/employees`)
            const data = await res.json()
            if (res.ok && Array.isArray(data.employees)) {
                setEmployees(data.employees.map((e: any) => ({ id: e.id, full_name: e.full_name })))
            }
        } catch (error) {
            console.error('Error fetching employees:', error)
        }
    }

    const fetchShifts = useCallback(async (id: string, startDate?: string, endDate?: string) => {
        if (fetchAbortController.current) {
            fetchAbortController.current.abort()
        }
        fetchAbortController.current = new AbortController()

        setIsLoading(true)
        try {
            let url = `/api/clubs/${id}/shifts`
            const params = new URLSearchParams()
            if (startDate) params.append('startDate', startDate)
            if (endDate) params.append('endDate', endDate)
            if (params.toString()) url += '?' + params.toString()

            const res = await fetch(url, { signal: fetchAbortController.current.signal })
            const data = await res.json()
            if (res.ok) {
                const newShifts = Array.isArray(data.shifts) ? data.shifts : []
                setShifts(newShifts)

                // Logging mechanism for revenue jumps
                // Note: using local calculation here to avoid stale closures if we used calculateShiftTotalIncome
                const currentCash = newShifts.reduce((sum: number, s: Shift) => sum + (parseFloat(String(s.cash_income)) || 0), 0)
                const currentCard = newShifts.reduce((sum: number, s: Shift) => sum + (parseFloat(String(s.card_income)) || 0), 0)
                // We can't easily access current reportFields here without dependency, so we skip the detailed custom income check for the log warning
                // to avoid adding reportFields to useCallback dependency (which would trigger refetch on template load)
                
                const currentTotalRevenue = currentCash + currentCard
                if (lastRevenue !== null && Math.abs(currentTotalRevenue - lastRevenue) > 100000) {
                    console.warn(`[Metrics] Significant revenue jump detected`)
                }
                setLastRevenue(currentTotalRevenue)
            }
        } catch (error: any) {
            if (error.name !== 'AbortError') {
                console.error('Error fetching shifts:', error)
            }
        } finally {
            // Only turn off loading if this wasn't aborted
            if (fetchAbortController.current && !fetchAbortController.current.signal.aborted) {
                setIsLoading(false)
            }
        }
    }, [lastRevenue])

    const handleMonthSelect = useCallback((monthOffset: number) => {
        const now = new Date()
        const target = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)
        const year = target.getFullYear()
        const monthIndex = target.getMonth()
        const pad = (n: number) => String(n).padStart(2, '0')
        const startStr = `${year}-${pad(monthIndex + 1)}-01`
        const lastDay = new Date(year, monthIndex + 1, 0).getDate()
        const endStr = `${year}-${pad(monthIndex + 1)}-${pad(lastDay)}`

        console.log(`[Calendar] Selecting month offset: ${monthOffset}, Range: ${startStr} to ${endStr}`)

        setSelectedMonth(String(monthOffset))
        setFilterStartDate(startStr)
        setFilterEndDate(endStr)
        setFilterStartDateDisplay(dateToDisplay(startStr))
        setFilterEndDateDisplay(dateToDisplay(endStr))
        
        setSortBy('check_in')
        setSortOrder('desc')
        
        if (clubId) {
            fetchShifts(clubId, startStr, endStr)
        }
    }, [clubId, fetchShifts])

    // Initial load
    useEffect(() => {
        if (clubId && !filterStartDate && !filterEndDate) {
            handleMonthSelect(0)
        }
    }, [clubId, handleMonthSelect, filterStartDate, filterEndDate])

    const handleCustomDateFilter = () => {
        if (filterStartDate || filterEndDate) {
            console.log(`[Filters] Applying custom date filter: ${filterStartDate} to ${filterEndDate}`)
            setSelectedMonth('')
            fetchShifts(clubId, filterStartDate, filterEndDate)
        } else {
            console.warn(`[Filters] Attempted to apply custom filter with empty dates`)
            clearFilters()
        }
    }

    const clearFilters = () => {
        console.log(`[Filters] Clearing filters and resetting to current month`)
        setSelectedMonth('0')
        handleMonthSelect(0)
    }

    // Convert datetime-local value (User's Wall Clock in Club TZ) to UTC ISO string
    const convertToClubTimezone = useCallback((datetimeLocal: string) => {
        if (!datetimeLocal) return undefined
        
        // 1. Parse input as if it's in the browser's local timezone
        const localDate = new Date(datetimeLocal) 
        
        // 2. Determine what time this localDate would be if interpreted in the Club's TZ
        //    (We use 'en-US' to ensure consistent format, but 'timeZone: clubTimezone' is the key)
        const inClubTZString = localDate.toLocaleString('en-US', { timeZone: clubTimezone })
        const inClubTZ = new Date(inClubTZString)
        
        // 3. Calculate the offset: (Club Wall Clock Time) - (Browser Local Time)
        //    This effectively captures the difference in offsets.
        const offset = inClubTZ.getTime() - localDate.getTime()
        
        // 4. Apply the inverse offset to the original localDate timestamp to get the correct UTC
        const correctUTC = new Date(localDate.getTime() - offset)
        
        return correctUTC.toISOString()
    }, [clubTimezone])

    const validateTimes = (start: string, end: string) => {
        if (start && end) {
            if (new Date(start) > new Date(end)) {
                alert('Время начала не может быть позже времени окончания')
                return false
            }
        }
        return true
    }

    const handleSaveEdit = async () => {
        if (!editingShift) return
        if (editCheckInDisplay && !editCheckIn) {
            alert('Заполните дату начала полностью и корректно')
            return
        }
        if (editCheckOutDisplay && !editCheckOut) {
            alert('Заполните дату окончания полностью и корректно')
            return
        }
        
        if (!validateTimes(editCheckIn, editCheckOut)) return

        setIsSaving(true)

        // Calculate total hours if both times are set
        let totalHours: number | undefined = undefined
        if (editCheckIn && editCheckOut) {
            const start = new Date(editCheckIn)
            const end = new Date(editCheckOut)
            totalHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
            if (totalHours < 0) totalHours = 0
        }

        try {
            const updatedReportData = { ...editingShift.report_data, ...editCustomFields }

            const res = await fetch(`/api/clubs/${clubId}/shifts/${editingShift.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
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
                    report_data: updatedReportData
                })
            })

            if (res.ok) {
                setEditingShift(null)
                fetchShifts(clubId, filterStartDate, filterEndDate)
            } else {
                const data = await res.json()
                alert(data.error || 'Ошибка сохранения')
            }
        } catch (error) {
            console.error('Error:', error)
            alert('Ошибка сохранения')
        } finally {
            setIsSaving(false)
        }
    }

    const handleDeleteShift = async () => {
        if (!editingShift) return

        if (!confirm('Вы уверены, что хотите удалить эту смену? Это действие нельзя отменить.')) {
            return
        }

        setIsSaving(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/shifts/${editingShift.id}`, {
                method: 'DELETE'
            })

            if (res.ok) {
                setEditingShift(null)
                fetchShifts(clubId, filterStartDate, filterEndDate)
            } else {
                const data = await res.json()
                alert(data.error || 'Ошибка удаления')
            }
        } catch (error) {
            console.error('Error:', error)
            alert('Ошибка удаления')
        } finally {
            setIsSaving(false)
        }
    }

    const openCreateModal = () => {
        setNewShiftEmployee('')
        setNewShiftCheckIn('')
        setNewShiftCheckOut('')
        setNewShiftCheckInDisplay('')
        setNewShiftCheckOutDisplay('')
        setNewShiftCashIncome('')
        setNewShiftCardIncome('')
        setNewShiftExpenses('')
        setNewShiftComment('')
        setNewShiftCustomFields({})
        setIsCreateModalOpen(true)
    }

    const handleCreateShift = async () => {
        if (!newShiftEmployee || !newShiftCheckIn) {
            alert('Выберите сотрудника и укажите время начала')
            return
        }
        if (newShiftCheckInDisplay && !newShiftCheckIn) {
            alert('Заполните дату начала полностью и корректно')
            return
        }
        if (newShiftCheckOutDisplay && !newShiftCheckOut) {
            alert('Заполните дату окончания полностью и корректно')
            return
        }
        
        if (!validateTimes(newShiftCheckIn, newShiftCheckOut)) return

        setIsCreating(true)

        // Calculate total hours
        let totalHours: number | undefined = undefined
        if (newShiftCheckIn && newShiftCheckOut) {
            const start = new Date(newShiftCheckIn)
            const end = new Date(newShiftCheckOut)
            totalHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
            if (totalHours < 0) totalHours = 0
        }

        try {
            const res = await fetch(`/api/clubs/${clubId}/shifts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    employee_id: newShiftEmployee,
                    check_in: convertToClubTimezone(newShiftCheckIn),
                    check_out: convertToClubTimezone(newShiftCheckOut),
                    cash_income: parseFloat(newShiftCashIncome) || 0,
                    card_income: parseFloat(newShiftCardIncome) || 0,
                    expenses: parseFloat(newShiftExpenses) || 0,
                    report_comment: newShiftComment,
                    total_hours: totalHours,
                    report_data: newShiftCustomFields
                })
            })

            if (res.ok) {
                setIsCreateModalOpen(false)
                console.log(`[Create] Shift created, refreshing current month data`)
                // Refresh list using current filter settings
                fetchShifts(clubId, filterStartDate, filterEndDate)
            } else {
                const data = await res.json()
                alert(data.error || 'Ошибка создания смены')
            }
        } catch (error) {
            console.error('Error:', error)
            alert('Ошибка создания смены')
        } finally {
            setIsCreating(false)
        }
    }

    const formatDate = useCallback((dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('ru-RU', {
            weekday: 'short',
            day: '2-digit',
            month: '2-digit',
            timeZone: clubTimezone
        })
    }, [clubTimezone])

    const isWeekendDate = useCallback((dateStr: string) => {
        const weekday = new Intl.DateTimeFormat('en-US', {
            weekday: 'short',
            timeZone: clubTimezone
        }).format(new Date(dateStr))

        return weekday === 'Sat' || weekday === 'Sun'
    }, [clubTimezone])

    const formatTime = useCallback((dateStr: string) => {
        return new Date(dateStr).toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: clubTimezone
        })
    }, [clubTimezone])

    // Robust metric calculation for UI cards and table
    const getMetricValue = useCallback((shift: Shift | null, field: string) => {
        if (!shift) return 0;
        
        // If it's one of the main system fields
        if (field === 'expenses' || field === 'cash_income' || field === 'card_income') {
            // Mapping for report_data keys
            const keyMap: Record<string, string> = {
                'expenses': 'expenses_cash',
                'cash_income': 'cash_income',
                'card_income': 'card_income'
            };
            
            const reportKey = keyMap[field];
            const reportVal = shift.report_data?.[reportKey];
            
            if (reportVal !== undefined) {
                if (Array.isArray(reportVal)) {
                    return reportVal.reduce((sum, item: any) => sum + (Number(item.amount) || 0), 0);
                }
                return parseFloat(String(reportVal)) || 0;
            }
            
            // Fallback to the main column value if not in report_data
            return Number((shift as any)[field]) || 0;
        }

        // For custom report fields
        const val = shift.report_data?.[field];
        if (Array.isArray(val)) {
            return val.reduce((sum, item: any) => sum + (Number(item.amount) || 0), 0);
        }
        return parseFloat(String(val)) || 0;
    }, []);

    const formatMoney = useCallback((amount: number | string | any[] | null) => {
        if (amount === null || amount === undefined) return '0\u00A0₽'
        
        let num: number;
        if (Array.isArray(amount)) {
            num = amount.reduce((sum, item: any) => sum + (Number(item.amount) || 0), 0);
        } else {
            num = typeof amount === 'string' ? parseFloat(amount) : Number(amount)
        }
        
        if (isNaN(num) || num === 0) return '0\u00A0₽'
        return num.toLocaleString('ru-RU', { maximumFractionDigits: 0 }).replace(/\s/g, '\u00A0') + '\u00A0₽'
    }, []);

    const getStatusBadge = (shift: Shift) => {
        if (!shift.check_out) {
            return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Активна</Badge>
        }
        if (shift.status === 'VERIFIED') {
            if (shift.has_owner_corrections) {
                return (
                    <Badge
                        className="bg-orange-500/10 text-orange-500 border-orange-500/20"
                        aria-label="Подтверждена, есть правки"
                        title="Подтверждена, есть правки"
                    >
                        <AlertTriangle className="mr-1 h-3.5 w-3.5" />
                        Подтверждена
                    </Badge>
                )
            }
            return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">✓ Подтверждена</Badge>
        }
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">Закрыта</Badge>
    }

    const hasShiftReport = useCallback((shift: Shift) => {
        if (shift.report_comment?.trim()) return true
        return Boolean(shift.report_data && Object.keys(shift.report_data).length > 0)
    }, [])

    const reportEmployees = useMemo(() => {
        const uniqueEmployees = new Map<string, string>()

        shifts.forEach((shift) => {
            if (!shift.user_id || !shift.employee_name) return
            if (!uniqueEmployees.has(shift.user_id)) {
                uniqueEmployees.set(shift.user_id, shift.employee_name)
            }
        })

        return Array.from(uniqueEmployees.entries())
            .map(([id, full_name]) => ({ id, full_name }))
            .sort((a, b) => a.full_name.localeCompare(b.full_name, 'ru'))
    }, [shifts])

    // Filter shifts based on employee
    const filteredShifts = useMemo(() => {
        return shifts.filter(shift => {
            if (!filterEmployee) return true
            return shift.user_id === filterEmployee
        })
    }, [shifts, filterEmployee])

    // Sort filtered shifts
    const sortedShifts = useMemo(() => {
        return [...filteredShifts].sort((a, b) => {
            let aVal: any = a[sortBy as keyof Shift]
            let bVal: any = b[sortBy as keyof Shift]

            // Handle null/undefined
            if (aVal === null || aVal === undefined) return 1
            if (bVal === null || bVal === undefined) return -1

            // Use getMetricValue for consistent sorting of numeric columns
            if (['cash_income', 'card_income', 'expenses'].includes(sortBy)) {
                aVal = getMetricValue(a, sortBy);
                bVal = getMetricValue(b, sortBy);
            } else if (sortBy === 'total_hours') {
                aVal = parseFloat(String(aVal)) || 0
                bVal = parseFloat(String(bVal)) || 0
            }

            if (sortBy === 'total_income') {
                aVal = calculateShiftTotalIncome(a)
                bVal = calculateShiftTotalIncome(b)
            }

            // Convert to dates for date columns
            if (sortBy === 'check_in') {
                aVal = new Date(aVal).getTime()
                bVal = new Date(bVal).getTime()
            }

            // String comparison for employee name
            if (sortBy === 'employee_name') {
                aVal = String(aVal).toLowerCase()
                bVal = String(bVal).toLowerCase()
            }

            if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
            if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
            return 0
        })
    }, [filteredShifts, sortBy, sortOrder, calculateShiftTotalIncome])

    // Calculate totals based on filtered shifts
    const totals = useMemo(() => {
        const currentDisplayShifts = filteredShifts
        const totalCash = currentDisplayShifts.reduce((sum, s) => sum + getMetricValue(s, 'cash_income'), 0)
        const totalCard = currentDisplayShifts.reduce((sum, s) => sum + getMetricValue(s, 'card_income'), 0)
        const totalExpensesCore = currentDisplayShifts.reduce((sum, s) => sum + getMetricValue(s, 'expenses'), 0)
        
        return { totalCash, totalCard, totalExpensesCore }
    }, [filteredShifts, getMetricValue])

    // Calculate income and expenses from custom fields
    const customFieldTotals = useMemo(() => {
        return reportFields.map(field => {
            const total = filteredShifts.reduce((sum, s) => {
                // Use getMetricValue for consistent calculation
                return sum + getMetricValue(s, field.metric_key)
            }, 0)
            return { ...field, total }
        })
    }, [filteredShifts, reportFields, getMetricValue])

    const totalCustomIncome = useMemo(() => 
        customFieldTotals
            .filter(f => f.field_type === 'INCOME')
            .reduce((sum, f) => sum + f.total, 0),
    [customFieldTotals])

    const totalCustomExpenses = useMemo(() => 
        customFieldTotals
            .filter(f => f.field_type === 'EXPENSE' || f.field_type === 'EXPENSE_LIST')
            .reduce((sum, f) => sum + f.total, 0),
    [customFieldTotals])

    const totalRevenue = totals.totalCash + totals.totalCard + totalCustomIncome
    const totalExpenses = totals.totalExpensesCore + totalCustomExpenses

    if (isLoading && shifts.length === 0) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    const handleSort = (column: string) => {
        if (sortBy === column) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
        } else {
            setSortBy(column)
            setSortOrder('desc')
        }
    }

    return (
        <div className="flex min-h-screen bg-[#FAFAFA] flex-col font-sans text-slate-900 selection:bg-black/10">
            <main className="mx-auto max-w-6xl w-full flex-1 px-6 sm:px-8 py-12 md:py-20">
            {/* Header */}
            <div className="mb-12">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900">
                        Смены
                    </h1>
                    <div className="flex items-center gap-3">
                        <ShiftExcelImport
                            clubId={clubId}
                            employees={employees}
                            customFields={reportFields.map(f => ({
                                metric_key: f.metric_key,
                                custom_label: f.custom_label || f.label || f.metric_key
                            }))}
                            onSuccess={() => {
                                console.log(`[Import] Import successful, refreshing current month data`)
                                fetchShifts(clubId, filterStartDate, filterEndDate)
                            }}
                        />
                        <Button
                            variant="outline"
                            onClick={() => {
                                console.log(`[Refresh] Manual refresh triggered`)
                                fetchShifts(clubId, filterStartDate, filterEndDate)
                            }}
                            disabled={isLoading}
                            title="Обновить данные"
                            className="h-12 rounded-xl px-4 border-slate-200 text-slate-600 hover:bg-slate-50 font-medium transition-all"
                        >
                            <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button
                            onClick={openCreateModal}
                            className="h-12 min-w-12 rounded-xl px-4 sm:px-6 bg-black text-white hover:bg-slate-800 font-medium transition-all"
                        >
                            <span className="sm:hidden text-lg leading-none">+</span>
                            <span className="hidden sm:inline">Добавить смену</span>
                        </Button>
                    </div>
                </div>
            </div>

            {/* Date Filters */}
            <div className="mb-12 flex flex-col lg:flex-row gap-4 items-start lg:items-center bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
                <div className="w-full lg:w-auto min-w-[200px]">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="ghost"
                                className={cn(
                                    "h-12 w-full justify-start text-left font-medium text-base capitalize rounded-xl hover:bg-slate-50",
                                    !selectedMonth && "text-slate-400"
                                )}
                            >
                                <CalendarDays className="mr-3 h-5 w-5 text-slate-400 shrink-0" />
                                <span className="truncate">
                                    {selectedMonth ? (
                                        (() => {
                                            const now = new Date();
                                            const target = new Date(now.getFullYear(), now.getMonth() + parseInt(selectedMonth), 1);
                                            return target.toLocaleString('ru-RU', { month: 'long', year: 'numeric' });
                                        })()
                                    ) : (
                                        "Выберите месяц"
                                    )}
                                </span>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[200px] p-2 rounded-xl border-slate-200 shadow-lg" align="start">
                            <div className="grid gap-1">
                                {[0, -1, -2, -3].map((offset) => {
                                    const now = new Date();
                                    const target = new Date(now.getFullYear(), now.getMonth() + offset, 1);
                                    const label = target.toLocaleString('ru-RU', { month: 'long', year: 'numeric' });
                                    return (
                                        <Button
                                            key={offset}
                                            variant={selectedMonth === String(offset) ? "secondary" : "ghost"}
                                            className="justify-start w-full capitalize h-10 px-3 font-medium rounded-lg"
                                            onClick={() => {
                                                handleMonthSelect(offset);
                                            }}
                                        >
                                            {label}
                                        </Button>
                                    )
                                })}
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>

                <div className="h-8 w-px bg-slate-200 hidden lg:block" />

                <div className="flex flex-col sm:flex-row flex-1 w-full lg:w-auto gap-2">
                    <MaskedDateInput
                        value={filterStartDateDisplay}
                        onValueChange={(displayValue, internalValue) => {
                            setFilterStartDateDisplay(displayValue)
                            setFilterStartDate(internalValue)
                        }}
                        className="h-12 rounded-xl border-slate-200 bg-slate-50 focus-visible:ring-1 focus-visible:ring-black focus-visible:bg-white text-base transition-all w-full"
                        placeholder="С (ДД.ММ.ГГГГ)"
                    />
                    <MaskedDateInput
                        value={filterEndDateDisplay}
                        onValueChange={(displayValue, internalValue) => {
                            setFilterEndDateDisplay(displayValue)
                            setFilterEndDate(internalValue)
                        }}
                        className="h-12 rounded-xl border-slate-200 bg-slate-50 focus-visible:ring-1 focus-visible:ring-black focus-visible:bg-white text-base transition-all w-full"
                        placeholder="По (ДД.ММ.ГГГГ)"
                    />
                    <Button
                        variant="secondary"
                        onClick={handleCustomDateFilter}
                        className="h-12 rounded-xl px-6 bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium transition-all w-full sm:w-auto"
                    >
                        Найти
                    </Button>
                </div>

                <div className="h-8 w-px bg-slate-200 hidden lg:block" />

                <div className="flex-1 w-full lg:w-auto min-w-[200px]">
                    <Select value={filterEmployee || "all"} onValueChange={(value) => setFilterEmployee(value === "all" ? "" : value)}>
                        <SelectTrigger className="h-12 w-full rounded-xl border-transparent hover:bg-slate-50 focus:ring-0 font-medium text-base shadow-none">
                            <SelectValue placeholder="Сотрудник" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-slate-200 shadow-lg">
                            <SelectItem value="all" className="font-medium">Все сотрудники</SelectItem>
                            {reportEmployees.map((emp) => (
                                <SelectItem key={emp.id} value={emp.id} className="font-medium">
                                    {emp.full_name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {(filterStartDate || filterEndDate || (selectedMonth && selectedMonth !== '0')) && (
                    <>
                        <div className="h-8 w-px bg-slate-200 hidden lg:block" />
                        <Button
                            variant="ghost"
                            onClick={clearFilters}
                            className="h-12 rounded-xl px-4 text-slate-400 hover:text-slate-700 hover:bg-slate-50 font-medium w-full lg:w-auto"
                        >
                            Сбросить
                        </Button>
                    </>
                )}
            </div>

            {/* Summary Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
                <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between h-full min-h-[220px]">
                    <div className="mb-6">
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Выручка</p>
                        <p className="text-3xl lg:text-4xl font-bold text-emerald-600 tracking-tight whitespace-nowrap">{formatMoney(totalRevenue)}</p>
                    </div>
                    <div className="space-y-3 mt-auto">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-500 truncate mr-2">Наличные</span>
                            <span className="font-medium text-slate-900 whitespace-nowrap">{formatMoney(totals.totalCash)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-500 truncate mr-2">Безналичные</span>
                            <span className="font-medium text-slate-900 whitespace-nowrap">{formatMoney(totals.totalCard)}</span>
                        </div>
                        {/* Custom Income Fields added inside Revenue card */}
                        {customFieldTotals.filter(f => (f.field_type === 'OTHER' || f.field_type === 'INCOME' || !f.field_type) && f.show_in_stats).map(field => (
                            <div key={field.metric_key} className="flex items-center justify-between text-sm">
                                <span className="text-slate-500 truncate mr-2" title={field.custom_label}>{field.custom_label}</span>
                                <span className="font-medium text-emerald-600 whitespace-nowrap">{formatMoney(field.total || 0)}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between h-full min-h-[220px]">
                    <div className="mb-6">
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Расходы</p>
                        <p className="text-3xl lg:text-4xl font-bold text-rose-600 tracking-tight whitespace-nowrap">-{formatMoney(totalExpenses)}</p>
                    </div>
                    <div className="space-y-3 mt-auto">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-500 truncate mr-2">Из кассы</span>
                            <span className="font-medium text-slate-900 whitespace-nowrap">{formatMoney(totals.totalExpensesCore)}</span>
                        </div>
                        {customFieldTotals.filter(f => (f.field_type === 'EXPENSE' || f.field_type === 'EXPENSE_LIST') && f.show_in_stats).map(field => (
                            <div key={field.metric_key} className="flex items-center justify-between text-sm">
                                <span className="text-slate-500 truncate mr-2" title={field.custom_label}>{field.custom_label}</span>
                                <span className="font-medium text-slate-900 whitespace-nowrap">{formatMoney(field.total || 0)}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between h-full min-h-[220px]">
                    <div className="mb-6">
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Смены</p>
                        <p className="text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight whitespace-nowrap">{shifts.length}</p>
                    </div>
                    <div className="space-y-3 mt-auto">
                        <div className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-1.5 text-slate-500 truncate mr-2"><Sun className="h-4 w-4 text-orange-500 shrink-0"/> Дневные</span>
                            <span className="font-medium text-slate-900 whitespace-nowrap">{shifts.filter(s => s.shift_type !== 'NIGHT').length}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-1.5 text-slate-500 truncate mr-2"><Moon className="h-4 w-4 text-blue-500 shrink-0"/> Ночные</span>
                            <span className="font-medium text-slate-900 whitespace-nowrap">{shifts.filter(s => s.shift_type === 'NIGHT').length}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between h-full min-h-[220px]">
                    <div className="mb-6">
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Прогноз (Месяц)</p>
                        <p className="text-3xl lg:text-4xl font-bold text-blue-600 tracking-tight whitespace-nowrap">
                            {(() => {
                                const offset = parseInt(selectedMonth || '0');
                                if (offset !== 0) return formatMoney(totalRevenue);
                                const now = new Date();
                                const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                                const currentDay = now.getDate();
                                if (currentDay === 0) return formatMoney(0);
                                const daysPassed = Math.max(1, currentDay);
                                const dailyAvg = totalRevenue / daysPassed;
                                const forecast = dailyAvg * daysInMonth;
                                return formatMoney(forecast);
                            })()}
                        </p>
                    </div>
                    <div className="mt-auto">
                        <p className="text-sm text-slate-500 leading-relaxed">На основе текущей динамики выручки</p>
                    </div>
                </div>
            </div>

            {/* Shifts List (Cardless Desktop, Mobile list) */}
            <div>
                <h2 className="text-2xl font-bold tracking-tight mb-6">История смен</h2>
                
                {sortedShifts.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 border-dashed">
                        <Clock className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500 text-lg">Смен за этот период не найдено</p>
                    </div>
                ) : (
                    <>
                        {/* Mobile View */}
                        <div className="md:hidden space-y-3">
                            {sortedShifts.map((shift) => {
                                const isWeekend = isWeekendDate(shift.check_in)
                                const isNoReport = shift.report_mode === 'NO_REPORT'
                                const hours = Number(shift.total_hours) || 0
                                const isSutki = hours >= 20
                                const isLongShift = !isSutki && hours >= 13
                                return (
                                    <div
                                        key={shift.id}
                                        className="bg-white rounded-2xl border border-slate-200 p-4"
                                        onClick={() => router.push(`/clubs/${clubId}/shifts/${shift.id}`)}
                                    >
                                        <div className="flex items-start justify-between gap-3 mb-4">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={cn(
                                                        "font-bold text-lg whitespace-nowrap",
                                                        isWeekend ? "text-rose-600" : "text-slate-900"
                                                    )}>{formatDate(shift.check_in)}</span>
                                                    {shift.shift_type === 'NIGHT' ? (
                                                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-medium">
                                                            <Moon className="h-3 w-3" /> Ночь
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-orange-50 text-orange-700 text-xs font-medium">
                                                            <Sun className="h-3 w-3" /> День
                                                        </span>
                                                    )}
                                                    {isSutki && (
                                                        <Badge variant="secondary" className="bg-violet-100 text-violet-700 border border-violet-200 h-5 px-2 text-[10px]">
                                                            Сутки
                                                        </Badge>
                                                    )}
                                                    {!isSutki && isLongShift && (
                                                        <Badge variant="secondary" className="bg-slate-100 text-slate-700 border border-slate-200 h-5 px-2 text-[10px]">
                                                            Длинная смена
                                                        </Badge>
                                                    )}
                                                    {isNoReport && (
                                                        <Badge variant="secondary" className="bg-zinc-800 text-zinc-200 border border-zinc-700 h-5 px-2 text-[10px]">
                                                            {shift.actor_role_name_snapshot || 'Хостес'}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="text-sm font-medium text-slate-700 truncate">
                                                    {shift.employee_name || 'Неизвестно'}
                                                </div>
                                                <div className="text-xs text-slate-500 mt-0.5">
                                                    {formatTime(shift.check_in)} — {shift.check_out ? formatTime(shift.check_out) : '...'}
                                                </div>
                                            </div>

                                            <div className="shrink-0 text-right">
                                                <div className={cn(
                                                    "text-lg font-bold tabular-nums",
                                                    isNoReport ? "text-slate-400" : "text-emerald-600"
                                                )}>
                                                    {isNoReport ? '—' : formatMoney(calculateShiftTotalIncome(shift))}
                                                </div>
                                                <div className="mt-1 flex justify-end">
                                                    {getStatusBadge(shift)}
                                                </div>
                                            </div>
                                        </div>

                                        {isNoReport ? (
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                                                    <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1">Часы</div>
                                                    <div className="text-sm font-bold text-slate-900 tabular-nums">
                                                        {shift.total_hours && !isNaN(Number(shift.total_hours))
                                                            ? `${Number(shift.total_hours).toFixed(1)}ч`
                                                            : '-'}
                                                    </div>
                                                </div>
                                                <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                                                    <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1">Отчёт</div>
                                                    <div className="text-sm font-bold text-slate-900 tabular-nums">Не требуется</div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                                                    <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1">Нал</div>
                                                    <div className="text-sm font-bold text-slate-900 tabular-nums">{formatMoney(shift.cash_income)}</div>
                                                </div>
                                                <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                                                    <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1">Безнал</div>
                                                    <div className="text-sm font-bold text-slate-900 tabular-nums">{formatMoney(shift.card_income)}</div>
                                                </div>
                                                <div className="rounded-xl bg-rose-50 border border-rose-100 p-3">
                                                    <div className="text-[10px] uppercase font-bold tracking-widest text-rose-400 mb-1">Расходы</div>
                                                    <div className="text-sm font-bold text-rose-600 tabular-nums">{formatMoney(shift.expenses)}</div>
                                                </div>
                                                <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                                                    <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1">Часы</div>
                                                    <div className="text-sm font-bold text-slate-900 tabular-nums">
                                                        {shift.total_hours && !isNaN(Number(shift.total_hours))
                                                            ? `${Number(shift.total_hours).toFixed(1)}ч`
                                                            : '-'}
                                                    </div>
                                                </div>
                                                {reportFields.map((field: any) => {
                                                    const raw = shift.report_data?.[field.metric_key]
                                                    const parsed = parseFloat(String(raw))
                                                    const value = Array.isArray(raw)
                                                        ? formatMoney(getMetricValue(shift, field.metric_key))
                                                        : raw === null || raw === undefined || raw === ''
                                                            ? '-'
                                                            : (!Number.isNaN(parsed) ? formatMoney(parsed) : String(raw))

                                                    return (
                                                        <div key={field.metric_key} className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                                                            <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1 truncate" title={field.custom_label}>
                                                                {field.custom_label}
                                                            </div>
                                                            <div className="text-sm font-bold text-slate-900 tabular-nums">{value}</div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}

                                        <div className="mt-4 pt-4 border-t border-slate-100">
                                            <Button
                                                variant="outline"
                                                className="w-full h-12 rounded-xl border-slate-200 text-slate-700 font-medium hover:bg-slate-50 hover:text-black"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    router.push(`/clubs/${clubId}/shifts/${shift.id}`);
                                                }}
                                            >
                                                Открыть смену
                                            </Button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {/* Desktop View */}
                        <div className="hidden md:block bg-white rounded-2xl border border-slate-200 overflow-hidden">
                            <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-slate-50/50 border-b border-slate-200">
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead className="h-12 cursor-pointer select-none text-slate-500 font-medium" onClick={() => handleSort('check_in')}>
                                            <div className="flex items-center gap-2">Дата <ArrowUpDown className="h-3 w-3 opacity-50" /></div>
                                        </TableHead>
                                        <TableHead className="h-12 text-slate-500 font-medium">Смена</TableHead>
                                        <TableHead className="h-12 cursor-pointer select-none text-slate-500 font-medium" onClick={() => handleSort('employee_name')}>
                                            <div className="flex items-center gap-2">Сотрудник <ArrowUpDown className="h-3 w-3 opacity-50" /></div>
                                        </TableHead>
                                        <TableHead className="h-12 text-right cursor-pointer select-none text-emerald-600 font-bold" onClick={() => handleSort('total_income')}>
                                            <div className="flex items-center justify-end gap-2">Выручка <ArrowUpDown className="h-3 w-3 opacity-50" /></div>
                                        </TableHead>
                                        <TableHead className="h-12 text-right text-slate-500 font-medium">Наличные</TableHead>
                                        <TableHead className="h-12 text-right text-slate-500 font-medium">Безнал</TableHead>
                                        <TableHead className="h-12 text-right text-slate-500 font-medium">Расходы</TableHead>
                                        {reportFields.map((field: any) => (
                                            <TableHead key={field.metric_key} className="h-12 text-right text-slate-500 font-medium whitespace-nowrap min-w-[100px] max-w-[150px] truncate" title={field.custom_label}>
                                                {field.custom_label}
                                            </TableHead>
                                        ))}
                                        <TableHead className="h-12 text-right text-slate-500 font-medium">Статус</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sortedShifts.map((shift) => {
                                        const isWeekend = isWeekendDate(shift.check_in)
                                        return (
                                            <TableRow 
                                                key={shift.id} 
                                                className={cn(
                                                    "hover:bg-slate-50 cursor-pointer transition-colors border-b border-slate-100 last:border-0",
                                                    isWeekend && "bg-rose-50/30"
                                                )}
                                                onClick={() => router.push(`/clubs/${clubId}/shifts/${shift.id}`)}
                                            >
                                                <TableCell className="py-4">
                                                    <div className={cn(
                                                        "font-medium",
                                                        isWeekend ? "text-rose-600" : "text-slate-900"
                                                    )}>{formatDate(shift.check_in)}</div>
                                                    <div className={cn(
                                                        "text-xs mt-0.5",
                                                        isWeekend ? "text-rose-500" : "text-slate-500"
                                                    )}>{formatTime(shift.check_in)} — {shift.check_out ? formatTime(shift.check_out) : '...'}</div>
                                                </TableCell>
                                                <TableCell className="py-4">
                                                    {(() => {
                                                        const hours = Number(shift.total_hours) || 0
                                                        const isSutki = hours >= 20
                                                        const isLongShift = !isSutki && hours >= 13

                                                        return (
                                                            <div className="flex items-center gap-2">
                                                                {shift.shift_type === 'NIGHT' ? (
                                                                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-medium">
                                                                        <Moon className="h-3 w-3" /> Ночь
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-orange-50 text-orange-700 text-xs font-medium">
                                                                        <Sun className="h-3 w-3" /> День
                                                                    </span>
                                                                )}
                                                                {isSutki && (
                                                                    <Badge variant="secondary" className="bg-violet-100 text-violet-700 border border-violet-200 h-5 px-2 text-[10px]">
                                                                        Сутки
                                                                    </Badge>
                                                                )}
                                                                {!isSutki && isLongShift && (
                                                                    <Badge variant="secondary" className="bg-slate-100 text-slate-700 border border-slate-200 h-5 px-2 text-[10px]">
                                                                        Длинная смена
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        )
                                                    })()}
                                                </TableCell>
                                                <TableCell className="py-4">
                                                    <div className="font-medium text-slate-900">{shift.employee_name || 'Неизвестно'}</div>
                                                    <div className="text-xs text-slate-500 mt-0.5">
                                                        {shift.total_hours ? `${Number(shift.total_hours).toFixed(1)} ч` : '-'}
                                                    </div>
                                                    {shift.report_mode === 'NO_REPORT' && (
                                                        <div className="mt-1">
                                                            <Badge variant="secondary" className="bg-zinc-800 text-zinc-200 border border-zinc-700 h-5 px-2 text-[10px]">
                                                                {shift.actor_role_name_snapshot || 'Без отчёта'}
                                                            </Badge>
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell className="py-4 text-right">
                                                    {shift.report_mode === 'NO_REPORT' ? (
                                                        <span className="font-bold text-slate-400 tabular-nums text-base">—</span>
                                                    ) : (
                                                        <span className="font-bold text-emerald-600 tabular-nums text-base">
                                                            {formatMoney(calculateShiftTotalIncome(shift))}
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="py-4 text-right font-medium text-slate-600 tabular-nums">
                                                    {shift.report_mode === 'NO_REPORT' ? '-' : formatMoney(getMetricValue(shift, 'cash_income'))}
                                                </TableCell>
                                                <TableCell className="py-4 text-right font-medium text-slate-600 tabular-nums">
                                                    {shift.report_mode === 'NO_REPORT' ? '-' : formatMoney(getMetricValue(shift, 'card_income'))}
                                                </TableCell>
                                                <TableCell className="py-4 text-right font-medium text-rose-600 tabular-nums">
                                                    {shift.report_mode === 'NO_REPORT' ? '-' : formatMoney(getMetricValue(shift, 'expenses'))}
                                                </TableCell>
                                                {reportFields.map((field: any) => (
                                                    <TableCell key={field.metric_key} className="py-4 text-right text-slate-500 tabular-nums">
                                                        {shift.report_mode === 'NO_REPORT'
                                                            ? '-'
                                                            : (shift.report_data && shift.report_data[field.metric_key] !== undefined
                                                                ? formatMoney(getMetricValue(shift, field.metric_key))
                                                                : '-')}
                                                    </TableCell>
                                                ))}
                                                <TableCell className="py-4 text-right">
                                                    {getStatusBadge(shift)}
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </>
                )}
            </div>

            {/* Modals remain structurally similar but get cleaner classes */}
            <Dialog open={!!selectedShift} onOpenChange={() => setSelectedShift(null)}>
                <DialogContent className="p-0 gap-0 overflow-hidden bg-background rounded-none fixed inset-0 w-screen h-[100dvh] max-w-none flex flex-col !flex min-h-0 left-0 top-0 translate-x-0 translate-y-0 sm:rounded-xl sm:left-[50%] sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:w-[95vw] sm:h-[85vh] sm:max-w-5xl">
                    {/* Header Section */}
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between px-4 md:px-6 py-4 md:pr-16 border-b bg-card shrink-0">
                        <div className="flex items-start gap-4 min-w-0">
                            <div>
                                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                                    {selectedShift?.employee_name}
                                </DialogTitle>
                                <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                        <CalendarDays className="h-3.5 w-3.5" />
                                        {selectedShift && formatDate(selectedShift.check_in)}
                                    </span>
                                    <span className="text-border">|</span>
                                    <span className="flex items-center gap-1">
                                        <Clock className="h-3.5 w-3.5" />
                                        {selectedShift && formatTime(selectedShift.check_in)} — {selectedShift?.check_out ? formatTime(selectedShift.check_out) : '...'}
                                    </span>
                                    <span className="text-border">|</span>
                                    <Badge variant={selectedShift?.shift_type === 'NIGHT' ? 'secondary' : 'outline'} className="font-normal">
                                        {selectedShift?.shift_type === 'NIGHT' ? 'Ночная смена' : 'Дневная смена'}
                                    </Badge>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col items-start md:items-end gap-1 pr-10 md:pr-0">
                            <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Итоговая выручка</div>
                            <div className="text-2xl font-bold text-primary tabular-nums">
                                +{selectedShift ? formatMoney(calculateShiftTotalIncome(selectedShift)).replace(/[\u00A0\s]?₽/, '') : '0'} ₽
                            </div>
                            {selectedShift?.status === 'VERIFIED' && (
                                <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Подтверждена
                                </Badge>
                            )}
                        </div>
                    </div>

                    {isLoadingDetails ? (
                        <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                            <Loader2 className="h-10 w-10 animate-spin text-primary/50" />
                            <p className="text-muted-foreground">Загрузка данных смены...</p>
                        </div>
                    ) : (
                        <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden min-h-0">
                            <div className="px-4 md:px-6 border-b bg-muted/30 shrink-0">
                                <TabsList className="h-12 w-full justify-start bg-transparent p-0 gap-4 md:gap-8 overflow-x-auto">
                                    <TabsTrigger 
                                        value="overview" 
                                        className="h-full rounded-none border-b-2 border-transparent px-0 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none bg-transparent font-medium"
                                    >
                                        Обзор
                                    </TabsTrigger>
                                    <TabsTrigger 
                                        value="checklists" 
                                        className="h-full rounded-none border-b-2 border-transparent px-0 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none bg-transparent font-medium gap-2"
                                    >
                                        Чек-листы
                                        <Badge variant="secondary" className="rounded-full px-1.5 h-5 min-w-[1.25rem] justify-center text-[10px]">
                                            {selectedShiftDetails?.checklists?.length || 0}
                                        </Badge>
                                    </TabsTrigger>
                                    <TabsTrigger 
                                        value="products" 
                                        className="h-full rounded-none border-b-2 border-transparent px-0 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none bg-transparent font-medium gap-2"
                                    >
                                        Продажи
                                        <Badge variant="secondary" className="rounded-full px-1.5 h-5 min-w-[1.25rem] justify-center text-[10px]">
                                            {selectedShiftDetails?.product_sales?.length || 0}
                                        </Badge>
                                    </TabsTrigger>
                                    <TabsTrigger 
                                        value="inventory" 
                                        className="h-full rounded-none border-b-2 border-transparent px-0 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none bg-transparent font-medium gap-2"
                                    >
                                        Инвентаризация
                                        <Badge variant="secondary" className="rounded-full px-1.5 h-5 min-w-[1.25rem] justify-center text-[10px]">
                                            {selectedShiftDetails?.inventory_checks?.length || 0}
                                        </Badge>
                                    </TabsTrigger>
                                    <TabsTrigger 
                                        value="maintenance" 
                                        className="h-full rounded-none border-b-2 border-transparent px-0 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none bg-transparent font-medium gap-2"
                                    >
                                        Обслуживание
                                        <Badge variant="secondary" className="rounded-full px-1.5 h-5 min-w-[1.25rem] justify-center text-[10px]">
                                            {selectedShiftDetails?.maintenance_tasks?.length || 0}
                                        </Badge>
                                    </TabsTrigger>
                                </TabsList>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto bg-muted/5 min-h-0">
                                <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6 pb-[250px] md:pb-24">
                                    <TabsContent value="overview" className="mt-0 space-y-6">
                                        {/* Key Metrics Cards */}
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <Card>
                                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                                    <CardTitle className="text-sm font-medium text-muted-foreground">Наличные</CardTitle>
                                                    <Wallet className="h-4 w-4 text-muted-foreground" />
                                                </CardHeader>
                                                <CardContent>
                                                    <div className="text-2xl font-bold tabular-nums">
                                                        {formatMoney(getMetricValue(selectedShift, 'cash_income'))}
                                                    </div>
                                                </CardContent>
                                            </Card>
                                            <Card>
                                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                                    <CardTitle className="text-sm font-medium text-muted-foreground">Терминал</CardTitle>
                                                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                                                </CardHeader>
                                                <CardContent>
                                                    <div className="text-2xl font-bold tabular-nums">
                                                        {formatMoney(getMetricValue(selectedShift, 'card_income'))}
                                                    </div>
                                                </CardContent>
                                            </Card>
                                            <Card>
                                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                                    <CardTitle className="text-sm font-medium text-muted-foreground">Расходы</CardTitle>
                                                    <TrendingUp className="h-4 w-4 text-muted-foreground rotate-180" />
                                                </CardHeader>
                                                <CardContent>
                                                    <div className="text-2xl font-bold text-red-600 tabular-nums">
                                                        -{formatMoney(getMetricValue(selectedShift, 'expenses'))}
                                                    </div>
                                                </CardContent>
                                            </Card>
                                            <Card>
                                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                                    <CardTitle className="text-sm font-medium text-muted-foreground">Часы</CardTitle>
                                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                                </CardHeader>
                                                <CardContent>
                                                    <div className="text-2xl font-bold tabular-nums">
                                                        {Number(selectedShift?.total_hours || 0).toFixed(1)} ч
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </div>

                                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                            {/* Detailed Metrics Table */}
                                            <Card className="lg:col-span-2">
                                                <CardHeader>
                                                    <CardTitle className="text-base">Детальные показатели</CardTitle>
                                                </CardHeader>
                                                <CardContent className="p-0">
                                                    <Table>
                                                        <TableBody>
                                                            {selectedShift?.report_data && Object.entries(selectedShift.report_data).map(([key, value]) => {
                                                                const label = selectedShiftDetails?.metric_labels?.[key] || key;
                                                                // Skip internal fields if any
                                                                if (key.startsWith('_')) return null;
                                                                
                                                                const renderValue = () => {
                                                                    if (Array.isArray(value)) {
                                                                        const total = value.reduce((sum, item: any) => sum + (Number(item.amount) || 0), 0);
                                                                        if (total === 0 && value.length === 0) return '-';
                                                                        return (
                                                                            <div className="flex flex-col items-end gap-1">
                                                                                <span className="font-bold">{total.toLocaleString()} ₽</span>
                                                                                {value.map((item: any, i: number) => (
                                                                                    <span key={i} className="text-[10px] text-muted-foreground leading-none">
                                                                                        {item.amount}₽: {item.comment}
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        );
                                                                    }
                                                                    if (typeof value === 'object' && value !== null) {
                                                                        return JSON.stringify(value);
                                                                    }
                                                                    return String(value);
                                                                };

                                                                return (
                                                                    <TableRow key={key} className="hover:bg-muted/30">
                                                                        <TableCell className="font-medium text-muted-foreground w-[40%]">{label}</TableCell>
                                                                        <TableCell className="text-right font-mono font-medium">
                                                                            {renderValue()}
                                                                        </TableCell>
                                                                    </TableRow>
                                                                );
                                                            })}
                                                            {(!selectedShift?.report_data || Object.keys(selectedShift.report_data).length === 0) && (
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

                                            {/* Comments Section */}
                                            <div className="space-y-6">
                                                <div className="space-y-2">
                                                    <h3 className="font-semibold text-sm flex items-center gap-2">
                                                        <FileText className="h-4 w-4 text-muted-foreground" />
                                                        Комментарий сотрудника
                                                    </h3>
                                                    <div className="p-4 rounded-lg border bg-card text-sm text-muted-foreground min-h-[100px]">
                                                        {selectedShift?.report_comment ? (
                                                            <p className="whitespace-pre-wrap">{selectedShift.report_comment}</p>
                                                        ) : (
                                                            <span className="italic opacity-50">Комментарий отсутствует</span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <h3 className="font-semibold text-sm flex items-center gap-2">
                                                        <Edit className="h-4 w-4 text-muted-foreground" />
                                                        Заметки владельца
                                                    </h3>
                                                    <div className="p-4 rounded-lg border bg-blue-50/30 border-blue-100 text-sm text-muted-foreground min-h-[100px]">
                                                        {selectedShift?.owner_notes ? (
                                                            <p className="whitespace-pre-wrap">{selectedShift.owner_notes}</p>
                                                        ) : (
                                                            <span className="italic opacity-50">Заметок нет</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="checklists" className="mt-0 space-y-4">
                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="text-base">Выполненные чек-листы</CardTitle>
                                            </CardHeader>
                                            <CardContent className="p-0">
                                                {selectedShiftDetails?.checklists?.length === 0 ? (
                                                    <div className="text-center py-12 text-muted-foreground">Нет данных о чек-листах</div>
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
                                                            {selectedShiftDetails?.checklists.map((check, i) => {
                                                                // Calculate percentage: (total_score / max_score) * 100
                                                                const percent = check.max_score > 0 
                                                                    ? Math.round((check.total_score / check.max_score) * 100) 
                                                                    : 0;
                                                                    
                                                                return (
                                                                    <TableRow key={i}>
                                                                        <TableCell className="font-medium">{check.template_name || 'Чек-лист'}</TableCell>
                                                                        <TableCell className="text-muted-foreground">
                                                                            {formatTime(check.created_at)}
                                                                        </TableCell>
                                                                        <TableCell className="text-muted-foreground text-sm">
                                                                            {check.evaluator_name || '—'}
                                                                        </TableCell>
                                                                        <TableCell className="text-right">
                                                                            <Badge variant={percent >= 80 ? 'default' : 'destructive'} className={percent >= 80 ? 'bg-green-600 hover:bg-green-700' : ''}>
                                                                                {percent}%
                                                                            </Badge>
                                                                        </TableCell>
                                                                    </TableRow>
                                                                );
                                                            })}
                                                        </TableBody>
                                                    </Table>
                                                )}
                                            </CardContent>
                                        </Card>
                                    </TabsContent>

                                    <TabsContent value="products" className="mt-0 space-y-4">
                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="text-base">Проданные товары</CardTitle>
                                            </CardHeader>
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
                                                        {selectedShiftDetails?.product_sales?.map((sale: any) => (
                                                            <TableRow key={sale.id}>
                                                                <TableCell className="font-mono text-xs text-muted-foreground">
                                                                    {formatTime(sale.created_at)}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <div className="font-medium">{sale.product_name}</div>
                                                                    {sale.reason && <div className="text-xs text-muted-foreground">{sale.reason}</div>}
                                                                </TableCell>
                                                                <TableCell>
                                                                    {Math.abs(Number(sale.change_amount))} шт.
                                                                </TableCell>
                                                                <TableCell className="text-right text-muted-foreground whitespace-nowrap">
                                                                    {sale.price_at_time ? formatMoney(sale.price_at_time) : '-'}
                                                                </TableCell>
                                                                <TableCell className="text-right font-medium whitespace-nowrap">
                                                                    {formatMoney(Math.abs(Number(sale.change_amount)) * (Number(sale.price_at_time) || 0))}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                        {(!selectedShiftDetails?.product_sales || selectedShiftDetails.product_sales.length === 0) && (
                                                            <TableRow>
                                                                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                                                                    Продаж товаров не найдено
                                                                </TableCell>
                                                            </TableRow>
                                                        )}
                                                    </TableBody>
                                                </Table>
                                            </CardContent>
                                        </Card>
                                    </TabsContent>
                                    
                                    <TabsContent value="inventory" className="mt-0 space-y-4">
                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="text-base">Инвентаризации</CardTitle>
                                            </CardHeader>
                                            <CardContent className="p-0 bg-muted/5">
                                                {(!selectedShiftDetails?.inventory_checks || selectedShiftDetails.inventory_checks.length === 0) ? (
                                                    <div className="text-center py-12 text-muted-foreground">
                                                        Инвентаризаций не проводилось
                                                    </div>
                                                ) : (
                                                    <div className="p-4 space-y-3">
                                                        {selectedShiftDetails.inventory_checks.map((inv) => {
                                                            const isExpanded = expandedInventories[inv.id] || false;
                                                            const diff = Number(inv.revenue_difference || 0);
                                                            const reported = Number(inv.reported_revenue || 0);
                                                            const calculated = Number(inv.calculated_revenue || 0);
                                                            
                                                            // Filter discrepancies for this inventory
                                                            const discrepancies = selectedShiftDetails.inventory_discrepancies?.filter(
                                                                (d: any) => d.inventory_id === inv.id
                                                            ) || [];

                                                            return (
                                                                <div key={inv.id} className={cn(
                                                                    "border rounded-xl overflow-hidden transition-all bg-white",
                                                                    isExpanded ? "shadow-md ring-1 ring-slate-200" : "hover:border-slate-300 shadow-sm"
                                                                )}>
                                                                    {/* Header */}
                                                                    <div 
                                                                        className={cn(
                                                                            "px-4 py-3 flex items-center justify-between cursor-pointer select-none gap-2",
                                                                            isExpanded ? "border-b bg-slate-50/50" : ""
                                                                        )}
                                                                        onClick={() => setExpandedInventories(prev => ({ ...prev, [inv.id]: !prev[inv.id] }))}
                                                                    >
                                                                        {/* Left: Info */}
                                                                        <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
                                                                            <div className={cn(
                                                                                "p-2 rounded-lg transition-all shrink-0 bg-blue-50 text-blue-600",
                                                                                isExpanded ? "rotate-90" : ""
                                                                            )}>
                                                                                <ChevronRight className="h-4 w-4" />
                                                                            </div>
                                                                            <div className="min-w-0">
                                                                                <div className="text-sm font-bold text-slate-900 truncate">
                                                                                    {inv.warehouse_name || 'Склад'}
                                                                                </div>
                                                                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-slate-400 mt-0.5">
                                                                                    <span className="whitespace-nowrap">
                                                                                        {formatDate(inv.started_at)} {formatTime(inv.started_at)}
                                                                                    </span>
                                                                                    {discrepancies.length > 0 && (
                                                                                        <span className="bg-slate-100 px-1.5 py-0.5 rounded-full text-slate-600 font-medium whitespace-nowrap">
                                                                                            {discrepancies.length} расхожд.
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </div>

                                                                        {/* Right: Stats */}
                                                                        <div className="ml-3 flex-none flex flex-col items-start gap-2 text-left w-[150px] sm:w-[190px]">
                                                                            <div className="flex items-baseline gap-3 w-full">
                                                                                <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest leading-none w-[74px] shrink-0">
                                                                                    Расчет
                                                                                </span>
                                                                                <span className="text-sm font-black text-blue-600 leading-none whitespace-nowrap tabular-nums">
                                                                                    {calculated.toLocaleString()} ₽
                                                                                </span>
                                                                            </div>
                                                                            <div className="flex items-baseline gap-3 w-full">
                                                                                <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest leading-none w-[74px] shrink-0">
                                                                                    Факт
                                                                                </span>
                                                                                <span className="text-sm font-black text-slate-700 leading-none whitespace-nowrap tabular-nums">
                                                                                    {reported.toLocaleString()} ₽
                                                                                </span>
                                                                            </div>
                                                                            <div className="flex items-baseline gap-3 w-full">
                                                                                <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest leading-none w-[74px] shrink-0">
                                                                                    Разница
                                                                                </span>
                                                                                <span className={cn(
                                                                                    "text-sm font-black leading-none whitespace-nowrap tabular-nums",
                                                                                    diff === 0 ? "text-green-500" :
                                                                                    diff > 0 ? "text-green-600" : "text-red-500"
                                                                                )}>
                                                                                    {diff > 0 ? "+" : ""}{diff.toLocaleString()} ₽
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    {/* Expanded Content: Discrepancies */}
                                                                    {isExpanded && (
                                                                        <div className="bg-white">
                                                                            {discrepancies.length > 0 ? (
                                                                                <Table>
                                                                                    <TableHeader className="bg-slate-50/50">
                                                                                        <TableRow className="hover:bg-transparent h-9">
                                                                                            <TableHead className="text-[10px] uppercase font-bold text-slate-400 h-9">Товар</TableHead>
                                                                                            <TableHead className="text-right text-[10px] uppercase font-bold text-slate-400 h-9">Ожидалось</TableHead>
                                                                                            <TableHead className="text-right text-[10px] uppercase font-bold text-slate-400 h-9">Факт</TableHead>
                                                                                            <TableHead className="text-right text-[10px] uppercase font-bold text-slate-400 h-9">Разница</TableHead>
                                                                                        </TableRow>
                                                                                    </TableHeader>
                                                                                    <TableBody>
                                                                                        {discrepancies.map((item: any) => (
                                                                                            <TableRow key={item.id} className="hover:bg-slate-50/50 h-10 border-b border-slate-100 last:border-0">
                                                                                                <TableCell className="py-2 font-medium text-sm text-slate-700">
                                                                                                    {item.product_name}
                                                                                                </TableCell>
                                                                                                <TableCell className="py-2 text-right text-sm text-slate-500 tabular-nums">
                                                                                                    {item.expected_stock}
                                                                                                </TableCell>
                                                                                                <TableCell className="py-2 text-right text-sm text-slate-900 font-bold tabular-nums">
                                                                                                    {item.actual_stock}
                                                                                                </TableCell>
                                                                                                <TableCell className="py-2 text-right">
                                                                                                    <Badge variant={Number(item.difference) > 0 ? 'default' : 'destructive'} className={cn(
                                                                                                        "font-mono h-5 px-1.5 text-[10px]",
                                                                                                        Number(item.difference) > 0 ? "bg-green-100 text-green-700 hover:bg-green-200 border-0" : "bg-red-100 text-red-700 hover:bg-red-200 border-0"
                                                                                                    )}>
                                                                                                        {Number(item.difference) > 0 ? '+' : ''}{item.difference}
                                                                                                    </Badge>
                                                                                                </TableCell>
                                                                                            </TableRow>
                                                                                        ))}
                                                                                    </TableBody>
                                                                                </Table>
                                                                            ) : (
                                                                                <div className="p-8 text-center text-sm text-slate-400 italic">
                                                                                    Расхождений не найдено
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    </TabsContent>

                                    <TabsContent value="maintenance" className="mt-0 space-y-4">
                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="text-base">Обслуживание оборудования</CardTitle>
                                            </CardHeader>
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
                                                        {selectedShiftDetails?.maintenance_tasks?.map((task) => {
                                                            const taskTypeMap: Record<string, string> = {
                                                                'CLEANING': 'Чистка',
                                                                'REPAIR': 'Ремонт',
                                                                'INSPECTION': 'Осмотр',
                                                                'REPLACEMENT': 'Замена',
                                                                'SOFTWARE': 'ПО'
                                                            };
                                                            
                                                            const statusMap: Record<string, string> = {
                                                                'COMPLETED': 'Выполнено',
                                                                'PENDING': 'В ожидании',
                                                                'IN_PROGRESS': 'В процессе',
                                                                'SKIPPED': 'Пропущено'
                                                            };

                                                            return (
                                                                <TableRow key={task.id}>
                                                                    <TableCell className="font-mono text-xs text-muted-foreground">
                                                                        {formatTime(task.completed_at)}
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <div className="font-medium">{task.equipment_name}</div>
                                                                        <div className="text-xs text-muted-foreground">{task.workstation_name}</div>
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <Badge variant="outline" className="font-normal">
                                                                            {taskTypeMap[task.task_type] || task.task_type}
                                                                        </Badge>
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <Badge variant="secondary" className="bg-green-50 text-green-700 hover:bg-green-100 border-green-200">
                                                                            {statusMap[task.status] || task.status}
                                                                        </Badge>
                                                                    </TableCell>
                                                                </TableRow>
                                                            );
                                                        })}
                                                        {(!selectedShiftDetails?.maintenance_tasks || selectedShiftDetails.maintenance_tasks.length === 0) && (
                                                            <TableRow>
                                                                <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                                                                    Нет записей об обслуживании
                                                                </TableCell>
                                                            </TableRow>
                                                        )}
                                                    </TableBody>
                                                </Table>
                                            </CardContent>
                                        </Card>
                                    </TabsContent>
                                </div>
                            </div>
                        </Tabs>
                    )}
                </DialogContent>
            </Dialog>
            <Dialog open={!!editingShift} onOpenChange={() => setEditingShift(null)}>
                <DialogContent className="max-w-3xl p-0 gap-0 overflow-hidden">
                    <DialogHeader className="px-6 py-4 border-b bg-muted/30">
                        <div className="flex items-center justify-between">
                            <div>
                                <DialogTitle className="text-xl font-bold">Редактирование смены</DialogTitle>
                                <DialogDescription className="mt-1">
                                    {editingShift?.employee_name} • {editingShift && formatDate(editingShift.check_in)}
                                </DialogDescription>
                            </div>
                            <Badge variant={editShiftType === 'NIGHT' ? 'secondary' : 'outline'} className="h-6">
                                {editShiftType === 'NIGHT' ? 'Ночная смена' : 'Дневная смена'}
                            </Badge>
                        </div>
                    </DialogHeader>

                    <div className="max-h-[70vh] overflow-y-auto p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Left Column: Time & Type */}
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
                                                className="bg-background"
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
                                                className="bg-background"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="text-sm font-semibold flex items-center gap-2 text-primary">
                                        <Sun className="h-4 w-4" />
                                        Тип смены
                                    </h3>
                                    <div className="flex gap-2 bg-muted/50 p-1 rounded-lg">
                                        <Button
                                            type="button"
                                            variant={editShiftType === 'DAY' ? 'secondary' : 'ghost'}
                                            onClick={() => setEditShiftType('DAY')}
                                            className={cn("flex-1 gap-2", editShiftType === 'DAY' && "bg-background shadow-sm")}
                                        >
                                            <Sun className="h-4 w-4 text-orange-500" />
                                            Дневная
                                        </Button>
                                        <Button
                                            type="button"
                                            variant={editShiftType === 'NIGHT' ? 'secondary' : 'ghost'}
                                            onClick={() => setEditShiftType('NIGHT')}
                                            className={cn("flex-1 gap-2", editShiftType === 'NIGHT' && "bg-background shadow-sm")}
                                        >
                                            <Moon className="h-4 w-4 text-blue-500" />
                                            Ночная
                                        </Button>
                                    </div>
                                </div>

                                <div className="space-y-4 pt-2">
                                    <h3 className="text-sm font-semibold flex items-center gap-2 text-primary">
                                        <FileText className="h-4 w-4" />
                                        Комментарии
                                    </h3>
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label className="text-xs text-muted-foreground uppercase">От сотрудника</Label>
                                            <Textarea
                                                value={editComment}
                                                onChange={e => setEditComment(e.target.value)}
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

                            {/* Right Column: Finance & Custom Fields */}
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
                                                <Input
                                                    type="number"
                                                    value={editCashIncome}
                                                    onChange={e => setEditCashIncome(e.target.value)}
                                                    className="pl-8 bg-green-500/5 border-green-500/20"
                                                />
                                                <Wallet className="absolute left-2.5 top-2.5 h-4 w-4 text-green-600 opacity-50" />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs text-muted-foreground uppercase">Безнал</Label>
                                            <div className="relative">
                                                <Input
                                                    type="number"
                                                    value={editCardIncome}
                                                    onChange={e => setEditCardIncome(e.target.value)}
                                                    className="pl-8 bg-blue-500/5 border-blue-500/20"
                                                />
                                                <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-blue-600 opacity-50" />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground uppercase">Расходы</Label>
                                        <div className="relative">
                                            <Input
                                                type="number"
                                                value={editExpenses}
                                                onChange={e => setEditExpenses(e.target.value)}
                                                className="pl-8 bg-red-500/5 border-red-500/20"
                                            />
                                            <TrendingUp className="absolute left-2.5 top-2.5 h-4 w-4 text-red-600 opacity-50 rotate-180" />
                                        </div>
                                    </div>
                                </div>

                                {reportFields.length > 0 && (
                                    <div className="space-y-4 pt-2 border-t border-dashed">
                                        <h3 className="text-sm font-semibold flex items-center gap-2 text-primary">
                                            <ArrowUpDown className="h-4 w-4" />
                                            Дополнительно
                                        </h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            {reportFields.map(field => (
                                                <div key={field.metric_key} className="space-y-2">
                                                    <Label className="text-xs text-muted-foreground uppercase truncate" title={field.custom_label}>
                                                        {field.custom_label}
                                                    </Label>
                                                    <Input
                                                        type="number"
                                                        value={editCustomFields[field.metric_key] || ''}
                                                        onChange={e => setEditCustomFields(prev => ({
                                                            ...prev,
                                                            [field.metric_key]: e.target.value
                                                        }))}
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
                    </div>

                    <DialogFooter className="px-6 py-4 border-t bg-muted/30 flex items-center justify-between">
                        <Button
                            variant="ghost"
                            onClick={handleDeleteShift}
                            disabled={isSaving}
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Удалить смену
                        </Button>
                        <div className="flex gap-3">
                            <Button variant="outline" onClick={() => setEditingShift(null)}>
                                Отмена
                            </Button>
                            <Button onClick={handleSaveEdit} disabled={isSaving} className="px-8">
                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Сохранить изменения
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Create Shift Modal */}
            <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Добавить смену</DialogTitle>
                        <DialogDescription>
                            Ручное создание смены для сотрудника
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {/* Employee Select */}
                        <div className="space-y-2">
                            <Label>Сотрудник *</Label>
                            <select
                                value={newShiftEmployee}
                                onChange={e => setNewShiftEmployee(e.target.value)}
                                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                            >
                                <option value="">Выберите сотрудника...</option>
                                {employees.map(emp => (
                                    <option key={emp.id} value={emp.id}>
                                        {emp.full_name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Time Section */}
                        <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                            <Label className="text-xs uppercase text-muted-foreground tracking-wider">Время смены</Label>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-sm">Начало *</Label>
                                    <MaskedDateTimeInput
                                        value={newShiftCheckInDisplay}
                                        onValueChange={(displayValue, internalValue) => {
                                            setNewShiftCheckInDisplay(displayValue)
                                            setNewShiftCheckIn(internalValue)
                                        }}
                                        className="bg-background"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm">Конец</Label>
                                    <MaskedDateTimeInput
                                        value={newShiftCheckOutDisplay}
                                        onValueChange={(displayValue, internalValue) => {
                                            setNewShiftCheckOutDisplay(displayValue)
                                            setNewShiftCheckOut(internalValue)
                                        }}
                                        className="bg-background"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Financial Section */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Выручка (Нал)</Label>
                                <Input
                                    type="number"
                                    value={newShiftCashIncome}
                                    onChange={e => setNewShiftCashIncome(e.target.value)}
                                    placeholder="0"
                                    className="bg-green-500/5 border-green-500/20 focus:border-green-500"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Выручка (Безнал)</Label>
                                <Input
                                    type="number"
                                    value={newShiftCardIncome}
                                    onChange={e => setNewShiftCardIncome(e.target.value)}
                                    placeholder="0"
                                    className="bg-blue-500/5 border-blue-500/20 focus:border-blue-500"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Расходы</Label>
                            <Input
                                type="number"
                                value={newShiftExpenses}
                                onChange={e => setNewShiftExpenses(e.target.value)}
                                placeholder="0"
                                className="bg-orange-500/5 border-orange-500/20 focus:border-orange-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Комментарий</Label>
                            <Input
                                value={newShiftComment}
                                onChange={e => setNewShiftComment(e.target.value)}
                                placeholder="Примечание к смене..."
                            />
                        </div>

                        {/* Custom Report Fields */}
                        {reportFields.length > 0 && (
                            <div className="space-y-3 pt-2 border-t">
                                <Label className="text-xs uppercase text-muted-foreground tracking-wider">Дополнительные показатели</Label>
                                <div className="grid grid-cols-2 gap-4">
                                    {reportFields.map(field => (
                                        <div key={field.metric_key} className="space-y-2">
                                            <Label>{field.custom_label}</Label>
                                            <Input
                                                type="number"
                                                value={newShiftCustomFields[field.metric_key] || ''}
                                                onChange={e => setNewShiftCustomFields(prev => ({
                                                    ...prev,
                                                    [field.metric_key]: e.target.value
                                                }))}
                                                placeholder="0"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>Отмена</Button>
                        <Button onClick={handleCreateShift} disabled={isCreating}>
                            {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Создать смену
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            </main>
        </div>
    )
}
