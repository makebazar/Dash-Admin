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
import { Loader2, Clock, DollarSign, FileText, Eye, TrendingUp, Wallet, Edit, CheckCircle, CalendarDays, Sun, Moon, Trash2, ArrowUpDown, ChevronLeft, ChevronRight, RefreshCw, CheckSquare, Wrench, Package } from "lucide-react"
import { ShiftExcelImport } from "@/components/payroll/ShiftExcelImport"
import { cn } from "@/lib/utils"

// Manual mask for DD.MM.YYYY
const formatDisplayDate = (value: string) => {
    const digits = value.replace(/\D/g, "");
    let formatted = digits;
    if (digits.length > 2) formatted = `${digits.slice(0, 2)}.${digits.slice(2)}`;
    if (digits.length > 4) formatted = `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4, 8)}`;
    return formatted.slice(0, 10);
};

// Manual mask for DD.MM.YYYY, HH:mm
const formatDisplayDateTime = (value: string) => {
    const digits = value.replace(/\D/g, "");
    let formatted = digits;
    if (digits.length > 2) formatted = `${digits.slice(0, 2)}.${digits.slice(2)}`;
    if (digits.length > 4) formatted = `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
    if (digits.length > 8) formatted = `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4, 8)}, ${digits.slice(8)}`;
    if (digits.length > 10) formatted = `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4, 8)}, ${digits.slice(8, 10)}:${digits.slice(10, 12)}`;
    return formatted.slice(0, 17);
};

// Helper to convert DD.MM.YYYY to YYYY-MM-DD
const dateToInternal = (displayStr: string) => {
    if (!displayStr || displayStr.length < 10) return ''
    const [d, m, y] = displayStr.split('.')
    return `${y}-${m}-${d}`
}

// Helper to convert YYYY-MM-DD to DD.MM.YYYY
const dateToDisplay = (internalStr: string) => {
    if (!internalStr) return ''
    const parts = internalStr.split('-')
    if (parts.length !== 3) return ''
    const [y, m, d] = parts
    return `${d}.${m}.${y}`
}

// Helper to convert DD.MM.YYYY, HH:mm to YYYY-MM-DDTHH:mm
const dateTimeToInternal = (displayStr: string) => {
    if (!displayStr || displayStr.length < 17) return ''
    const [datePart, timePart] = displayStr.split(', ')
    if (!datePart || !timePart) return ''
    const internalDate = dateToInternal(datePart)
    if (!internalDate) return ''
    return `${internalDate}T${timePart}`
}

// Helper to convert YYYY-MM-DDTHH:mm to DD.MM.YYYY, HH:mm
const dateTimeToDisplay = (internalStr: string) => {
    if (!internalStr) return ''
    const [datePart, timePart] = internalStr.split('T')
    if (!datePart || !timePart) return ''
    const displayDate = dateToDisplay(datePart)
    return `${displayDate}, ${timePart.slice(0, 5)}`
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
    const [clubId, setClubId] = useState('')
    const [shifts, setShifts] = useState<Shift[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [selectedShift, setSelectedShift] = useState<Shift | null>(null)
    const [selectedShiftDetails, setSelectedShiftDetails] = useState<ShiftDetails | null>(null)
    const [isLoadingDetails, setIsLoadingDetails] = useState(false)
    const [editingShift, setEditingShift] = useState<Shift | null>(null)
    const [isSaving, setIsSaving] = useState(false)

    // Edit form state
    const [editCashIncome, setEditCashIncome] = useState('')
    const [editCardIncome, setEditCardIncome] = useState('')
    const [editExpenses, setEditExpenses] = useState('')
    const [editComment, setEditComment] = useState('')
    const [editCheckIn, setEditCheckIn] = useState('')
    const [editCheckOut, setEditCheckOut] = useState('')
    const [editCustomFields, setEditCustomFields] = useState<Record<string, any>>({})
    const [editOwnerNotes, setEditOwnerNotes] = useState('')
    const [clubTimezone, setClubTimezone] = useState('Europe/Moscow')

    // Create shift modal state
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [employees, setEmployees] = useState<{ id: string, full_name: string }[]>([])
    const [newShiftEmployee, setNewShiftEmployee] = useState('')
    const [newShiftCheckIn, setNewShiftCheckIn] = useState('')
    const [newShiftCheckOut, setNewShiftCheckOut] = useState('')
    const [newShiftCashIncome, setNewShiftCashIncome] = useState('')
    const [newShiftCardIncome, setNewShiftCardIncome] = useState('')
    const [newShiftExpenses, setNewShiftExpenses] = useState('')
    const [newShiftComment, setNewShiftComment] = useState('')
    const [newShiftCustomFields, setNewShiftCustomFields] = useState<Record<string, any>>({})
    const [isCreating, setIsCreating] = useState(false)

    // Date filter state
    const [filterStartDate, setFilterStartDate] = useState('')
    const [filterEndDate, setFilterEndDate] = useState('')
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
        const cash = parseFloat(String(shift.cash_income)) || 0
        const card = parseFloat(String(shift.card_income)) || 0
        const customIncome = reportFields
            .filter(f => f.field_type === 'INCOME')
            .reduce((sum, f) => {
                const val = parseFloat(String(shift.report_data?.[f.metric_key])) || 0
                return sum + val
            }, 0)
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

    const getMonthName = (offset: number) => {
        const date = new Date()
        date.setDate(1)
        date.setMonth(date.getMonth() + offset)
        return date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
    }

    const formatForInput = useCallback((dateStr: string | null) => {
        if (!dateStr) return ''
        const d = new Date(dateStr)
        const formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: clubTimezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        })
        const parts = formatter.formatToParts(d)
        const getPart = (type: string) => parts.find(p => p.type === type)?.value
        return `${getPart('year')}-${getPart('month')}-${getPart('day')}T${getPart('hour')}:${getPart('minute')}`
    }, [clubTimezone])

    const openEditModal = (shift: Shift) => {
        setEditingShift(shift)
        setEditCashIncome(String(shift.cash_income || 0))
        setEditCardIncome(String(shift.card_income || 0))
        setEditExpenses(String(shift.expenses || 0))
        setEditComment(shift.report_comment || '')
        setEditOwnerNotes(shift.owner_notes || '')
        setEditCheckIn(formatForInput(shift.check_in))
        setEditCheckOut(formatForInput(shift.check_out))
        setEditShiftType(shift.shift_type || 'DAY')
        setEditCustomFields(shift.report_data || {})
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

    const handleViewShift = async (shift: Shift) => {
        setSelectedShift(shift)
        setIsLoadingDetails(true)
        setSelectedShiftDetails(null)
        try {
            const res = await fetch(`/api/clubs/${clubId}/shifts/${shift.id}`)
            if (res.ok) {
                const data = await res.json()
                setSelectedShiftDetails(data)
            }
        } catch (e) {
            console.error(e)
        } finally {
            setIsLoadingDetails(false)
        }
    }

    const handleVerify = async (shift: Shift) => {
        try {
            const res = await fetch(`/api/clubs/${clubId}/shifts/${shift.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'VERIFIED' })
            })

            if (res.ok) {
                fetchShifts(clubId, filterStartDate, filterEndDate)
            } else {
                const data = await res.json()
                alert(data.error || 'Ошибка')
            }
        } catch (error) {
            console.error('Error:', error)
            alert('Ошибка подтверждения')
        }
    }

    const handleUnverify = async (shift: Shift) => {
        if (!confirm('Отменить подтверждение смены? Транзакции будут удалены из финансов.')) {
            return
        }

        try {
            const res = await fetch(`/api/clubs/${clubId}/shifts/${shift.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'CLOSED' })
            })

            if (res.ok) {
                fetchShifts(clubId, filterStartDate, filterEndDate)
            } else {
                const data = await res.json()
                alert(data.error || 'Ошибка')
            }
        } catch (error) {
            console.error('Error:', error)
            alert('Ошибка отмены подтверждения')
        }
    }

    const openCreateModal = () => {
        setNewShiftEmployee('')
        setNewShiftCheckIn('')
        setNewShiftCheckOut('')
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
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            timeZone: clubTimezone
        })
    }, [clubTimezone])

    const formatTime = useCallback((dateStr: string) => {
        return new Date(dateStr).toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: clubTimezone
        })
    }, [clubTimezone])

    const formatMoney = (amount: number | string | null) => {
        if (amount === null || amount === undefined) return '0 ₽'
        const num = typeof amount === 'string' ? parseFloat(amount) : amount
        if (isNaN(num) || num === 0) return '0 ₽'
        return num.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽'
    }

    const getStatusBadge = (shift: Shift) => {
        if (!shift.check_out) {
            return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 animate-pulse">Активна</Badge>
        }
        if (shift.status === 'VERIFIED') {
            if (shift.has_owner_corrections) {
                return (
                    <div className="flex items-center gap-2">
                        <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20">
                            ⚠️ Проверена с замечаниями
                        </Badge>
                    </div>
                )
            }
            return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">✓ Подтверждена</Badge>
        }
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">Закрыта</Badge>
    }

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

            // Convert to numbers for numeric columns
            if (['cash_income', 'card_income', 'expenses', 'total_hours'].includes(sortBy)) {
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
        const totalCash = currentDisplayShifts.reduce((sum, s) => sum + (parseFloat(String(s.cash_income)) || 0), 0)
        const totalCard = currentDisplayShifts.reduce((sum, s) => sum + (parseFloat(String(s.card_income)) || 0), 0)
        const totalExpensesCore = currentDisplayShifts.reduce((sum, s) => sum + (parseFloat(String(s.expenses)) || 0), 0)
        
        return { totalCash, totalCard, totalExpensesCore }
    }, [filteredShifts])

    // Calculate income and expenses from custom fields
    const customFieldTotals = useMemo(() => {
        return reportFields.map(field => {
            const total = filteredShifts.reduce((sum, s) => {
                if (s.report_data && s.report_data[field.metric_key]) {
                    const value = s.report_data[field.metric_key]
                    if (field.field_type === 'EXPENSE_LIST' && Array.isArray(value)) {
                        return sum + value.reduce((itemSum, item) => itemSum + (parseFloat(String(item.amount)) || 0), 0)
                    }
                    return sum + (parseFloat(String(value)) || 0)
                }
                return sum
            }, 0)
            return { ...field, total }
        })
    }, [filteredShifts, reportFields])

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
        <div className="p-8 space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Смены</h1>
                    <p className="text-muted-foreground">История смен и отчетов сотрудников</p>
                </div>
                <div className="flex gap-2">
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
                        size="icon" 
                        onClick={() => {
                            console.log(`[Refresh] Manual refresh triggered`)
                            fetchShifts(clubId, filterStartDate, filterEndDate)
                        }}
                        disabled={isLoading}
                        title="Обновить данные"
                    >
                        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button onClick={openCreateModal} className="gap-2">
                        <Clock className="h-4 w-4" />
                        Добавить смену
                    </Button>
                </div>
            </div>

            {/* Date Filters */}
            <Card className="border-dashed bg-transparent shadow-none border-none p-0">
                <div className="flex flex-wrap items-center gap-4 bg-background border rounded-lg p-2 shadow-sm">
                    {/* Month Selector */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                className={cn(
                                    "justify-start text-left font-normal w-[180px] capitalize",
                                    !selectedMonth && "text-muted-foreground"
                                )}
                            >
                                <CalendarDays className="mr-2 h-4 w-4" />
                                {selectedMonth ? (
                                    (() => {
                                        const now = new Date();
                                        const target = new Date(now.getFullYear(), now.getMonth() + parseInt(selectedMonth), 1);
                                        return target.toLocaleString('ru-RU', { month: 'long', year: 'numeric' });
                                    })()
                                ) : (
                                    <span>Выберите месяц</span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <div className="p-2 w-48">
                                <div className="grid gap-1">
                                    {[0, -1, -2, -3].map((offset) => {
                                        const now = new Date();
                                        const target = new Date(now.getFullYear(), now.getMonth() + offset, 1);
                                        const label = target.toLocaleString('ru-RU', { month: 'long', year: 'numeric' });
                                        return (
                                            <Button 
                                                key={offset} 
                                                variant={selectedMonth === String(offset) ? "default" : "ghost"}
                                                className="justify-start w-full capitalize h-9 px-2.5 font-normal"
                                                onClick={() => {
                                                    handleMonthSelect(offset);
                                                    // Close popover logic would go here if controlled
                                                }}
                                            >
                                                {label}
                                            </Button>
                                        )
                                    })}
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>

                    <div className="h-6 w-px bg-border hidden md:block" />

                    {/* Custom Range */}
                    <div className="flex items-center gap-2">
                        <Input
                            placeholder="ДД.ММ.ГГГГ"
                            value={dateToDisplay(filterStartDate)}
                            onChange={(e) => {
                                const formatted = formatDisplayDate(e.target.value);
                                setFilterStartDate(dateToInternal(formatted));
                            }}
                            className="w-[120px]"
                        />
                        <span className="text-muted-foreground">—</span>
                        <Input
                            placeholder="ДД.ММ.ГГГГ"
                            value={dateToDisplay(filterEndDate)}
                            onChange={(e) => {
                                const formatted = formatDisplayDate(e.target.value);
                                setFilterEndDate(dateToInternal(formatted));
                            }}
                            className="w-[120px]"
                        />
                        <Button 
                            variant="secondary" 
                            size="sm" 
                            onClick={handleCustomDateFilter} 
                            className="h-9 px-3"
                        >
                            Применить
                        </Button>
                    </div>

                    <div className="h-6 w-px bg-border hidden md:block" />

                    {/* Employee Filter */}
                    <select
                        value={filterEmployee}
                        onChange={e => setFilterEmployee(e.target.value)}
                        className="h-10 w-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                        <option value="">Все сотрудники</option>
                        {employees.map(emp => (
                            <option key={emp.id} value={emp.id}>
                                {emp.full_name}
                            </option>
                        ))}
                    </select>

                    {(filterStartDate || filterEndDate || (selectedMonth && selectedMonth !== '0')) && (
                        <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={clearFilters}
                            className="ml-auto text-muted-foreground hover:text-foreground"
                        >
                            Сбросить
                        </Button>
                    )}
                </div>
            </Card>

            {/* Summary Cards */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
                <Card className="overflow-hidden relative border-none bg-purple-500/5 shadow-none">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
                        <CardTitle className="text-sm font-medium text-purple-600">Всего смен</CardTitle>
                        <Clock className="h-4 w-4 text-purple-500" />
                    </CardHeader>
                    <CardContent className="relative">
                        <div className="text-3xl font-bold">{shifts.length}</div>
                        <p className="text-xs text-muted-foreground mt-1">за выбранный период</p>
                    </CardContent>
                </Card>

                <Card className="overflow-hidden relative border-none bg-green-600/10 shadow-none border-green-600/20 border col-span-1 sm:col-span-2 lg:col-span-2 xl:col-span-2">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
                        <CardTitle className="text-sm font-bold text-green-700 uppercase">Итого Выручка</CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent className="relative">
                        <div className="text-3xl font-black text-green-600 mb-4">{formatMoney(totalRevenue)}</div>
                        
                        <div className="space-y-1">
                            {/* Standard Fields */}
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground flex items-center gap-1">
                                    <Wallet className="h-3 w-3" />
                                    Наличные
                                </span>
                                <span className="font-medium text-emerald-700">{formatMoney(totals.totalCash)}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground flex items-center gap-1">
                                    <DollarSign className="h-3 w-3" />
                                    Безналичные
                                </span>
                                <span className="font-medium text-blue-700">{formatMoney(totals.totalCard)}</span>
                            </div>

                            {/* Dynamic Income Fields */}
                            {customFieldTotals.filter(f => f.field_type === 'INCOME' && f.show_in_stats).map(field => (
                                <div key={field.metric_key} className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground flex items-center gap-1">
                                        <TrendingUp className="h-3 w-3" />
                                        {field.custom_label}
                                    </span>
                                    <span className="font-medium text-cyan-700">{formatMoney(field.total)}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card className="overflow-hidden relative border-none bg-orange-500/5 shadow-none">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
                        <CardTitle className="text-sm font-medium text-orange-600">Расходы</CardTitle>
                        <TrendingUp className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent className="relative">
                        <div className="text-3xl font-bold text-orange-500">{formatMoney(totalExpenses)}</div>
                    </CardContent>
                </Card>

                {/* Expense Cards */}
                {customFieldTotals.filter(f => (f.field_type === 'EXPENSE' || f.field_type === 'EXPENSE_LIST') && f.show_in_stats).map(field => (
                    <Card key={field.metric_key} className="overflow-hidden relative border-none bg-rose-500/5 shadow-none">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
                            <CardTitle className="text-sm font-medium text-red-600">{field.custom_label}</CardTitle>
                            <TrendingUp className="h-4 w-4 text-red-500" />
                        </CardHeader>
                        <CardContent className="relative">
                            <div className="text-3xl font-bold text-red-600">{formatMoney(field.total || 0)}</div>
                        </CardContent>
                    </Card>
                ))}

                {/* Average Shift Revenue (Day/Night) */}
                <Card className="overflow-hidden relative border-none bg-indigo-500/5 shadow-none">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
                        <CardTitle className="text-sm font-medium text-indigo-600">Ср. выручка (День)</CardTitle>
                        <Sun className="h-4 w-4 text-indigo-500" />
                    </CardHeader>
                    <CardContent className="relative">
                        <div className="text-3xl font-bold text-indigo-600">
                            {formatMoney(
                                shifts.filter(s => s.shift_type !== 'NIGHT').length > 0 
                                ? shifts.filter(s => s.shift_type !== 'NIGHT').reduce((acc, s) => acc + calculateShiftTotalIncome(s), 0) / shifts.filter(s => s.shift_type !== 'NIGHT').length
                                : 0
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {shifts.filter(s => s.shift_type !== 'NIGHT').length} смен
                        </p>
                    </CardContent>
                </Card>

                <Card className="overflow-hidden relative border-none bg-violet-500/5 shadow-none">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
                        <CardTitle className="text-sm font-medium text-violet-600">Ср. выручка (Ночь)</CardTitle>
                        <Moon className="h-4 w-4 text-violet-500" />
                    </CardHeader>
                    <CardContent className="relative">
                        <div className="text-3xl font-bold text-violet-600">
                            {formatMoney(
                                shifts.filter(s => s.shift_type === 'NIGHT').length > 0 
                                ? shifts.filter(s => s.shift_type === 'NIGHT').reduce((acc, s) => acc + calculateShiftTotalIncome(s), 0) / shifts.filter(s => s.shift_type === 'NIGHT').length
                                : 0
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {shifts.filter(s => s.shift_type === 'NIGHT').length} смен
                        </p>
                    </CardContent>
                </Card>

                {/* Revenue Forecast (Month End) */}
                {selectedMonth && (
                    <Card className="overflow-hidden relative border-none bg-teal-500/5 shadow-none">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
                            <CardTitle className="text-sm font-medium text-teal-600">Прогноз (Месяц)</CardTitle>
                            <TrendingUp className="h-4 w-4 text-teal-500" />
                        </CardHeader>
                        <CardContent className="relative">
                            <div className="text-3xl font-bold text-teal-600">
                                {(() => {
                                    // Calculate forecast logic
                                     const offset = parseInt(selectedMonth);
                                     const isCurrentMonth = offset === 0;
                                     
                                     if (!isCurrentMonth) {
                                         // For past months (or future?), forecast = actual total
                                         return formatMoney(totalRevenue);
                                     }

                                     const now = new Date();
                                     const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                                     const currentDay = now.getDate();
                                     
                                     // Avoid division by zero
                                     if (currentDay === 0) return formatMoney(0);
                                     
                                     // Use completed days for better accuracy (current day is still in progress)
                                     const daysPassed = Math.max(1, currentDay);
                                     const dailyAvg = totalRevenue / daysPassed;
                                     const forecast = dailyAvg * daysInMonth;
                                     
                                     return formatMoney(forecast);
                                })()}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                на конец месяца
                            </p>
                        </CardContent>
                    </Card>
                )}

                {/* Other Stats Cards (e.g. Guest Count, Bar Revenue) */}
            {customFieldTotals.filter(f => (f.field_type === 'OTHER' || !f.field_type) && f.show_in_stats).map(field => (
                <Card key={field.metric_key} className="overflow-hidden relative border-none bg-slate-500/5 shadow-none">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
                        <CardTitle className="text-sm font-medium text-slate-600">{field.custom_label}</CardTitle>
                        <TrendingUp className="h-4 w-4 text-slate-500" />
                    </CardHeader>
                    <CardContent className="relative">
                        <div className="text-3xl font-bold text-slate-600">{formatMoney(field.total || 0)}</div>
                    </CardContent>
                </Card>
            ))}
        </div>

        {/* Shifts Table */}
            <Card>
                <CardHeader>
                    <CardTitle>История смен</CardTitle>
                    <CardDescription>Последние 100 смен с отчетами</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead
                                    className="cursor-pointer hover:bg-muted/50 select-none"
                                    onClick={() => handleSort('check_in')}
                                >
                                    <div className="flex items-center gap-1">
                                        Дата
                                        <ArrowUpDown className="h-3 w-3" />
                                    </div>
                                </TableHead>
                                <TableHead>Тип</TableHead>
                                <TableHead
                                    className="cursor-pointer hover:bg-muted/50 select-none"
                                    onClick={() => handleSort('employee_name')}
                                >
                                    <div className="flex items-center gap-1">
                                        Сотрудник
                                        <ArrowUpDown className="h-3 w-3" />
                                    </div>
                                </TableHead>
                                <TableHead>Время</TableHead>
                                <TableHead
                                    className="cursor-pointer hover:bg-muted/50 select-none"
                                    onClick={() => handleSort('total_hours')}
                                >
                                    <div className="flex items-center gap-1">
                                        Часы
                                        <ArrowUpDown className="h-3 w-3" />
                                    </div>
                                </TableHead>
                                <TableHead
                                    className="text-right cursor-pointer hover:bg-muted/50 select-none font-bold text-green-600"
                                    onClick={() => handleSort('total_income')}
                                >
                                    <div className="flex items-center justify-end gap-1">
                                        Итого Выручка
                                        <ArrowUpDown className="h-3 w-3" />
                                    </div>
                                </TableHead>
                                <TableHead
                                    className="text-right cursor-pointer hover:bg-muted/50 select-none"
                                    onClick={() => handleSort('cash_income')}
                                >
                                    <div className="flex items-center justify-end gap-1">
                                        Нал
                                        <ArrowUpDown className="h-3 w-3" />
                                    </div>
                                </TableHead>
                                <TableHead
                                    className="text-right cursor-pointer hover:bg-muted/50 select-none"
                                    onClick={() => handleSort('card_income')}
                                >
                                    <div className="flex items-center justify-end gap-1">
                                        Безнал
                                        <ArrowUpDown className="h-3 w-3" />
                                    </div>
                                </TableHead>
                                <TableHead
                                    className="text-right cursor-pointer hover:bg-muted/50 select-none"
                                    onClick={() => handleSort('expenses')}
                                >
                                    <div className="flex items-center justify-end gap-1">
                                        Расходы
                                        <ArrowUpDown className="h-3 w-3" />
                                    </div>
                                </TableHead>
                                {reportFields.map((field: any) => (
                                    <TableHead key={field.metric_key} className="text-right min-w-[100px]">{field.custom_label}</TableHead>
                                ))}
                                <TableHead>Статус</TableHead>
                                <TableHead className="text-right">Действия</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedShifts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={10 + reportFields.length} className="text-center text-muted-foreground py-12">
                                        <div className="flex flex-col items-center gap-2">
                                            <Clock className="h-8 w-8 opacity-30" />
                                            <p>Смен пока нет</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : sortedShifts.map((shift) => (
                                <TableRow 
                                    key={shift.id} 
                                    className="hover:bg-muted/50 cursor-pointer group"
                                    onClick={(e) => {
                                        // Don't open if clicking on action buttons
                                        if ((e.target as HTMLElement).closest('button')) return;
                                        handleViewShift(shift);
                                    }}
                                >
                                    <TableCell className="font-medium whitespace-nowrap">
                                        {formatDate(shift.check_in)}
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap">
                                        {shift.shift_type === 'NIGHT' ? (
                                            <div className="flex items-center gap-1 text-blue-500">
                                                <Moon className="h-4 w-4" />
                                                <span className="text-xs">Ночь</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1 text-orange-500">
                                                <Sun className="h-4 w-4" />
                                                <span className="text-xs">День</span>
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap">
                                        {shift.employee_name || 'Неизвестно'}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                        {formatTime(shift.check_in)} — {shift.check_out ? formatTime(shift.check_out) : '...'}
                                    </TableCell>
                                    <TableCell className="font-mono whitespace-nowrap">
                                        {shift.total_hours && !isNaN(Number(shift.total_hours))
                                            ? `${Number(shift.total_hours).toFixed(1)}ч`
                                            : '-'}
                                    </TableCell>
                                    <TableCell className="text-right font-bold text-green-600 whitespace-nowrap bg-green-500/5">{formatMoney(calculateShiftTotalIncome(shift))}</TableCell>
                                    <TableCell className="text-right font-medium text-green-500 whitespace-nowrap">{formatMoney(shift.cash_income)}</TableCell>
                                    <TableCell className="text-right font-medium text-blue-500 whitespace-nowrap">{formatMoney(shift.card_income)}</TableCell>
                                    <TableCell className="text-right font-medium text-orange-500 whitespace-nowrap">{formatMoney(shift.expenses)}</TableCell>
                                    {reportFields.map((field: any) => (
                                        <TableCell key={field.metric_key} className="text-right whitespace-nowrap">
                                            {shift.report_data && shift.report_data[field.metric_key] !== undefined
                                                ? formatMoney(shift.report_data[field.metric_key])
                                                : '-'}
                                        </TableCell>
                                    ))}
                                    <TableCell className="whitespace-nowrap">
                                        {getStatusBadge(shift)}
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap">
                                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 hover:bg-blue-500/10 hover:text-blue-500"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    openEditModal(shift);
                                                }}
                                                title="Редактировать"
                                            >
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            {shift.check_out && shift.status !== 'VERIFIED' && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 hover:bg-green-500/10 hover:text-green-500"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleVerify(shift);
                                                    }}
                                                    title="Подтвердить"
                                                >
                                                    <CheckCircle className="h-4 w-4" />
                                                </Button>
                                            )}
                                            {shift.status === 'VERIFIED' && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 hover:bg-red-500/10 hover:text-red-500"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleUnverify(shift);
                                                    }}
                                                    title="Отменить подтверждение"
                                                >
                                                    <span className="text-xs font-bold">↩</span>
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* View Report Modal - Redesigned V3 (Clean & Standard) */}
            <Dialog open={!!selectedShift} onOpenChange={() => setSelectedShift(null)}>
                <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0 gap-0 overflow-hidden bg-background sm:rounded-xl">
                    {/* Header Section */}
                    <div className="flex items-center justify-between px-6 py-4 border-b bg-card shrink-0">
                        <div className="flex items-center gap-4">
                            <div>
                                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                                    {selectedShift?.employee_name}
                                </DialogTitle>
                                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
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
                        <div className="flex flex-col items-end gap-1 mr-8">
                            <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Итоговая выручка</div>
                            <div className="text-2xl font-bold text-primary tabular-nums">
                                +{selectedShift ? formatMoney(calculateShiftTotalIncome(selectedShift)).replace(' ₽', '') : '0'} ₽
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
                            <p className="text-muted-foreground animate-pulse">Загрузка данных смены...</p>
                        </div>
                    ) : (
                        <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
                            <div className="px-6 border-b bg-muted/30 shrink-0">
                                <TabsList className="h-12 w-full justify-start bg-transparent p-0 gap-8">
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
                            
                            <div className="flex-1 overflow-y-auto bg-muted/5">
                                <div className="p-6 max-w-5xl mx-auto space-y-6">
                                    <TabsContent value="overview" className="mt-0 space-y-6 animate-in fade-in-50 duration-300">
                                        {/* Key Metrics Cards */}
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <Card>
                                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                                    <CardTitle className="text-sm font-medium text-muted-foreground">Наличные</CardTitle>
                                                    <Wallet className="h-4 w-4 text-muted-foreground" />
                                                </CardHeader>
                                                <CardContent>
                                                    <div className="text-2xl font-bold tabular-nums">
                                                        {Number(selectedShift?.cash_income || 0).toLocaleString()} ₽
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
                                                        {Number(selectedShift?.card_income || 0).toLocaleString()} ₽
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
                                                        -{Number(selectedShift?.expenses || 0).toLocaleString()} ₽
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
                                                                
                                                                return (
                                                                    <TableRow key={key} className="hover:bg-muted/30">
                                                                        <TableCell className="font-medium text-muted-foreground w-[60%]">{label}</TableCell>
                                                                        <TableCell className="text-right font-mono font-medium">{String(value)}</TableCell>
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

                                    <TabsContent value="checklists" className="mt-0 space-y-4 animate-in fade-in-50 duration-300">
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

                                    <TabsContent value="products" className="mt-0 space-y-4 animate-in fade-in-50 duration-300">
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
                                                                <TableCell className="text-right text-muted-foreground">
                                                                    {sale.price_at_time ? formatMoney(sale.price_at_time) : '-'}
                                                                </TableCell>
                                                                <TableCell className="text-right font-medium">
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
                                    
                                    <TabsContent value="inventory" className="mt-0 space-y-4 animate-in fade-in-50 duration-300">
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
                                                                        <div className="flex items-center gap-3 min-w-0 shrink-0">
                                                                            <div className={cn(
                                                                                "p-2 rounded-lg transition-all shrink-0 bg-blue-50 text-blue-600",
                                                                                isExpanded ? "rotate-90" : ""
                                                                            )}>
                                                                                <ChevronRight className="h-4 w-4" />
                                                                            </div>
                                                                            <div className="flex flex-col min-w-0">
                                                                                <span className="text-sm font-bold text-slate-900 truncate flex items-center gap-2">
                                                                                    <Package className="h-3.5 w-3.5 text-muted-foreground" />
                                                                                    {inv.warehouse_name || 'Склад'}
                                                                                </span>
                                                                                <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                                                                                    <span>{formatDate(inv.started_at)} {formatTime(inv.started_at)}</span>
                                                                                    {discrepancies.length > 0 && (
                                                                                        <span className="bg-slate-100 px-1.5 py-0.5 rounded-full text-slate-600 font-medium">
                                                                                            {discrepancies.length} расхожд.
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </div>

                                                                        {/* Right: Stats */}
                                                                        <div className="flex items-center gap-3 sm:gap-6 ml-auto shrink-0">
                                                                            <div className="flex flex-col items-end shrink-0">
                                                                                <span className="text-[9px] text-slate-400 uppercase font-black tracking-widest leading-none mb-1">Расчет</span>
                                                                                <span className="text-xs sm:text-sm font-black text-blue-600 leading-none whitespace-nowrap">
                                                                                    {calculated.toLocaleString()} ₽
                                                                                </span>
                                                                            </div>
                                                                            <div className="flex flex-col items-end shrink-0">
                                                                                <span className="text-[9px] text-slate-400 uppercase font-black tracking-widest leading-none mb-1">Факт</span>
                                                                                <span className="text-xs sm:text-sm font-black text-slate-700 leading-none whitespace-nowrap">
                                                                                    {reported.toLocaleString()} ₽
                                                                                </span>
                                                                            </div>
                                                                            <div className="flex flex-col items-end shrink-0">
                                                                                <span className="text-[9px] text-slate-400 uppercase font-black tracking-widest leading-none mb-1">Разница</span>
                                                                                <span className={cn(
                                                                                    "text-xs sm:text-sm font-black leading-none whitespace-nowrap",
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

                                    <TabsContent value="maintenance" className="mt-0 space-y-4 animate-in fade-in-50 duration-300">
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

            {/* Edit Shift Modal - Redesigned */}
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
                                            <Input
                                                placeholder="ДД.ММ.ГГГГ, ЧЧ:ММ"
                                                value={dateTimeToDisplay(editCheckIn)}
                                                onChange={(e) => {
                                                    const formatted = formatDisplayDateTime(e.target.value);
                                                    setEditCheckIn(dateTimeToInternal(formatted));
                                                }}
                                                className="bg-background"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs text-muted-foreground uppercase">Конец</Label>
                                            <Input
                                                placeholder="ДД.ММ.ГГГГ, ЧЧ:ММ"
                                                value={dateTimeToDisplay(editCheckOut)}
                                                onChange={(e) => {
                                                    const formatted = formatDisplayDateTime(e.target.value);
                                                    setEditCheckOut(dateTimeToInternal(formatted));
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
                                    <Input
                                        placeholder="ДД.ММ.ГГГГ, ЧЧ:ММ"
                                        value={dateTimeToDisplay(newShiftCheckIn)}
                                        onChange={(e) => {
                                            const formatted = formatDisplayDateTime(e.target.value);
                                            setNewShiftCheckIn(dateTimeToInternal(formatted));
                                        }}
                                        className="bg-background"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm">Конец</Label>
                                    <Input
                                        placeholder="ДД.ММ.ГГГГ, ЧЧ:ММ"
                                        value={dateTimeToDisplay(newShiftCheckOut)}
                                        onChange={(e) => {
                                            const formatted = formatDisplayDateTime(e.target.value);
                                            setNewShiftCheckOut(dateTimeToInternal(formatted));
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
        </div>
    )
}
