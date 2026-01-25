"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Loader2, Clock, DollarSign, FileText, Eye, TrendingUp, Wallet, Edit, CheckCircle, CalendarDays, Sun, Moon, Trash2, ArrowUpDown } from "lucide-react"

interface Shift {
    id: string
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
    const [selectedMonth, setSelectedMonth] = useState<string>('')
    const [editShiftType, setEditShiftType] = useState<'DAY' | 'NIGHT'>('DAY')

    const [reportFields, setReportFields] = useState<any[]>([])

    // Sort state
    const [sortBy, setSortBy] = useState<string>('check_in')
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

    useEffect(() => {
        params.then(p => {
            setClubId(p.clubId)
            fetchShifts(p.clubId)
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
                // Filter out standard fields that are already displayed
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
            if (res.ok && data.employees) {
                setEmployees(data.employees.map((e: any) => ({ id: e.id, full_name: e.full_name })))
            }
        } catch (error) {
            console.error('Error fetching employees:', error)
        }
    }

    const fetchShifts = async (id: string, startDate?: string, endDate?: string) => {
        try {
            let url = `/api/clubs/${id}/shifts`
            const params = new URLSearchParams()
            if (startDate) params.append('startDate', startDate)
            if (endDate) params.append('endDate', endDate)
            if (params.toString()) url += '?' + params.toString()

            const res = await fetch(url)
            const data = await res.json()
            if (res.ok) {
                setShifts(data.shifts)
            }
        } catch (error) {
            console.error('Error:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleMonthSelect = (monthOffset: number) => {
        const now = new Date()
        const targetDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)
        const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1)
        const endOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59)

        const formatDate = (d: Date) => d.toISOString().slice(0, 10)

        setSelectedMonth(String(monthOffset))
        setFilterStartDate(formatDate(startOfMonth))
        setFilterEndDate(formatDate(endOfMonth))
        fetchShifts(clubId, formatDate(startOfMonth), formatDate(endOfMonth))
    }

    const handleCustomDateFilter = () => {
        setSelectedMonth('')
        if (filterStartDate || filterEndDate) {
            fetchShifts(clubId, filterStartDate, filterEndDate)
        }
    }

    const clearFilters = () => {
        setSelectedMonth('')
        setFilterStartDate('')
        setFilterEndDate('')
        fetchShifts(clubId)
    }

    const getMonthName = (offset: number) => {
        const date = new Date()
        date.setMonth(date.getMonth() + offset)
        return date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
    }

    const openEditModal = (shift: Shift) => {
        setEditingShift(shift)
        setEditCashIncome(String(shift.cash_income || 0))
        setEditCardIncome(String(shift.card_income || 0))
        setEditExpenses(String(shift.expenses || 0))
        setEditComment(shift.report_comment || '')
        // Format datetime for input using club's timezone
        const formatForInput = (dateStr: string | null) => {
            if (!dateStr) return ''

            // Parse the date
            const d = new Date(dateStr)

            // Use Intl.DateTimeFormat to get date/time parts in the club's timezone
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
            const year = parts.find(p => p.type === 'year')?.value
            const month = parts.find(p => p.type === 'month')?.value
            const day = parts.find(p => p.type === 'day')?.value
            const hour = parts.find(p => p.type === 'hour')?.value
            const minute = parts.find(p => p.type === 'minute')?.value

            return `${year}-${month}-${day}T${hour}:${minute}`
        }
        setEditCheckIn(formatForInput(shift.check_in))
        setEditCheckOut(formatForInput(shift.check_out))
        setEditShiftType(shift.shift_type || 'DAY')
        setEditCustomFields(shift.report_data || {})
    }

    // Helper function to convert datetime-local value to ISO string in club timezone
    const convertToClubTimezone = (datetimeLocal: string) => {
        if (!datetimeLocal) return undefined

        // The datetime-local input gives us "2025-12-02T08:00"
        // We need to interpret this as club's local time and convert to UTC

        // Parse components
        const [datePart, timePart] = datetimeLocal.split('T')
        const [year, month, day] = datePart.split('-')
        const [hour, minute] = timePart.split(':')

        // Build a date string that we'll format in the club's timezone
        const dateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:00`

        // Get this exact time but interpreted in the club's timezone
        // We do this by creating a string that represents this time in club's TZ
        // Then parsing it back to get the UTC equivalent
        const clubTZString = new Date(dateStr).toLocaleString('en-US', {
            timeZone: clubTimezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        })

        // This gives us the datetime as it appears in club TZ
        // But we want to create a Date that represents "user input time in club TZ"
        // The trick: create Date treating input as UTC, then offset by timezone difference

        // Simpler approach: manually calculate UTC offset and adjust
        const localDate = new Date(dateStr) // Treated as local browser time
        const inClubTZ = new Date(localDate.toLocaleString('en-US', { timeZone: clubTimezone }))
        const inLocalTZ = new Date(localDate.toLocaleString('en-US'))
        const offset = inClubTZ.getTime() - inLocalTZ.getTime()

        // Apply inverse offset to get correct UTC time
        const correctUTC = new Date(localDate.getTime() - offset)

        return correctUTC.toISOString()
    }

    const handleSaveEdit = async () => {
        if (!editingShift) return
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
                // Clear filters to show new shift
                setSelectedMonth('')
                setFilterStartDate('')
                setFilterEndDate('')
                fetchShifts(clubId)
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

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            timeZone: clubTimezone
        })
    }

    const formatTime = (dateStr: string) => {
        return new Date(dateStr).toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: clubTimezone
        })
    }

    const formatHours = (hours: number | null) => {
        if (!hours) return '-'
        return `${Number(hours).toFixed(1)}ч`
    }

    const formatMoney = (amount: number | string | null) => {
        if (amount === null || amount === undefined) return '0 ₽'
        const num = typeof amount === 'string' ? parseFloat(amount) : amount
        if (isNaN(num) || num === 0) return '0 ₽'
        return num.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽'
    }

    const getStatusBadge = (status: string, hasCheckOut: boolean) => {
        if (!hasCheckOut) {
            return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 animate-pulse">Активна</Badge>
        }
        if (status === 'VERIFIED') {
            return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">✓ Подтверждена</Badge>
        }
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">Закрыта</Badge>
    }

    if (isLoading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    // Handle sorting
    const handleSort = (column: string) => {
        if (sortBy === column) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
        } else {
            setSortBy(column)
            setSortOrder('desc')
        }
    }

    // Sort shifts
    const sortedShifts = [...shifts].sort((a, b) => {
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

    // Calculate totals
    const totalCash = shifts.reduce((sum, s) => sum + (parseFloat(String(s.cash_income)) || 0), 0)
    const totalCard = shifts.reduce((sum, s) => sum + (parseFloat(String(s.card_income)) || 0), 0)
    const totalExpenses = shifts.reduce((sum, s) => sum + (parseFloat(String(s.expenses)) || 0), 0)
    const totalRevenue = totalCash + totalCard

    return (
        <div className="p-8 space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Смены</h1>
                    <p className="text-muted-foreground">История смен и отчетов сотрудников</p>
                </div>
                <Button onClick={openCreateModal} className="gap-2">
                    <Clock className="h-4 w-4" />
                    Добавить смену
                </Button>
            </div>

            {/* Date Filters */}
            <Card className="border-dashed">
                <CardContent className="pt-6">
                    <div className="flex flex-wrap items-center gap-4">
                        {/* Month buttons */}
                        <div className="flex items-center gap-2">
                            <CalendarDays className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground mr-2">Месяц:</span>
                            {[0, -1, -2].map(offset => (
                                <Button
                                    key={offset}
                                    variant={selectedMonth === String(offset) ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => handleMonthSelect(offset)}
                                    className="capitalize"
                                >
                                    {getMonthName(offset)}
                                </Button>
                            ))}
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

                        {(filterStartDate || filterEndDate || selectedMonth) && (
                            <Button size="sm" variant="ghost" onClick={clearFilters} className="text-muted-foreground">
                                Сбросить
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card className="overflow-hidden relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent"></div>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
                        <CardTitle className="text-sm font-medium">Всего смен</CardTitle>
                        <Clock className="h-4 w-4 text-purple-500" />
                    </CardHeader>
                    <CardContent className="relative">
                        <div className="text-3xl font-bold">{shifts.length}</div>
                        <p className="text-xs text-muted-foreground mt-1">за все время</p>
                    </CardContent>
                </Card>

                <Card className="overflow-hidden relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-transparent"></div>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
                        <CardTitle className="text-sm font-medium">Выручка (Нал)</CardTitle>
                        <Wallet className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent className="relative">
                        <div className="text-3xl font-bold text-green-500">{formatMoney(totalCash)}</div>
                    </CardContent>
                </Card>

                <Card className="overflow-hidden relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent"></div>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
                        <CardTitle className="text-sm font-medium">Выручка (Безнал)</CardTitle>
                        <DollarSign className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent className="relative">
                        <div className="text-3xl font-bold text-blue-500">{formatMoney(totalCard)}</div>
                    </CardContent>
                </Card>

                <Card className="overflow-hidden relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent"></div>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
                        <CardTitle className="text-sm font-medium">Расходы</CardTitle>
                        <TrendingUp className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent className="relative">
                        <div className="text-3xl font-bold text-orange-500">{formatMoney(totalExpenses)}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Net Revenue */}
            <Card className="bg-gradient-to-r from-purple-500/20 via-blue-500/20 to-green-500/20 border-none">
                <CardContent className="py-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-muted-foreground mb-1">Чистая выручка</p>
                            <p className="text-4xl font-bold">{formatMoney(totalRevenue - totalExpenses)}</p>
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                            <p>Всего: {formatMoney(totalRevenue)}</p>
                            <p>− Расходы: {formatMoney(totalExpenses)}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

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
                                        {getStatusBadge(shift.status, !!shift.check_out)}
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
