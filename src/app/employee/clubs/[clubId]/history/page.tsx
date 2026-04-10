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
import { Loader2, Clock, DollarSign, FileText, Eye, TrendingUp, Wallet, CheckCircle, CalendarDays, Sun, Moon, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

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
                    // Filter reportFields to NOT include standard keys
                    const fields = data.template_fields.filter((f: any) =>
                        !standardKeys.includes(f.metric_key)
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
            weekday: 'short',
            day: '2-digit',
            month: '2-digit',
            timeZone: clubTimezone
        })
    }

    const isWeekendDate = (dateStr: string) => {
        const weekday = new Intl.DateTimeFormat('en-US', {
            weekday: 'short',
            timeZone: clubTimezone
        }).format(new Date(dateStr))

        return weekday === 'Sat' || weekday === 'Sun'
    }

    const formatTime = (dateStr: string) => {
        return new Date(dateStr).toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: clubTimezone
        })
    }

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
        if (amount === null || amount === undefined) return '0 ₽'
        
        let num: number;
        if (Array.isArray(amount)) {
            num = amount.reduce((sum, item: any) => sum + (Number(item.amount) || 0), 0);
        } else {
            num = typeof amount === 'string' ? parseFloat(amount) : Number(amount)
        }
        
        if (isNaN(num) || num === 0) return '0 ₽'
        return num.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽'
    }, []);

    const calculateShiftTotalIncome = (shift: Shift) => {
        const cash = getMetricValue(shift, 'cash_income');
        const card = getMetricValue(shift, 'card_income');
        const customIncome = reportFields
            .filter(f => f.field_type === 'INCOME')
            .reduce((sum, f) => sum + getMetricValue(shift, f.metric_key), 0);
        return cash + card + customIncome;
    };

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
    const sortedShifts = [...shifts].sort((a: any, b: any) => {
        let aVal: any = a[sortBy]
        let bVal: any = b[sortBy]

        if (sortBy === 'total_revenue') {
            aVal = calculateShiftTotalIncome(a);
            bVal = calculateShiftTotalIncome(b);
        } else if (sortBy === 'expenses') {
            aVal = getMetricValue(a, 'expenses');
            bVal = getMetricValue(b, 'expenses');
        } else if (['cash_income', 'card_income', 'total_hours'].includes(sortBy)) {
            aVal = getMetricValue(a, sortBy);
            bVal = getMetricValue(b, sortBy);
        }

        if (aVal === null || aVal === undefined) return 1
        if (bVal === null || bVal === undefined) return -1

        if (sortBy === 'check_in') {
            aVal = new Date(aVal).getTime()
            bVal = new Date(bVal).getTime()
        }

        if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
        if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
        return 0
    })

    // Calculate totals for Custom Fields locally for display if needed
    const currentDisplayShifts = shifts
    const totalCash = currentDisplayShifts.reduce((sum, s) => sum + getMetricValue(s, 'cash_income'), 0)
    const totalCard = currentDisplayShifts.reduce((sum, s) => sum + getMetricValue(s, 'card_income'), 0)
    const totalExpenses = currentDisplayShifts.reduce((sum, s) => sum + getMetricValue(s, 'expenses'), 0)

    // Revenue = Cash + Card + Other Incomes
    const customFieldTotals = reportFields.map(field => {
        const total = currentDisplayShifts.reduce((sum, s) => sum + getMetricValue(s, field.metric_key), 0)
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
        <div className="w-full max-w-6xl mx-auto px-4 py-8 md:px-8 md:py-12 space-y-8 relative z-0">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">История смен</h1>
                    <p className="text-sm text-muted-foreground mt-1">Архив ваших смен и отчетов</p>
                </div>
            </div>

            {/* Date Filters */}
            <div className="flex flex-col md:flex-row flex-wrap items-start md:items-center gap-4 p-4 rounded-xl bg-card border border-border shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Месяц:</span>
                    <div className="flex items-center gap-1 bg-accent/50 rounded-lg p-1 border border-border">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleMonthSelect(parseInt(selectedMonth) - 1)}
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-xs font-bold w-32 text-center uppercase tracking-wider text-foreground">
                            {selectedMonth === '0' ? 'Текущий месяц' : getMonthName(parseInt(selectedMonth))}
                        </span>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleMonthSelect(parseInt(selectedMonth) + 1)}
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            disabled={parseInt(selectedMonth) >= 0}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <div className="hidden md:block h-6 w-px bg-border" />

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full md:w-auto">
                    <span className="text-sm text-muted-foreground">Период:</span>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Input
                            type="date"
                            value={filterStartDate}
                            onChange={e => {
                                setFilterStartDate(e.target.value)
                                handleCustomDateFilter()
                            }}
                            className="w-full sm:w-[140px] h-9 text-xs bg-background border-border"
                        />
                        <span className="text-muted-foreground">—</span>
                        <Input
                            type="date"
                            value={filterEndDate}
                            onChange={e => {
                                setFilterEndDate(e.target.value)
                                handleCustomDateFilter()
                            }}
                            className="w-full sm:w-[140px] h-9 text-xs bg-background border-border"
                        />
                    </div>
                </div>
                
                {(filterStartDate || filterEndDate || selectedMonth !== '0') && (
                    <Button size="sm" variant="ghost" onClick={clearFilters} className="text-muted-foreground hover:text-foreground w-full md:w-auto md:ml-auto h-9">
                        Сбросить
                    </Button>
                )}
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                <Card className="overflow-hidden relative bg-card border-border shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative bg-accent/30 border-b border-border/50">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Всего смен</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground/70" />
                    </CardHeader>
                    <CardContent className="relative p-4">
                        <div className="text-2xl font-bold flex items-baseline text-foreground">
                            {shifts.length}
                            {renderDiff(summary?.shifts_count?.diff)}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">за выбранный период</p>
                    </CardContent>
                </Card>

                <Card className="overflow-hidden relative bg-card border-border shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative bg-primary/5 border-b border-primary/10">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-primary">Общая выручка</CardTitle>
                        <TrendingUp className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent className="relative p-4 bg-primary/5">
                        <div className="text-2xl font-bold text-primary flex items-baseline">
                            {formatMoney(totalRevenue)}
                            {renderDiff(summary?.revenue?.diff)}
                        </div>
                    </CardContent>
                </Card>

                {/* Dynamic Cards (Income + Other) */}
                {customFieldTotals.filter(f => f.field_type !== 'EXPENSE' && f.show_in_stats !== false && f.show_for_employee !== false).map(field => (
                    <Card key={field.metric_key} className="overflow-hidden relative bg-card border-border shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative bg-accent/30 border-b border-border/50">
                            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{field.custom_label}</CardTitle>
                            <TrendingUp className="h-4 w-4 text-muted-foreground/70" />
                        </CardHeader>
                        <CardContent className="relative p-4">
                            <div className="text-2xl font-bold text-foreground flex items-baseline">
                                {formatMoney(field.total)}
                                {renderDiff(summary?.custom_metrics?.[field.metric_key]?.diff)}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Shifts Table (Desktop) */}
            <Card className="hidden md:block bg-card border-border shadow-sm overflow-hidden">
                <CardHeader className="bg-accent/30 border-b border-border">
                    <CardTitle className="text-lg">История смен</CardTitle>
                    <CardDescription className="text-muted-foreground">Последние смены с отчетами</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-accent/10 border-b border-border hover:bg-accent/10">
                                <TableHead
                                    className="cursor-pointer hover:bg-accent/50 select-none text-xs uppercase tracking-wider text-muted-foreground"
                                    onClick={() => handleSort('check_in')}
                                >
                                    <div className="flex items-center gap-1">
                                        Дата
                                        <ArrowUpDown className="h-3 w-3" />
                                    </div>
                                </TableHead>
                                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Тип</TableHead>
                                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Время</TableHead>
                                <TableHead
                                    className="cursor-pointer hover:bg-accent/50 select-none text-xs uppercase tracking-wider text-muted-foreground"
                                    onClick={() => handleSort('total_hours')}
                                >
                                    <div className="flex items-center gap-1">
                                        Часы
                                        <ArrowUpDown className="h-3 w-3" />
                                    </div>
                                </TableHead>
                                <TableHead
                                    className="text-right cursor-pointer hover:bg-accent/50 select-none text-emerald-500 font-bold text-xs uppercase tracking-wider"
                                    onClick={() => handleSort('total_revenue')}
                                >
                                    <div className="flex items-center justify-end gap-1">
                                        Итого Выручка
                                        <ArrowUpDown className="h-3 w-3" />
                                    </div>
                                </TableHead>
                                <TableHead
                                    className="text-right cursor-pointer hover:bg-accent/50 select-none text-xs uppercase tracking-wider text-muted-foreground"
                                    onClick={() => handleSort('cash_income')}
                                >
                                    <div className="flex items-center justify-end gap-1">
                                        Нал
                                        <ArrowUpDown className="h-3 w-3" />
                                    </div>
                                </TableHead>
                                <TableHead
                                    className="text-right cursor-pointer hover:bg-accent/50 select-none text-xs uppercase tracking-wider text-muted-foreground"
                                    onClick={() => handleSort('card_income')}
                                >
                                    <div className="flex items-center justify-end gap-1">
                                        Безнал
                                        <ArrowUpDown className="h-3 w-3" />
                                    </div>
                                </TableHead>
                                <TableHead
                                    className="text-right cursor-pointer hover:bg-accent/50 select-none text-xs uppercase tracking-wider text-muted-foreground"
                                    onClick={() => handleSort('expenses')}
                                >
                                    <div className="flex items-center justify-end gap-1">
                                        Расходы
                                        <ArrowUpDown className="h-3 w-3" />
                                    </div>
                                </TableHead>
                                {reportFields.map((field: any) => (
                                    <TableHead key={field.metric_key} className="text-right min-w-[100px] text-xs uppercase tracking-wider text-muted-foreground">{field.custom_label || field.label || field.metric_key}</TableHead>
                                ))}
                                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Статус</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="divide-y divide-border">
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={9 + reportFields.length} className="text-center py-12">
                                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
                                    </TableCell>
                                </TableRow>
                            ) : sortedShifts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9 + reportFields.length} className="text-center text-muted-foreground py-12">
                                        <div className="flex flex-col items-center gap-2">
                                            <Clock className="h-8 w-8 opacity-30" />
                                            <p>Смен пока нет</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : sortedShifts.map((shift) => {
                                const isWeekend = isWeekendDate(shift.check_in)

                                return (
                                <TableRow key={shift.id} className="hover:bg-accent/30 border-b border-border">
                                    <TableCell className={cn(
                                        "font-bold whitespace-nowrap",
                                        isWeekend ? "text-rose-500 bg-rose-500/5" : "text-foreground"
                                    )}>
                                        {formatDate(shift.check_in)}
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap">
                                        {shift.shift_type === 'NIGHT' ? (
                                            <div className="flex items-center gap-1 text-blue-500">
                                                <Moon className="h-4 w-4" />
                                                <span className="text-xs">Ночь</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1 text-amber-500">
                                                <Sun className="h-4 w-4" />
                                                <span className="text-xs">День</span>
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                        {formatTime(shift.check_in)} — {shift.check_out ? formatTime(shift.check_out) : '...'}
                                    </TableCell>
                                    <TableCell className="font-mono whitespace-nowrap text-foreground font-medium">
                                        {shift.total_hours && !isNaN(Number(shift.total_hours))
                                            ? `${Number(shift.total_hours).toFixed(1)}ч`
                                            : '-'}
                                    </TableCell>
                                    <TableCell className="text-right font-bold text-emerald-500 whitespace-nowrap bg-emerald-500/5">{formatMoney(calculateShiftTotalIncome(shift))}</TableCell>
                                    <TableCell className="text-right font-medium text-emerald-500/80 whitespace-nowrap">{formatMoney(getMetricValue(shift, 'cash_income'))}</TableCell>
                                    <TableCell className="text-right font-medium text-blue-400 whitespace-nowrap">{formatMoney(getMetricValue(shift, 'card_income'))}</TableCell>
                                    <TableCell className="text-right font-medium text-amber-500 whitespace-nowrap">{formatMoney(getMetricValue(shift, 'expenses'))}</TableCell>
                                    {reportFields.map((field: any) => (
                                        <TableCell key={field.metric_key} className="text-right whitespace-nowrap text-foreground/80">
                                            {shift.report_data && shift.report_data[field.metric_key] !== undefined
                                                ? formatMoney(getMetricValue(shift, field.metric_key))
                                                : '-'}
                                        </TableCell>
                                    ))}
                                    <TableCell className="whitespace-nowrap">
                                        {getStatusBadge(shift.status, !!shift.check_out)}
                                    </TableCell>
                                </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Shifts List (Mobile) */}
            <div className="md:hidden space-y-4">
                <h3 className="font-semibold text-lg px-1 text-foreground">История смен</h3>
                {isLoading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : sortedShifts.length === 0 ? (
                    <Card className="border border-border shadow-sm bg-card">
                        <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                            <Clock className="h-10 w-10 opacity-20 mb-3" />
                            <p>Смен пока нет</p>
                        </CardContent>
                    </Card>
                ) : (
                    sortedShifts.map((shift) => {
                        const isWeekend = isWeekendDate(shift.check_in)

                        return (
                        <Card key={shift.id} className="border border-border bg-card shadow-sm overflow-hidden">
                            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0 bg-accent/10 border-b border-border/50">
                                <div className={cn(
                                    "font-bold text-lg",
                                    isWeekend ? "text-rose-500" : "text-foreground"
                                )}>
                                    {formatDate(shift.check_in)}
                                </div>
                                {getStatusBadge(shift.status, !!shift.check_out)}
                            </CardHeader>
                            <CardContent className="p-4 space-y-4">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        {shift.shift_type === 'NIGHT' ? (
                                            <div className="p-1.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                                <Moon className="h-4 w-4" />
                                            </div>
                                        ) : (
                                            <div className="p-1.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                                <Sun className="h-4 w-4" />
                                            </div>
                                        )}
                                        <span className="font-medium text-foreground">
                                            {formatTime(shift.check_in)} — {shift.check_out ? formatTime(shift.check_out) : '...'}
                                        </span>
                                    </div>
                                    <div className="font-mono font-bold text-muted-foreground bg-accent/50 px-2 py-0.5 rounded-md border border-border">
                                        {shift.total_hours && !isNaN(Number(shift.total_hours))
                                            ? `${Number(shift.total_hours).toFixed(1)}ч`
                                            : '-'}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-border">
                                    <div className="bg-accent/30 p-2 rounded-lg border border-border/50">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Наличные</p>
                                        <p className="font-bold text-emerald-500">{formatMoney(getMetricValue(shift, 'cash_income'))}</p>
                                    </div>
                                    <div className="bg-accent/30 p-2 rounded-lg border border-border/50">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Безнал</p>
                                        <p className="font-bold text-blue-400">{formatMoney(getMetricValue(shift, 'card_income'))}</p>
                                    </div>
                                    <div className="bg-accent/30 p-2 rounded-lg border border-border/50">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Расходы</p>
                                        <p className="font-bold text-amber-500">{formatMoney(getMetricValue(shift, 'expenses'))}</p>
                                    </div>
                                    {reportFields.map((field: any) => (
                                        <div key={field.metric_key} className="bg-accent/30 p-2 rounded-lg border border-border/50">
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5 truncate" title={field.custom_label || field.label}>{field.custom_label || field.label}</p>
                                            <p className="font-bold text-foreground">
                                                {shift.report_data && shift.report_data[field.metric_key] !== undefined
                                                    ? formatMoney(getMetricValue(shift, field.metric_key))
                                                    : '-'}
                                            </p>
                                        </div>
                                    ))}
                                </div>

                                {shift.report_data && Object.keys(shift.report_data).length > 0 && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full mt-2 border-primary/20 text-primary hover:bg-primary/10 transition-colors bg-transparent"
                                        onClick={() => setSelectedShift(shift)}
                                    >
                                        <Eye className="h-4 w-4 mr-2" />
                                        Посмотреть отчет
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                        )
                    })
                )}
            </div>

            {/* View Report Modal */}
            <Dialog open={!!selectedShift} onOpenChange={() => setSelectedShift(null)}>
                <DialogContent className="sm:max-w-lg p-0 overflow-hidden bg-card border-border dark text-foreground">
                    <DialogHeader className="px-6 py-4 border-b border-border bg-accent/30">
                        <DialogTitle className="flex items-center gap-3 text-lg">
                            <div className="h-8 w-8 rounded-lg bg-background border border-border flex items-center justify-center">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                            </div>
                            Отчет о смене
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground mt-1">
                            {selectedShift && formatDate(selectedShift.check_in)}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 p-6 max-h-[60vh] overflow-y-auto">
                        {selectedShift?.report_data && Object.entries(selectedShift.report_data).map(([key, value]) => {
                            // Find label
                            const field = reportFields.find(f => f.metric_key === key);
                            const label = field ? (field.custom_label || field.label) : key.replace(/_/g, ' ');
                            
                            const renderValue = () => {
                                if (Array.isArray(value)) {
                                    const total = value.reduce((sum, item: any) => sum + (Number(item.amount) || 0), 0);
                                    if (total === 0 && value.length === 0) return '-';
                                    return (
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="font-bold text-foreground">{total.toLocaleString()} ₽</span>
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
                                <div key={key} className="flex justify-between items-center bg-accent/30 rounded-lg px-4 py-3 border border-border/50">
                                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground mr-4">{label}</span>
                                    <span className="font-bold text-foreground text-right">{renderValue()}</span>
                                </div>
                            );
                        })}
                        {selectedShift?.report_comment && (
                            <div className="pt-2">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Комментарий</p>
                                <p className="text-sm bg-accent/30 border border-border/50 p-4 rounded-lg text-foreground">{selectedShift.report_comment}</p>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
