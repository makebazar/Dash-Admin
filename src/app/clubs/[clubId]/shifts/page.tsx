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
import { Loader2, Clock, DollarSign, FileText, Eye, TrendingUp, Wallet, Edit, CheckCircle, CalendarDays, Sun, Moon, Trash2, ArrowUpDown, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react"
import { ShiftExcelImport } from "@/components/payroll/ShiftExcelImport"


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

export default function ShiftsPage({ params }: { params: Promise<{ clubId: string }> }) {
    const [clubId, setClubId] = useState('')
    const [shifts, setShifts] = useState<Shift[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [selectedShift, setSelectedShift] = useState<Shift | null>(null)
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
                    return sum + (parseFloat(String(s.report_data[field.metric_key])) || 0)
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
            .filter(f => f.field_type === 'EXPENSE')
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
            <Card className="border-dashed">
                <CardContent className="pt-6">
                    <div className="flex flex-wrap items-center gap-4">
                        {/* Month buttons */}
                        <div className="flex items-center gap-2">
                            <CalendarDays className="h-4 w-4 text-muted-foreground" />
                            <div className="flex items-center border rounded-md bg-background">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-none rounded-l-md"
                                    onClick={() => handleMonthSelect((parseInt(selectedMonth || '0') || 0) - 1)}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <div className="px-3 min-w-[140px] text-center text-sm font-medium border-x h-8 flex items-center justify-center capitalize">
                                    {getMonthName(parseInt(selectedMonth || '0') || 0)}
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-none rounded-r-md"
                                    onClick={() => handleMonthSelect((parseInt(selectedMonth || '0') || 0) + 1)}
                                    disabled={(parseInt(selectedMonth || '0') || 0) >= 0}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        <div className="h-6 w-px bg-border hidden md:block" />

                        {/* Custom date range */}
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Период:</span>
                            <Input
                                type="date"
                                value={filterStartDate}
                                onChange={e => setFilterStartDate(e.target.value)}
                                className="w-36 h-8"
                            />
                            <span className="text-muted-foreground">—</span>
                            <Input
                                type="date"
                                value={filterEndDate}
                                onChange={e => setFilterEndDate(e.target.value)}
                                className="w-36 h-8"
                            />
                            <Button size="sm" variant="secondary" onClick={handleCustomDateFilter}>
                                Применить
                            </Button>
                        </div>

                        <div className="h-6 w-px bg-border hidden md:block" />

                        {/* Employee filter */}
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Сотрудник:</span>
                            <select
                                value={filterEmployee}
                                onChange={e => setFilterEmployee(e.target.value)}
                                className="w-48 h-8 px-2 rounded-md border border-input bg-background text-xs focus:outline-none ring-offset-background"
                            >
                                <option value="">Все сотрудники</option>
                                {employees.map(emp => (
                                    <option key={emp.id} value={emp.id}>
                                        {emp.full_name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {(filterStartDate || filterEndDate || selectedMonth) && (
                            <Button size="sm" variant="ghost" onClick={clearFilters} className="text-muted-foreground">
                                Сбросить
                            </Button>
                        )}
                    </div>
                </CardContent>
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

                <Card className="overflow-hidden relative border-none bg-green-600/10 shadow-none border-green-600/20 border">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
                        <CardTitle className="text-sm font-bold text-green-700 uppercase">Итого Выручка</CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent className="relative">
                        <div className="text-3xl font-black text-green-600">{formatMoney(totalRevenue)}</div>
                    </CardContent>
                </Card>

                <Card className="overflow-hidden relative border-none bg-emerald-500/5 shadow-none">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
                        <CardTitle className="text-sm font-medium text-emerald-600">Выручка (Нал)</CardTitle>
                        <Wallet className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent className="relative">
                        <div className="text-3xl font-bold text-emerald-600">{formatMoney(totals.totalCash)}</div>
                    </CardContent>
                </Card>

                <Card className="overflow-hidden relative border-none bg-blue-500/5 shadow-none">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
                        <CardTitle className="text-sm font-medium text-blue-600">Выручка (Безнал)</CardTitle>
                        <DollarSign className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent className="relative">
                        <div className="text-3xl font-bold text-blue-600">{formatMoney(totals.totalCard)}</div>
                    </CardContent>
                </Card>

                {/* Dynamic Income Cards (like СБП) */}
                {customFieldTotals.filter(f => f.field_type === 'INCOME' && f.show_in_stats).map(field => (
                    <Card key={field.metric_key} className="overflow-hidden relative border-none bg-cyan-500/5 shadow-none">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
                            <CardTitle className="text-sm font-medium text-cyan-600">{field.custom_label}</CardTitle>
                            <TrendingUp className="h-4 w-4 text-cyan-500" />
                        </CardHeader>
                        <CardContent className="relative">
                            <div className="text-3xl font-bold text-cyan-600">{formatMoney(field.total)}</div>
                        </CardContent>
                    </Card>
                ))}

                <Card className="overflow-hidden relative border-none bg-orange-500/5 shadow-none">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
                        <CardTitle className="text-sm font-medium text-orange-600">Расходы</CardTitle>
                        <TrendingUp className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent className="relative">
                        <div className="text-3xl font-bold text-orange-500">{formatMoney(totalExpenses)}</div>
                    </CardContent>
                </Card>

                {/* Dynamic Expense Cards */}
                {customFieldTotals.filter(f => f.field_type === 'EXPENSE' && f.show_in_stats).map(field => (
                    <Card key={field.metric_key} className="overflow-hidden relative border-none bg-red-500/5 shadow-none">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
                            <CardTitle className="text-sm font-medium text-red-600">{field.custom_label}</CardTitle>
                            <TrendingUp className="h-4 w-4 text-red-500" />
                        </CardHeader>
                        <CardContent className="relative">
                            <div className="text-3xl font-bold text-red-600">{formatMoney(field.total || 0)}</div>
                        </CardContent>
                    </Card>
                ))}

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
                                        Итого Доход
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
                                <TableRow key={shift.id} className="hover:bg-muted/50">
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
                                        <div className="flex items-center justify-end gap-1">
                                            {shift.report_data && Object.keys(shift.report_data).length > 0 && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 hover:bg-purple-500/10 hover:text-purple-500"
                                                    onClick={() => setSelectedShift(shift)}
                                                    title="Просмотр отчета"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 hover:bg-blue-500/10 hover:text-blue-500"
                                                onClick={() => openEditModal(shift)}
                                                title="Редактировать"
                                            >
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            {shift.check_out && shift.status !== 'VERIFIED' && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 hover:bg-green-500/10 hover:text-green-500"
                                                    onClick={() => handleVerify(shift)}
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
                                                    onClick={() => handleUnverify(shift)}
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

            {/* View Report Modal */}
            <Dialog open={!!selectedShift} onOpenChange={() => setSelectedShift(null)}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                                <FileText className="h-5 w-5 text-white" />
                            </div>
                            Отчет о смене
                        </DialogTitle>
                        <DialogDescription>
                            {selectedShift?.employee_name} • {selectedShift && formatDate(selectedShift.check_in)}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-4">
                        {selectedShift?.report_data && Object.entries(selectedShift.report_data).map(([key, value]) => (
                            <div key={key} className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                                <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                                <span className="font-semibold">{String(value)}</span>
                            </div>
                        ))}
                        {selectedShift?.report_comment && (
                            <div className="pt-2">
                                <p className="text-sm text-muted-foreground mb-2">Комментарий:</p>
                                <p className="text-sm bg-muted p-4 rounded-lg">{selectedShift.report_comment}</p>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Edit Shift Modal */}
            <Dialog open={!!editingShift} onOpenChange={() => setEditingShift(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Редактирование смены</DialogTitle>
                        <DialogDescription>
                            {editingShift?.employee_name} • {editingShift && formatDate(editingShift.check_in)}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {/* Time Section */}
                        <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                            <Label className="text-xs uppercase text-muted-foreground tracking-wider">Время смены</Label>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-sm">Начало</Label>
                                    <Input
                                        type="datetime-local"
                                        value={editCheckIn}
                                        onChange={e => setEditCheckIn(e.target.value)}
                                        className="bg-background"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm">Конец</Label>
                                    <Input
                                        type="datetime-local"
                                        value={editCheckOut}
                                        onChange={e => setEditCheckOut(e.target.value)}
                                        className="bg-background"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Shift Type */}
                        <div className="space-y-2">
                            <Label>Тип смены</Label>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant={editShiftType === 'DAY' ? 'default' : 'outline'}
                                    onClick={() => setEditShiftType('DAY')}
                                    className="flex-1 gap-2"
                                >
                                    <Sun className="h-4 w-4" />
                                    Дневная
                                </Button>
                                <Button
                                    type="button"
                                    variant={editShiftType === 'NIGHT' ? 'default' : 'outline'}
                                    onClick={() => setEditShiftType('NIGHT')}
                                    className="flex-1 gap-2"
                                >
                                    <Moon className="h-4 w-4" />
                                    Ночная
                                </Button>
                            </div>
                        </div>

                        {/* Financial Section */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Выручка (Нал)</Label>
                                <Input
                                    type="number"
                                    value={editCashIncome}
                                    onChange={e => setEditCashIncome(e.target.value)}
                                    className="bg-green-500/5 border-green-500/20 focus:border-green-500"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Выручка (Безнал)</Label>
                                <Input
                                    type="number"
                                    value={editCardIncome}
                                    onChange={e => setEditCardIncome(e.target.value)}
                                    className="bg-blue-500/5 border-blue-500/20 focus:border-blue-500"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Расходы</Label>
                            <Input
                                type="number"
                                value={editExpenses}
                                onChange={e => setEditExpenses(e.target.value)}
                                className="bg-orange-500/5 border-orange-500/20 focus:border-orange-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Комментарий</Label>
                            <Input
                                value={editComment}
                                onChange={e => setEditComment(e.target.value)}
                                placeholder="Примечание к смене..."
                            />
                        </div>

                        {editingShift?.status === 'CLOSED' && (
                            <div className="space-y-2">
                                <Label>Заметки владельца</Label>
                                <Textarea
                                    value={editOwnerNotes}
                                    onChange={(e) => setEditOwnerNotes(e.target.value)}
                                    placeholder="Причина корректировки (опционально)"
                                    rows={2}
                                    className="resize-none"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Эти заметки будут видны сотруднику
                                </p>
                            </div>
                        )}

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
                                                value={editCustomFields[field.metric_key] || ''}
                                                onChange={e => setEditCustomFields(prev => ({
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
                    <DialogFooter className="flex justify-between">
                        <Button
                            variant="destructive"
                            onClick={handleDeleteShift}
                            disabled={isSaving}
                            className="mr-auto"
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Удалить
                        </Button>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setEditingShift(null)}>Отмена</Button>
                            <Button onClick={handleSaveEdit} disabled={isSaving}>
                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Сохранить
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
                                        type="datetime-local"
                                        value={newShiftCheckIn}
                                        onChange={e => setNewShiftCheckIn(e.target.value)}
                                        className="bg-background"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm">Конец</Label>
                                    <Input
                                        type="datetime-local"
                                        value={newShiftCheckOut}
                                        onChange={e => setNewShiftCheckOut(e.target.value)}
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
