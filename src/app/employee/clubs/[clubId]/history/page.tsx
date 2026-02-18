"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Loader2, Clock, DollarSign, FileText, Eye, TrendingUp, Wallet, CheckCircle, CalendarDays, Sun, Moon, ArrowUpDown } from "lucide-react"

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
}

export default function EmployeeShiftHistoryPage() {
    const params = useParams()
    const clubId = params.clubId as string

    const [shifts, setShifts] = useState<Shift[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [selectedShift, setSelectedShift] = useState<Shift | null>(null)

    // Date filter state. Default to current month ('0')
    const [filterStartDate, setFilterStartDate] = useState('')
    const [filterEndDate, setFilterEndDate] = useState('')
    const [selectedMonth, setSelectedMonth] = useState<string>('0')

    const [reportFields, setReportFields] = useState<any[]>([])
    const [clubTimezone, setClubTimezone] = useState('Europe/Moscow')
    const [summary, setSummary] = useState<any>(null)

    // Sort state
    const [sortBy, setSortBy] = useState<string>('check_in')
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

    const fetchShifts = useCallback(async (startDate?: string, endDate?: string) => {
        setIsLoading(true)
        try {
            let url = `/api/employee/clubs/${clubId}/history`
            const queryParams = new URLSearchParams()

            // If explicit dates provided (usually from manual date picker)
            if (startDate && endDate) {
                queryParams.append('startDate', startDate)
                queryParams.append('endDate', endDate)
            } else if (selectedMonth) {
                // The API supports month param which defaults to current if missing.
                // We pass month param if needed, but since our API handles 'month' query param:
                // "const month = parseInt(searchParams.get('month') || (now.getMonth() + 1).toString());"
                // And selectedMonth is offset (0, -1, -2). 
                // We need to convert offset to actual month number for API or trust API to handle default.
                // Actually, let's use the startDate/endDate logic derived from month for consistency with backend range query
                // But wait, the previous code derived dates in handleMonthSelect and passed them.
                // So if startDate/endDate are present (which handleMonthSelect sets), we use them.
                // If intrinsic default load (useEffect), we want to ensure startDate/endDate are set correctly or API handles it.
            }
            if (queryParams.toString()) url += '?' + queryParams.toString()

            const res = await fetch(url)
            const data = await res.json()
            if (res.ok) {
                setShifts(Array.isArray(data.shifts) ? data.shifts : [])
                setSummary(data.summary || null)

                if (data.template_fields) {
                    const standardKeys = ['cash_income', 'card_income', 'expenses_cash', 'shift_comment', 'expenses']
                    const fields = data.template_fields.filter((f: any) =>
                        !standardKeys.includes(f.metric_key) &&
                        !standardKeys.some(k => f.metric_key.includes(k))
                    )
                    setReportFields(fields)
                }
            }
        } catch (error) {
            console.error('Error:', error)
        } finally {
            setIsLoading(false)
        }
    }, [clubId, selectedMonth])

    const handleMonthSelect = (monthOffset: number) => {
        const now = new Date()
        // Calculate target month year/month
        let year = now.getFullYear()
        let month = now.getMonth() + monthOffset

        // Handle year wrap
        const targetDate = new Date(year, month, 1)
        year = targetDate.getFullYear()
        month = targetDate.getMonth()

        // Construct local string dates YYYY-MM-DD
        const pad = (n: number) => n.toString().padStart(2, '0')

        const startStr = `${year}-${pad(month + 1)}-01`

        // End of month
        const lastDay = new Date(year, month + 1, 0).getDate()
        const endStr = `${year}-${pad(month + 1)}-${pad(lastDay)}`

        setSelectedMonth(String(monthOffset))
        setFilterStartDate(startStr)
        setFilterEndDate(endStr)
    }

    // Initial load: trigger default month selection to set dates
    useEffect(() => {
        if (selectedMonth === '0' && !filterStartDate) {
            handleMonthSelect(0)
        }
    }, [])

    useEffect(() => {
        if (clubId && filterStartDate && filterEndDate) {
            fetchShifts(filterStartDate, filterEndDate)
        } else if (clubId && !filterStartDate) {
            // Initial/Default load
            fetchShifts()
        }
        fetchClubSettings(clubId)
    }, [clubId, fetchShifts, filterStartDate, filterEndDate])

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

    const handleCustomDateFilter = () => {
        setSelectedMonth('')
    }

    const clearFilters = () => {
        handleMonthSelect(0) // Reset to current month
    }

    const getMonthName = (offset: number) => {
        const date = new Date()
        date.setMonth(date.getMonth() + offset)
        return date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
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

    // Handle sorting
    const handleSort = (column: string) => {
        if (sortBy === column) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
        } else {
            setSortBy(column)
            setSortOrder('desc')
        }
    }

    // Sort filtered shifts
    const sortedShifts = [...shifts].sort((a, b) => {
        let aVal: any = a[sortBy as keyof Shift]
        let bVal: any = b[sortBy as keyof Shift]

        if (aVal === null || aVal === undefined) return 1
        if (bVal === null || bVal === undefined) return -1

        if (['cash_income', 'card_income', 'total_hours'].includes(sortBy)) {
            aVal = parseFloat(String(aVal)) || 0
            bVal = parseFloat(String(bVal)) || 0
        }

        if (sortBy === 'check_in') {
            aVal = new Date(aVal).getTime()
            bVal = new Date(bVal).getTime()
        }

        if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
        if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
        return 0
    })

    // Calculate totals for Custom Fields locally for display if needed, 
    // but we primarily use API summary for the main cards now.
    const currentDisplayShifts = shifts
    const totalCash = currentDisplayShifts.reduce((sum, s) => sum + (parseFloat(String(s.cash_income)) || 0), 0)
    const totalCard = currentDisplayShifts.reduce((sum, s) => sum + (parseFloat(String(s.card_income)) || 0), 0)
    // Removed expenses calculation

    // Revenue = Cash + Card + Other Incomes
    const customFieldTotals = reportFields.map(field => {
        const total = currentDisplayShifts.reduce((sum, s) => {
            if (s.report_data && s.report_data[field.metric_key]) {
                return sum + (parseFloat(String(s.report_data[field.metric_key])) || 0)
            }
            return sum
        }, 0)
        return { ...field, total }
    })

    const totalCustomIncome = customFieldTotals
        .filter(f => f.field_type === 'INCOME')
        .reduce((sum, f) => sum + f.total, 0)

    const totalRevenue = totalCash + totalCard + totalCustomIncome

    const renderDiff = (diff?: number) => {
        if (diff === undefined || diff === null) return null
        if (diff === 0) return <span className="text-xs text-muted-foreground ml-2">0%</span>
        const isPositive = diff > 0
        return (
            <span className={`text-xs ml-2 font-medium ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
                {isPositive ? '+' : ''}{diff.toFixed(1)}%
            </span>
        )
    }

    return (
        <div className="p-4 md:p-8 space-y-6 md:space-y-8 min-h-screen bg-background">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">История смен</h1>
                    <p className="text-sm md:text-base text-muted-foreground">Архив ваших смен и отчетов</p>
                </div>
            </div>

            {/* Date Filters */}
            <Card className="border-dashed">
                <CardContent className="pt-6">
                    <div className="flex flex-wrap items-center gap-4">
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

                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Период:</span>
                            <Input
                                type="date"
                                value={filterStartDate}
                                onChange={e => {
                                    setFilterStartDate(e.target.value)
                                    handleCustomDateFilter()
                                }}
                                className="w-36 h-8"
                            />
                            <span className="text-muted-foreground">—</span>
                            <Input
                                type="date"
                                value={filterEndDate}
                                onChange={e => {
                                    setFilterEndDate(e.target.value)
                                    handleCustomDateFilter()
                                }}
                                className="w-36 h-8"
                            />
                        </div>

                        {(filterStartDate || filterEndDate || selectedMonth !== '0') && (
                            <Button size="sm" variant="ghost" onClick={clearFilters} className="text-muted-foreground">
                                Сбросить
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Summary Cards */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                <Card className="overflow-hidden relative border-none bg-purple-500/5 shadow-none">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
                        <CardTitle className="text-sm font-medium text-purple-600">Всего смен</CardTitle>
                        <Clock className="h-4 w-4 text-purple-500" />
                    </CardHeader>
                    <CardContent className="relative">
                        <div className="text-3xl font-bold flex items-baseline">
                            {shifts.length}
                            {renderDiff(summary?.shifts_count?.diff)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">за выбранный период</p>
                    </CardContent>
                </Card>

                <Card className="overflow-hidden relative border-none bg-indigo-500/5 shadow-none">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
                        <CardTitle className="text-sm font-medium text-indigo-600">Общая выручка</CardTitle>
                        <TrendingUp className="h-4 w-4 text-indigo-500" />
                    </CardHeader>
                    <CardContent className="relative">
                        <div className="text-3xl font-bold text-indigo-600 flex items-baseline">
                            {formatMoney(totalRevenue)}
                            {renderDiff(summary?.revenue?.diff)}
                        </div>
                    </CardContent>
                </Card>



                {/* Dynamic Cards (Income + Other) */}
                {customFieldTotals.filter(f => f.field_type !== 'EXPENSE' && f.show_in_stats !== false && f.show_for_employee !== false).map(field => (
                    <Card key={field.metric_key} className="overflow-hidden relative border-none bg-cyan-500/5 shadow-none">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
                            <CardTitle className="text-sm font-medium text-cyan-600">{field.custom_label}</CardTitle>
                            <TrendingUp className="h-4 w-4 text-cyan-500" />
                        </CardHeader>
                        <CardContent className="relative">
                            <div className="text-3xl font-bold text-cyan-600 flex items-baseline">
                                {formatMoney(field.total)}
                                {renderDiff(summary?.custom_metrics?.[field.metric_key]?.diff)}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Shifts Table (Desktop) */}
            <Card className="hidden md:block border-0 shadow-lg">
                <CardHeader>
                    <CardTitle>История смен</CardTitle>
                    <CardDescription>Последние смены с отчетами</CardDescription>
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
                                {reportFields.map((field: any) => (
                                    <TableHead key={field.metric_key} className="text-right min-w-[100px]">{field.custom_label || field.label || field.metric_key}</TableHead>
                                ))}
                                <TableHead>Статус</TableHead>
                                <TableHead className="text-right">Детали</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={8 + reportFields.length} className="text-center py-12">
                                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
                                    </TableCell>
                                </TableRow>
                            ) : sortedShifts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8 + reportFields.length} className="text-center text-muted-foreground py-12">
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
                                    <TableCell className="whitespace-nowrap text-right">
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
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Shifts List (Mobile) */}
            <div className="md:hidden space-y-4">
                <h3 className="font-semibold text-lg px-1">История смен</h3>
                {isLoading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : sortedShifts.length === 0 ? (
                    <Card className="border-0 shadow-sm bg-muted/30">
                        <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                            <Clock className="h-10 w-10 opacity-20 mb-3" />
                            <p>Смен пока нет</p>
                        </CardContent>
                    </Card>
                ) : (
                    sortedShifts.map((shift) => (
                        <Card key={shift.id} className="border-0 shadow-md overflow-hidden">
                            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0 bg-muted/20">
                                <div className="font-bold text-lg">
                                    {formatDate(shift.check_in)}
                                </div>
                                {getStatusBadge(shift.status, !!shift.check_out)}
                            </CardHeader>
                            <CardContent className="p-4 space-y-4">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        {shift.shift_type === 'NIGHT' ? (
                                            <div className="p-1.5 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                                                <Moon className="h-4 w-4" />
                                            </div>
                                        ) : (
                                            <div className="p-1.5 rounded-full bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
                                                <Sun className="h-4 w-4" />
                                            </div>
                                        )}
                                        <span className="font-medium">
                                            {formatTime(shift.check_in)} — {shift.check_out ? formatTime(shift.check_out) : '...'}
                                        </span>
                                    </div>
                                    <div className="font-mono font-bold text-muted-foreground">
                                        {shift.total_hours && !isNaN(Number(shift.total_hours))
                                            ? `${Number(shift.total_hours).toFixed(1)}ч`
                                            : '-'}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/50">
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-0.5">Наличные</p>
                                        <p className="font-bold text-green-600">{formatMoney(shift.cash_income)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-0.5">Безнал</p>
                                        <p className="font-bold text-blue-600">{formatMoney(shift.card_income)}</p>
                                    </div>
                                    {reportFields.map((field: any) => (
                                        <div key={field.metric_key}>
                                            <p className="text-xs text-muted-foreground mb-0.5">{field.custom_label || field.label}</p>
                                            <p className="font-medium">
                                                {shift.report_data && shift.report_data[field.metric_key] !== undefined
                                                    ? formatMoney(shift.report_data[field.metric_key])
                                                    : '-'}
                                            </p>
                                        </div>
                                    ))}
                                </div>

                                {shift.report_data && Object.keys(shift.report_data).length > 0 && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full mt-2"
                                        onClick={() => setSelectedShift(shift)}
                                    >
                                        <Eye className="h-4 w-4 mr-2" />
                                        Посмотреть отчет
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

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
                            {selectedShift && formatDate(selectedShift.check_in)}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-4">
                        {selectedShift?.report_data && Object.entries(selectedShift.report_data).map(([key, value]) => {
                            // Find label
                            const field = reportFields.find(f => f.metric_key === key);
                            const label = field ? (field.custom_label || field.label) : key.replace(/_/g, ' ');
                            return (
                                <div key={key} className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                                    <span className="text-muted-foreground capitalize">{label}</span>
                                    <span className="font-semibold">{String(value)}</span>
                                </div>
                            );
                        })}
                        {selectedShift?.report_comment && (
                            <div className="pt-2">
                                <p className="text-sm text-muted-foreground mb-2">Комментарий:</p>
                                <p className="text-sm bg-muted p-4 rounded-lg">{selectedShift.report_comment}</p>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
