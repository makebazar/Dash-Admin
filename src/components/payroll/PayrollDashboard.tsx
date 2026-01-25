'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Users,
    DollarSign,
    CheckCircle,
    Clock,
    Search,
    Filter,
    ChevronLeft,
    ChevronRight,
    Loader2,
    Trash2
} from 'lucide-react';

interface PayrollStats {
    total_employees: number;
    total_accrued: number;
    total_paid: number;
    pending_payment: number;
}

interface Employee {
    id: number;
    full_name: string;
    role: string;
    shifts_count: number;
    total_accrued: number;
    total_paid: number;
    balance: number;
    payment_status: 'PAID' | 'PARTIAL' | 'PENDING';
    has_active_kpi: boolean;
    kpi_bonus_amount?: number;
    period_bonuses?: any[];
    kpi_summary?: Array<{
        metric: string;
        progress: number;
        target: number;
    }>;
    breakdown?: {
        base_salary: number;
        kpi_bonuses: number;
        other_bonuses: number;
    };
    metrics?: {
        total_revenue: number;
        avg_revenue_per_shift: number;
        total_hours: number;
        avg_hours_per_shift: number;
        revenue_by_metric: Record<string, {
            total: number;
            avg_per_shift: number;
        }>;
    };
    payment_history?: Array<{
        id?: number;
        date: string;
        amount: number;
        method: string;
        payment_type?: string;
    }>;
    shifts?: Array<{
        id: number;
        date: string;
        total_hours: number;
        total_revenue: number;
        calculated_salary: number;
        kpi_bonus: number;
        status: string;
        is_paid: boolean;
        type: string;
    }>;
}

interface PayrollData {
    period: { month: number; year: number };
    stats: PayrollStats;
    employees: Employee[];
}

export default function PayrollDashboard({ clubId }: { clubId: string }) {
    const [data, setData] = useState<PayrollData | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [activeTab, setActiveTab] = useState<'summary' | 'schedules'>('summary');
    const [scheduleChanges, setScheduleChanges] = useState<Record<number, number>>({});
    const [saving, setSaving] = useState(false);
    const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
    const [paymentModal, setPaymentModal] = useState<{ open: boolean; employee: Employee | null }>({ open: false, employee: null });
    const [paymentForm, setPaymentForm] = useState({ amount: '', method: 'CASH', notes: '', paymentType: 'salary' as 'salary' | 'advance' });
    const [processingPayment, setProcessingPayment] = useState(false);

    const toggleCard = (employeeId: number) => {
        setExpandedCards(prev => {
            const newSet = new Set(prev);
            if (newSet.has(employeeId)) {
                newSet.delete(employeeId);
            } else {
                newSet.add(employeeId);
            }
            return newSet;
        });
    };

    const openPaymentModal = (employee: Employee) => {
        setPaymentModal({ open: true, employee });
        // Default to salary (full amount with KPI)
        setPaymentForm({
            amount: employee.balance.toString(),
            method: 'CASH',
            notes: '',
            paymentType: 'salary'
        });
    };

    const closePaymentModal = () => {
        setPaymentModal({ open: false, employee: null });
        setPaymentForm({ amount: '', method: 'CASH', notes: '', paymentType: 'salary' });
    };

    const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(null);

    const onDeletePaymentClick = async (paymentId: number) => {
        try {
            const response = await fetch(`/api/clubs/${clubId}/payments/${paymentId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                alert('Выплата удалена, зарплата пересчитана.');
                setConfirmingDeleteId(null);
                fetchData();
            } else {
                const error = await response.json();
                alert(`Ошибка: ${error.error}`);
            }
        } catch (error) {
            console.error('Delete error:', error);
            alert('Не удалось удалить выплату');
        }
    };

    const handleDeleteShift = async (shiftId: number | string) => {
        if (!confirm('Вы уверены, что хотите удалить эту смену? Это действие нельзя отменить.')) {
            return;
        }

        try {
            const response = await fetch(`/api/clubs/${clubId}/shifts/${shiftId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                alert('Смена удалена.');
                fetchData();
            } else {
                const error = await response.json();
                alert(`Ошибка: ${error.error}`);
            }
        } catch (error) {
            console.error('Delete shift error:', error);
            alert('Не удалось удалить смену');
        }
    };

    const handlePayment = async () => {
        if (!paymentModal.employee) return;

        setProcessingPayment(true);
        try {
            const response = await fetch(`/api/clubs/${clubId}/payments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    employee_id: paymentModal.employee.id,
                    amount: parseFloat(paymentForm.amount),
                    payment_method: paymentForm.method,
                    month: selectedMonth,
                    year: selectedYear,
                    notes: paymentForm.notes,
                    payment_type: paymentForm.paymentType
                })
            });

            if (response.ok) {
                const isAdvance = paymentForm.paymentType === 'advance';
                alert(isAdvance ? 'Аванс записан! KPI не заморожен.' : 'Выплата записана! Зарплата заморожена.');
                closePaymentModal();
                fetchData(); // Reload data
            } else {
                const error = await response.json();
                alert(`Ошибка: ${error.error}`);
            }
        } catch (error) {
            console.error('Payment error:', error);
            alert('Ошибка при записи выплаты');
        } finally {
            setProcessingPayment(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [selectedMonth, selectedYear, clubId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch(
                `/api/clubs/${clubId}/salaries/summary?month=${selectedMonth}&year=${selectedYear}`
            );
            const json = await res.json();
            console.log('API Response:', json);

            // Map old API structure to new format
            if (json.summary && Array.isArray(json.summary)) {
                const mappedData = {
                    period: { month: selectedMonth, year: selectedYear },
                    stats: {
                        total_employees: json.summary.length,
                        total_accrued: json.summary.reduce((sum: number, emp: any) => sum + (emp.total_accrued || 0), 0),
                        total_paid: json.summary.reduce((sum: number, emp: any) => sum + (emp.total_paid || 0), 0),
                        pending_payment: json.summary.reduce((sum: number, emp: any) => sum + (emp.balance || 0), 0),
                    },
                    employees: json.summary.map((emp: any) => ({
                        ...emp,
                        payment_status: emp.balance <= 0 ? 'PAID' : emp.total_paid > 0 ? 'PARTIAL' : 'PENDING',
                        has_active_kpi: emp.period_bonuses && emp.period_bonuses.length > 0, // Always show if KPI is configured
                        kpi_summary: emp.period_bonuses?.map((b: any) => ({
                            metric: b.name || b.metric_key,
                            progress: b.progress_percent || 0,
                            target: b.target_value || 0,
                            is_met: b.is_met || false
                        })) || []
                    }))
                };
                console.log('Mapped data:', mappedData);
                console.log('First employee period_bonuses:', JSON.stringify(mappedData.employees[0]?.period_bonuses, null, 2));
                console.log('First employee has_active_kpi:', mappedData.employees[0]?.has_active_kpi);
                console.log('First employee kpi_bonus_amount:', mappedData.employees[0]?.kpi_bonus_amount);
                console.log('First employee planned_shifts:', json.summary[0]?.planned_shifts);
                setData(mappedData);
            } else {
                setData(json);
            }

            // Fetch saved schedules
            const schedulesRes = await fetch(
                `/api/clubs/${clubId}/shift-schedules?month=${selectedMonth}&year=${selectedYear}`
            );
            if (schedulesRes.ok) {
                const schedulesData = await schedulesRes.json();
                console.log('Schedules data:', schedulesData);

                // Initialize scheduleChanges with saved values or defaults
                const initialSchedules: Record<number, number> = {};
                if (schedulesData.schedules && Array.isArray(schedulesData.schedules)) {
                    schedulesData.schedules.forEach((schedule: any) => {
                        initialSchedules[schedule.user_id] = schedule.planned_shifts || 20;
                    });
                }

                // Add defaults for employees without saved schedules
                if (json.summary && Array.isArray(json.summary)) {
                    json.summary.forEach((emp: any) => {
                        if (!(emp.id in initialSchedules)) {
                            initialSchedules[emp.id] = 20;
                        }
                    });
                }

                setScheduleChanges(initialSchedules);
            }
        } catch (error) {
            console.error('Failed to load payroll data:', error);
        } finally {
            setLoading(false);
        }
    };

    const navigateMonth = (direction: number) => {
        let newMonth = selectedMonth + direction;
        let newYear = selectedYear;

        if (newMonth > 12) {
            newMonth = 1;
            newYear++;
        } else if (newMonth < 1) {
            newMonth = 12;
            newYear--;
        }

        setSelectedMonth(newMonth);
        setSelectedYear(newYear);
    };

    const filteredEmployees = (data?.employees || []).filter(emp =>
        emp.full_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('ru-RU', {
            maximumFractionDigits: 0
        }).format(amount) + ' ₽';
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'PAID': return 'Выплачено';
            case 'PARTIAL': return 'Частично';
            case 'PENDING': return 'К выплате';
            default: return status;
        }
    };

    const handleScheduleChange = (employeeId: number, value: number) => {
        setScheduleChanges(prev => ({
            ...prev,
            [employeeId]: value
        }));
    };

    const saveSchedules = async () => {
        setSaving(true);
        try {
            const updates = Object.entries(scheduleChanges).map(([userId, plannedShifts]) => ({
                user_id: userId, // Keep as string UUID, don't parse to int!
                planned_shifts: plannedShifts
            }));

            console.log('Sending schedules update:', updates);
            console.log('Employee data sample:', filteredEmployees[0]);

            const res = await fetch(`/api/clubs/${clubId}/shift-schedules`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    month: selectedMonth,
                    year: selectedYear,
                    schedules: updates
                })
            });

            if (res.ok) {
                setScheduleChanges({});
                await fetchData(); // Refresh data
                alert('График сохранен!');
            } else {
                const errorData = await res.json();
                console.error('Save error:', errorData);
                alert('Ошибка сохранения: ' + (errorData.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Failed to save schedules:', error);
            alert('Ошибка сохранения');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!data) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-muted-foreground">Нет данных</div>
            </div>
        );
    }

    const stats = data.stats || {
        total_employees: 0,
        total_accrued: 0,
        total_paid: 0,
        pending_payment: 0
    };

    const monthNames = [
        'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
    ];

    return (
        <div className="space-y-8 p-8">
            {/* Header with Period Navigation */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h1 className="text-3xl font-bold tracking-tight">💰 Зарплаты</h1>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigateMonth(-1)}
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </Button>
                        <div className="text-lg font-medium min-w-[160px] text-center">
                            {monthNames[selectedMonth - 1]} {selectedYear}
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigateMonth(1)}
                        >
                            <ChevronRight className="h-5 w-5" />
                        </Button>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    onClick={() => {
                        setSelectedMonth(new Date().getMonth() + 1);
                        setSelectedYear(new Date().getFullYear());
                    }}
                >
                    Сегодня
                </Button>
            </div>

            {/* Stats Overview - Minimalist Style */}
            <div className="grid gap-6 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Сотрудники
                        </CardTitle>
                        <div className="rounded-lg bg-primary/10 p-2">
                            <Users className="h-4 w-4 text-primary" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold tracking-tight">{stats.total_employees}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Начислено
                        </CardTitle>
                        <div className="rounded-lg bg-primary/10 p-2">
                            <DollarSign className="h-4 w-4 text-primary" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold tracking-tight">{formatCurrency(stats.total_accrued)}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Выплачено
                        </CardTitle>
                        <div className="rounded-lg bg-primary/10 p-2">
                            <CheckCircle className="h-4 w-4 text-primary" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold tracking-tight">{formatCurrency(stats.total_paid)}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            К выплате
                        </CardTitle>
                        <div className="rounded-lg bg-primary/10 p-2">
                            <Clock className="h-4 w-4 text-primary" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold tracking-tight">{formatCurrency(stats.pending_payment)}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs Navigation */}
            <div className="border-b">
                <div className="flex gap-4">
                    <button
                        onClick={() => setActiveTab('summary')}
                        className={`pb-3 px-1 border-b-2 transition-colors ${activeTab === 'summary'
                            ? 'border-primary text-primary font-medium'
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        Сводка
                    </button>
                    <button
                        onClick={() => setActiveTab('schedules')}
                        className={`pb-3 px-1 border-b-2 transition-colors ${activeTab === 'schedules'
                            ? 'border-primary text-primary font-medium'
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        Графики
                    </button>
                </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'summary' ? (
                <>
                    {/* Search and Filters */}
                    <div className="flex items-center gap-4">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Поиск сотрудника..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <Button variant="outline">
                            <Filter className="h-4 w-4 mr-2" />
                            Фильтры
                        </Button>
                    </div>

                    {/* Employee List - Minimalist Style */}
                    {filteredEmployees.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            Сотрудники не найдены
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredEmployees.map((employee) => (
                                <Card
                                    key={employee.id}
                                    className="transition-shadow hover:shadow-md"
                                >
                                    <CardContent className="p-6">
                                        <div className="flex items-center justify-between">
                                            {/* Employee Info */}
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-3">
                                                    <div>
                                                        <h3 className="font-medium text-lg">{employee.full_name}</h3>
                                                        <p className="text-sm text-muted-foreground">{employee.role || 'Сотрудник'}</p>
                                                    </div>
                                                    {employee.has_active_kpi && (
                                                        <Badge variant="secondary" className="text-xs">
                                                            🎯 KPI
                                                        </Badge>
                                                    )}
                                                </div>

                                                <div className="grid grid-cols-5 gap-4 text-sm">
                                                    <div>
                                                        <p className="text-muted-foreground mb-1">Смены</p>
                                                        <p className="font-medium">{employee.shifts_count}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-muted-foreground mb-1">Начислено</p>
                                                        <p className="font-medium">{formatCurrency(employee.total_accrued)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-muted-foreground mb-1">Выплачено</p>
                                                        <p className="font-medium">{formatCurrency(employee.total_paid)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-muted-foreground mb-1">Остаток</p>
                                                        <p className="font-medium">{formatCurrency(employee.balance)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-muted-foreground mb-1">KPI премия</p>
                                                        <p className={`font-medium ${employee.kpi_bonus_amount && employee.kpi_bonus_amount > 0 ? 'text-green-600' : ''}`}>
                                                            {formatCurrency(employee.kpi_bonus_amount || 0)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Status and Actions */}
                                            <div className="flex flex-col items-end gap-3 ml-6"> {/* Changed to flex-col items-end */}
                                                <Badge
                                                    variant={
                                                        employee.payment_status === 'PAID' ? 'default' :
                                                            employee.payment_status === 'PARTIAL' ? 'secondary' :
                                                                'outline'
                                                    }
                                                >
                                                    {getStatusText(employee.payment_status)}
                                                </Badge>
                                                {/* Original action buttons removed from here */}
                                            </div>
                                        </div> {/* Closing the flex items-start justify-between div */}

                                        {/* Expanded Details */}
                                        {expandedCards.has(employee.id) && (
                                            <div className="mt-6 space-y-4 pt-4 border-t">
                                                {/* Salary Breakdown */}
                                                {employee.breakdown && (
                                                    <div>
                                                        <h4 className="text-sm font-medium mb-3">Детализация начислений</h4>
                                                        <div className="grid grid-cols-3 gap-4 text-sm">
                                                            <div className="flex justify-between">
                                                                <span className="text-muted-foreground">Базовая зарплата:</span>
                                                                <span className="font-medium">{formatCurrency(employee.breakdown.base_salary)}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-muted-foreground">KPI премии:</span>
                                                                <span className="font-medium text-green-600">{formatCurrency(employee.breakdown.kpi_bonuses)}</span>
                                                            </div>
                                                            {employee.breakdown.other_bonuses !== 0 && (
                                                                <div className="flex justify-between">
                                                                    <span className="text-muted-foreground">Другие бонусы:</span>
                                                                    <span className="font-medium">{formatCurrency(employee.breakdown.other_bonuses)}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Performance Metrics */}
                                                {employee.metrics && (
                                                    <div>
                                                        <h4 className="text-sm font-medium mb-3">Метрики производительности</h4>
                                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                                            <div className="flex justify-between">
                                                                <span className="text-muted-foreground">Общая выручка:</span>
                                                                <span className="font-medium">{formatCurrency(employee.metrics.total_revenue)}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-muted-foreground">Средняя за смену:</span>
                                                                <span className="font-medium">{formatCurrency(employee.metrics.avg_revenue_per_shift)}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-muted-foreground">Отработано часов:</span>
                                                                <span className="font-medium">{employee.metrics.total_hours.toFixed(1)}ч ({employee.metrics.avg_hours_per_shift.toFixed(1)}ч/см)</span>
                                                            </div>
                                                            {Object.entries(employee.metrics.revenue_by_metric).map(([key, value]) => {
                                                                // Human-readable labels for metric keys
                                                                const metricLabels: Record<string, string> = {
                                                                    'total_revenue': 'Общая выручка',
                                                                    'Total_revenue': 'Общая выручка',
                                                                    'bar': 'Бар',
                                                                    'Bar': 'Бар',
                                                                    'hookah': 'Кальян',
                                                                    'Hookah': 'Кальян',
                                                                    'kitchen': 'Кухня',
                                                                    'Kitchen': 'Кухня',
                                                                    'vip': 'VIP',
                                                                    'VIP': 'VIP',
                                                                    'deposit': 'Депозит',
                                                                    'Deposit': 'Депозит'
                                                                };
                                                                const label = metricLabels[key] || key.replace(/_/g, ' ');
                                                                return (
                                                                    <div key={key} className="flex justify-between">
                                                                        <span className="text-muted-foreground">{label}:</span>
                                                                        <span className="font-medium">{formatCurrency(value.total)} ({formatCurrency(value.avg_per_shift)}/см)</span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* KPI Progress */}
                                                {employee.has_active_kpi && employee.period_bonuses && employee.period_bonuses.length > 0 && (
                                                    <div>
                                                        <h4 className="text-sm font-medium mb-3">Прогресс KPI</h4>
                                                        <div className="space-y-4">
                                                            {employee.period_bonuses.map((kpi: any) => (
                                                                <div key={kpi.id} className="space-y-2 p-3 bg-muted/30 rounded-lg">
                                                                    <div className="flex justify-between items-center text-sm">
                                                                        <span className="font-medium">🎯 {kpi.name}</span>
                                                                        <span className={kpi.is_met ? 'text-green-600 font-semibold' : 'text-muted-foreground'}>
                                                                            {formatCurrency(kpi.current_value)} / {formatCurrency(kpi.target_value)}
                                                                        </span>
                                                                    </div>
                                                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                                                        <div
                                                                            className={`h-2 rounded-full ${kpi.is_met ? 'bg-green-600' : 'bg-blue-600'}`}
                                                                            style={{ width: `${Math.min(kpi.progress_percent, 100)}%` }}
                                                                        />
                                                                    </div>

                                                                    {/* KPI Breakdown */}
                                                                    <div className="text-xs space-y-1 pt-2 border-t border-dashed">
                                                                        {kpi.is_met ? (
                                                                            <>
                                                                                <div className="flex justify-between">
                                                                                    <span className="text-muted-foreground">Статус:</span>
                                                                                    <span className="text-green-600 font-medium">✓ Выполнено</span>
                                                                                </div>
                                                                                <div className="flex justify-between">
                                                                                    <span className="text-muted-foreground">Ставка:</span>
                                                                                    <span className="font-medium">{kpi.current_reward_value}% от выручки</span>
                                                                                </div>
                                                                                <div className="flex justify-between">
                                                                                    <span className="text-muted-foreground">Расчёт:</span>
                                                                                    <span className="font-mono text-xs">
                                                                                        {formatCurrency(kpi.current_value)} × {kpi.current_reward_value}%
                                                                                    </span>
                                                                                </div>
                                                                                <div className="flex justify-between font-semibold text-green-600 pt-1 border-t">
                                                                                    <span>Бонус:</span>
                                                                                    <span>{formatCurrency(kpi.current_value * kpi.current_reward_value / 100)}</span>
                                                                                </div>
                                                                                {kpi.progress_percent < 100 && kpi.target_value > kpi.current_value && (
                                                                                    <div className="text-muted-foreground pt-1">
                                                                                        До следующего порога: {formatCurrency(kpi.target_value - kpi.current_value)}
                                                                                    </div>
                                                                                )}
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <div className="flex justify-between">
                                                                                    <span className="text-muted-foreground">Статус:</span>
                                                                                    <span className="text-orange-500">⏳ Не достигнуто</span>
                                                                                </div>
                                                                                <div className="flex justify-between">
                                                                                    <span className="text-muted-foreground">До порога:</span>
                                                                                    <span className="font-medium">{formatCurrency(kpi.target_value - kpi.current_value)}</span>
                                                                                </div>
                                                                                <div className="flex justify-between">
                                                                                    <span className="text-muted-foreground">Потенциальный бонус:</span>
                                                                                    <span className="text-muted-foreground">
                                                                                        {kpi.thresholds?.[0]?.percent || 10}% после выполнения
                                                                                    </span>
                                                                                </div>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))}

                                                            {/* Total KPI Summary */}
                                                            {(employee.kpi_bonus_amount || 0) > 0 && (
                                                                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                                                                    <div className="flex justify-between items-center">
                                                                        <span className="text-sm font-medium text-green-800">💰 Итого KPI бонусы:</span>
                                                                        <span className="text-lg font-bold text-green-600">
                                                                            {formatCurrency(employee.kpi_bonus_amount || 0)}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Shift List Section */}
                                                {employee.shifts && employee.shifts.length > 0 && (
                                                    <div>
                                                        <h4 className="text-sm font-medium mb-3">Список смен (последние)</h4>
                                                        <div className="space-y-2 overflow-x-auto">
                                                            <table className="w-full text-xs">
                                                                <thead>
                                                                    <tr className="text-muted-foreground border-b uppercase pb-1">
                                                                        <th className="text-left py-1 font-medium">Дата</th>
                                                                        <th className="text-center py-1 font-medium">Часы</th>
                                                                        <th className="text-right py-1 font-medium">Выручка</th>
                                                                        <th className="text-right py-1 font-medium text-emerald-600">KPI</th>
                                                                        <th className="text-right py-1 font-medium">З/П</th>
                                                                        <th className="text-right py-1 font-medium text-center">Статус</th>
                                                                        <th className="text-right py-1 font-medium text-center"></th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y">
                                                                    {employee.shifts.slice(0, 10).map((shift) => (
                                                                        <tr key={shift.id} className={`hover:bg-muted/50 transition-colors ${shift.type === 'PERIOD_BONUS' ? 'bg-emerald-50/30' : ''}`}>
                                                                            <td className="py-2">
                                                                                <div className="flex flex-col">
                                                                                    <span>{new Date(shift.date).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })}</span>
                                                                                    {shift.type === 'PERIOD_BONUS' && <span className="text-[9px] text-emerald-600 font-bold uppercase">Премия</span>}
                                                                                </div>
                                                                            </td>
                                                                            <td className="text-center py-2">
                                                                                {shift.type === 'PERIOD_BONUS' ? (
                                                                                    <span className="text-muted-foreground">—</span>
                                                                                ) : (
                                                                                    `${shift.total_hours}ч`
                                                                                )}
                                                                            </td>
                                                                            <td className="text-right py-2">
                                                                                {shift.type === 'PERIOD_BONUS' ? (
                                                                                    <span className="text-muted-foreground">—</span>
                                                                                ) : (
                                                                                    formatCurrency(shift.total_revenue)
                                                                                )}
                                                                            </td>
                                                                            <td className="text-right py-2 font-medium">
                                                                                <span className={shift.kpi_bonus > 0 ? 'text-emerald-600' : 'text-muted-foreground'}>
                                                                                    {shift.kpi_bonus > 0 ? `+${formatCurrency(shift.kpi_bonus)}` : '-'}
                                                                                </span>
                                                                            </td>
                                                                            <td className="text-right py-2 font-medium">
                                                                                {formatCurrency(shift.calculated_salary)}
                                                                            </td>
                                                                            <td className="text-center py-2">
                                                                                {shift.is_paid ? (
                                                                                    <Badge variant="default" className="text-[10px] h-4 py-0">Ok</Badge>
                                                                                ) : shift.status === 'ACTIVE' ? (
                                                                                    <Badge variant="secondary" className="text-[10px] h-4 py-0">В процессе</Badge>
                                                                                ) : shift.status === 'CALCULATED' ? (
                                                                                    <Badge variant="outline" className="text-[10px] h-4 py-0 border-emerald-500 text-emerald-600">Начислено</Badge>
                                                                                ) : (
                                                                                    <span className="text-muted-foreground italic">Ож.</span>
                                                                                )}
                                                                            </td>
                                                                            <td className="text-right py-2">
                                                                                {shift.status !== 'CALCULATED' && (
                                                                                    <Button
                                                                                        variant="ghost"
                                                                                        size="icon"
                                                                                        className="h-6 w-6 text-muted-foreground hover:text-destructive transition-colors"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            handleDeleteShift(shift.id);
                                                                                        }}
                                                                                    >
                                                                                        <Trash2 className="h-3 w-3" />
                                                                                    </Button>
                                                                                )}
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                            {employee.shifts.length > 10 && (
                                                                <p className="text-[10px] text-muted-foreground text-center mt-1">
                                                                    Показано 10 из {employee.shifts.length} смен
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Payment History Section */}
                                                {employee.payment_history && employee.payment_history.length > 0 && (
                                                    <div>
                                                        <h4 className="text-sm font-medium mb-3">История выплат</h4>
                                                        <div className="space-y-2">
                                                            {employee.payment_history.map((payment, idx) => (
                                                                <div key={idx} className="flex justify-between items-center text-sm border-b pb-2 last:border-0">
                                                                    <div>
                                                                        <p className="font-medium">{formatCurrency(payment.amount)}</p>
                                                                        <p className="text-xs text-muted-foreground">
                                                                            {new Date(payment.date).toLocaleDateString('ru-RU', {
                                                                                day: '2-digit',
                                                                                month: 'short',
                                                                                year: 'numeric'
                                                                            })}
                                                                        </p>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className={`text-xs px-2 py-1 rounded ${payment.payment_type === 'advance'
                                                                            ? 'bg-amber-100 text-amber-700'
                                                                            : 'bg-emerald-100 text-emerald-700'
                                                                            }`}>
                                                                            {payment.payment_type === 'advance' ? 'Аванс' : 'Зарплата'}
                                                                        </span>
                                                                        <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                                                                            {payment.method === 'CASH' ? 'Наличные' :
                                                                                payment.method === 'CARD' ? 'Карта' :
                                                                                    'Банк. перевод'}
                                                                        </span>
                                                                        {/* Delete Payment Button */}
                                                                        {payment.id && (
                                                                            <div className="flex items-center gap-1">
                                                                                {confirmingDeleteId === payment.id ? (
                                                                                    <div className="flex items-center gap-1 animate-in fade-in slide-in-from-right-1">
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={(e) => {
                                                                                                e.preventDefault();
                                                                                                e.stopPropagation();
                                                                                                onDeletePaymentClick(payment.id!);
                                                                                            }}
                                                                                            className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 transition-colors"
                                                                                        >
                                                                                            Удалить?
                                                                                        </button>
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={(e) => {
                                                                                                e.preventDefault();
                                                                                                e.stopPropagation();
                                                                                                setConfirmingDeleteId(null);
                                                                                            }}
                                                                                            className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded hover:bg-gray-300 transition-colors"
                                                                                        >
                                                                                            Отмена
                                                                                        </button>
                                                                                    </div>
                                                                                ) : (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={(e) => {
                                                                                            e.preventDefault();
                                                                                            e.stopPropagation();
                                                                                            setConfirmingDeleteId(payment.id!);
                                                                                        }}
                                                                                        className="text-gray-400 hover:text-red-600 transition-colors p-1"
                                                                                        title="Удалить выплату"
                                                                                    >
                                                                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                                            <path d="M3 6h18"></path>
                                                                                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                                                                                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                                                                                        </svg>
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Action Buttons */}
                                        <div className="flex items-center gap-2 mt-4 justify-end">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => toggleCard(employee.id)}
                                            >
                                                {expandedCards.has(employee.id) ? '↑ Свернуть' : '↓ Детали'}
                                            </Button>
                                            {employee.balance > 0 && (
                                                <Button
                                                    size="sm"
                                                    onClick={() => openPaymentModal(employee)}
                                                >
                                                    Выплатить
                                                </Button>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </>
            ) : (
                /* Schedules Tab */
                <div className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>График смен на {monthNames[selectedMonth - 1]} {selectedYear}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {filteredEmployees.map((employee) => (
                                    <div
                                        key={employee.id}
                                        className="flex items-center justify-between p-4 border rounded-lg"
                                    >
                                        <div>
                                            <p className="font-medium">{employee.full_name}</p>
                                            <p className="text-sm text-muted-foreground">{employee.role || 'Сотрудник'}</p>
                                        </div>
                                        <div className="flex items-center gap-6">
                                            <div className="text-sm">
                                                <span className="text-muted-foreground">План: </span>
                                                <Input
                                                    type="number"
                                                    className="w-20 inline-block ml-2"
                                                    value={scheduleChanges[employee.id] ?? 20}
                                                    onChange={(e) => handleScheduleChange(employee.id, parseInt(e.target.value) || 0)}
                                                    min={0}
                                                />
                                                <span className="ml-2">смен</span>
                                            </div>
                                            <div className="text-sm">
                                                <span className="text-muted-foreground">Факт: </span>
                                                <span className="font-medium">{employee.shifts_count} смен</span>
                                            </div>
                                            <Badge variant={employee.shifts_count >= (scheduleChanges[employee.id] ?? 20) ? 'default' : 'secondary'}>
                                                {employee.shifts_count >= (scheduleChanges[employee.id] ?? 20) ? 'По плану' : `${(scheduleChanges[employee.id] ?? 20) - employee.shifts_count}`}
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-6 flex justify-end">
                                <Button onClick={saveSchedules} disabled={saving || Object.keys(scheduleChanges).length === 0}>
                                    {saving ? 'Сохранение...' : 'Сохранить график'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Payment Modal */}
            {paymentModal.open && paymentModal.employee && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                        <h2 className="text-xl font-semibold mb-4">
                            Выплата: {paymentModal.employee.full_name}
                        </h2>

                        <div className="space-y-4">
                            {/* Amount */}
                            <div>
                                <label className="block text-sm font-medium mb-1">Сумма</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={paymentForm.amount}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                                    className="w-full border rounded px-3 py-2"
                                    placeholder="0.00"
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    Остаток к выплате: {formatCurrency(paymentModal.employee.balance)}
                                </p>
                                <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                    <p>База: {formatCurrency(paymentModal.employee.breakdown?.base_salary || 0)}</p>
                                    <p className="text-emerald-600">KPI бонусы: {formatCurrency(paymentModal.employee.breakdown?.kpi_bonuses || 0)}</p>
                                </div>
                            </div>

                            {/* Payment Type Toggle */}
                            <div>
                                <label className="block text-sm font-medium mb-2">Тип выплаты</label>
                                <div className="flex gap-2">
                                    <Button
                                        type="button"
                                        variant={paymentForm.paymentType === 'advance' ? 'default' : 'outline'}
                                        className="flex-1"
                                        onClick={() => {
                                            const baseAmount = paymentModal.employee?.breakdown?.base_salary || 0;
                                            setPaymentForm(prev => ({
                                                ...prev,
                                                paymentType: 'advance',
                                                amount: baseAmount.toString()
                                            }));
                                        }}
                                    >
                                        Аванс
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={paymentForm.paymentType === 'salary' ? 'default' : 'outline'}
                                        className="flex-1"
                                        onClick={() => {
                                            const fullAmount = paymentModal.employee?.balance || 0;
                                            setPaymentForm(prev => ({
                                                ...prev,
                                                paymentType: 'salary',
                                                amount: fullAmount.toString()
                                            }));
                                        }}
                                    >
                                        Зарплата
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {
                                        paymentForm.paymentType === 'advance'
                                            ? 'Аванс: только базовая часть, KPI не замораживается'
                                            : 'Зарплата: полная сумма с KPI, смены замораживаются'
                                    }
                                </p>
                            </div>

                            {/* Payment Method */}
                            <div>
                                <label className="block text-sm font-medium mb-1">Способ оплаты</label>
                                <select
                                    value={paymentForm.method}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}
                                    className="w-full border rounded px-3 py-2"
                                >
                                    <option value="CASH">Наличные</option>
                                    <option value="CARD">Карта</option>
                                    <option value="BANK_TRANSFER">Банковский перевод</option>
                                </select>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-sm font-medium mb-1">Комментарий (опционально)</label>
                                <textarea
                                    value={paymentForm.notes}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                                    className="w-full border rounded px-3 py-2"
                                    rows={3}
                                    placeholder="Примечание к выплате..."
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <Button
                                variant="outline"
                                onClick={closePaymentModal}
                                className="flex-1"
                                disabled={processingPayment}
                            >
                                Отмена
                            </Button>
                            <Button
                                onClick={handlePayment}
                                className="flex-1"
                                disabled={processingPayment || !paymentForm.amount || parseFloat(paymentForm.amount) <= 0}
                            >
                                {processingPayment ? 'Обработка...' : 'Выплатить'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
