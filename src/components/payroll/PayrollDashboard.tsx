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
    Trash2,
    Plus
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
    standard_monthly_shifts: number;
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
    const [activeTabs, setActiveTabs] = useState<Record<number, string>>({});
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
                if (!activeTabs[employeeId]) {
                    setActiveTabs(current => ({ ...current, [employeeId]: 'overview' }));
                }
            }
            return newSet;
        });
    };

    const openPaymentModal = (employee: Employee) => {
        setPaymentModal({ open: true, employee });
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
                fetchData();
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

            if (json.summary && Array.isArray(json.summary)) {
                setData({
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
                        has_active_kpi: emp.period_bonuses && emp.period_bonuses.length > 0,
                        kpi_summary: emp.period_bonuses?.map((b: any) => ({
                            metric: b.name || b.metric_key,
                            progress: b.progress_percent || 0,
                            target: b.target_value || 0,
                            is_met: b.is_met || false
                        })) || []
                    }))
                });
            } else {
                setData(json);
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
        if (newMonth > 12) { newMonth = 1; newYear++; }
        else if (newMonth < 1) { newMonth = 12; newYear--; }
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

    if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
    if (!data) return <div className="flex items-center justify-center h-64 text-muted-foreground">Нет данных</div>;

    const stats = data.stats || { total_employees: 0, total_accrued: 0, total_paid: 0, pending_payment: 0 };
    const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

    return (
        <div className="space-y-8 p-8">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h1 className="text-3xl font-bold tracking-tight">💰 Зарплаты</h1>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => navigateMonth(-1)}><ChevronLeft className="h-5 w-5" /></Button>
                        <div className="text-lg font-medium min-w-[160px] text-center">{monthNames[selectedMonth - 1]} {selectedYear}</div>
                        <Button variant="ghost" size="icon" onClick={() => navigateMonth(1)}><ChevronRight className="h-5 w-5" /></Button>
                    </div>
                </div>
                <Button variant="ghost" onClick={() => { setSelectedMonth(new Date().getMonth() + 1); setSelectedYear(new Date().getFullYear()); }}>Сегодня</Button>
            </div>

            <div className="grid gap-6 md:grid-cols-4">
                <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Сотрудники</CardTitle><div className="rounded-lg bg-primary/10 p-2"><Users className="h-4 w-4 text-primary" /></div></CardHeader><CardContent><div className="text-2xl font-bold tracking-tight">{stats.total_employees}</div></CardContent></Card>
                <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Начислено</CardTitle><div className="rounded-lg bg-primary/10 p-2"><DollarSign className="h-4 w-4 text-primary" /></div></CardHeader><CardContent><div className="text-2xl font-bold tracking-tight">{formatCurrency(stats.total_accrued)}</div></CardContent></Card>
                <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Выплачено</CardTitle><div className="rounded-lg bg-primary/10 p-2"><CheckCircle className="h-4 w-4 text-primary" /></div></CardHeader><CardContent><div className="text-2xl font-bold tracking-tight">{formatCurrency(stats.total_paid)}</div></CardContent></Card>
                <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">К выплате</CardTitle><div className="rounded-lg bg-primary/10 p-2"><Clock className="h-4 w-4 text-primary" /></div></CardHeader><CardContent><div className="text-2xl font-bold tracking-tight">{formatCurrency(stats.pending_payment)}</div></CardContent></Card>
            </div>

            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Поиск сотрудника..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
                </div>
                <Button variant="outline"><Filter className="h-4 w-4 mr-2" />Фильтры</Button>
            </div>

            {filteredEmployees.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">Сотрудники не найдены</div>
            ) : (
                <div className="space-y-3">
                    {filteredEmployees.map((employee) => (
                        <Card key={employee.id} className="transition-shadow hover:shadow-md">
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div>
                                                <h3 className="font-medium text-lg">{employee.full_name}</h3>
                                                <p className="text-sm text-muted-foreground">{employee.role || 'Сотрудник'}</p>
                                            </div>
                                            {employee.has_active_kpi && <Badge variant="secondary" className="text-xs">🎯 KPI</Badge>}
                                        </div>
                                        <div className="grid grid-cols-5 gap-4 text-sm">
                                            <div><p className="text-muted-foreground mb-1">Смены</p><p className="font-medium">{employee.shifts_count}</p></div>
                                            <div><p className="text-muted-foreground mb-1">Начислено</p><p className="font-medium">{formatCurrency(employee.total_accrued)}</p></div>
                                            <div><p className="text-muted-foreground mb-1">Выплачено</p><p className="font-medium">{formatCurrency(employee.total_paid)}</p></div>
                                            <div><p className="text-muted-foreground mb-1">Остаток</p><p className="font-medium">{formatCurrency(employee.balance)}</p></div>
                                            <div><p className="text-muted-foreground mb-1">KPI премия</p><p className={`font-medium ${employee.kpi_bonus_amount && employee.kpi_bonus_amount > 0 ? 'text-green-600' : ''}`}>{formatCurrency(employee.kpi_bonus_amount || 0)}</p></div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-3 ml-6">
                                        <Badge variant={employee.payment_status === 'PAID' ? 'default' : employee.payment_status === 'PARTIAL' ? 'secondary' : 'outline'}>{getStatusText(employee.payment_status)}</Badge>
                                    </div>
                                </div>

                                {expandedCards.has(employee.id) && (
                                    <div className="mt-6 pt-6 border-t animate-in fade-in duration-300">
                                        <div className="flex border-b mb-6 overflow-x-auto scrollbar-hide">
                                            {[
                                                { id: 'overview', label: 'Обзор', icon: '📊' },
                                                { id: 'kpi', label: 'KPI и Начисления', icon: '🎯' },
                                                { id: 'shifts', label: 'Смены', icon: '📅' },
                                                { id: 'payments', label: 'Выплаты', icon: '💰' }
                                            ].map((tab) => (
                                                <button
                                                    key={tab.id}
                                                    onClick={() => setActiveTabs(prev => ({ ...prev, [employee.id]: tab.id }))}
                                                    className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeTabs[employee.id] === tab.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                                                >
                                                    <span className="mr-2">{tab.icon}</span>{tab.label}
                                                </button>
                                            ))}
                                        </div>

                                        {activeTabs[employee.id] === 'overview' && (
                                            <div className="space-y-6 animate-in slide-in-from-left-2 duration-300">
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    <div className="bg-muted/30 p-4 rounded-xl border flex flex-col justify-between">
                                                        <div><p className="text-xs text-muted-foreground mb-1">Выручка за период</p><p className="text-xl font-bold">{formatCurrency(employee.metrics?.total_revenue || 0)}</p></div>
                                                        <div className="mt-3 space-y-1">
                                                            {employee.period_bonuses?.map((kpi: any) => (
                                                                <div key={kpi.id} className="flex justify-between items-center text-[10px]"><span className="text-muted-foreground truncate mr-2">{kpi.name}:</span><span className="font-bold">{formatCurrency(kpi.current_value)}</span></div>
                                                            ))}
                                                            <p className="text-[10px] text-muted-foreground pt-1 border-t border-dashed mt-1">Средняя: {formatCurrency(employee.metrics?.avg_revenue_per_shift || 0)}/см</p>
                                                        </div>
                                                    </div>
                                                    <div className="bg-muted/30 p-4 rounded-xl border"><p className="text-xs text-muted-foreground mb-1">Отработано</p><p className="text-xl font-bold">{employee.shifts_count} смен</p><p className="text-[10px] text-muted-foreground mt-1">Всего {employee.metrics?.total_hours.toFixed(1)}ч ({employee.metrics?.avg_hours_per_shift.toFixed(1)}ч/см)</p></div>
                                                    <div className="bg-muted/30 p-4 rounded-xl border"><p className="text-xs text-muted-foreground mb-1">К выплате (остаток)</p><p className="text-xl font-bold text-primary">{formatCurrency(employee.balance)}</p><p className="text-[10px] text-muted-foreground mt-1">Начислено: {formatCurrency(employee.total_accrued)}</p></div>
                                                </div>
                                                {employee.has_active_kpi && employee.period_bonuses && (
                                                    <div className="space-y-3">
                                                        <h4 className="text-sm font-semibold flex items-center gap-2">🎯 Статус по KPI</h4>
                                                        <div className="grid grid-cols-1 gap-2">
                                                            {employee.period_bonuses.map((kpi: any) => (
                                                                <div key={kpi.id} className="flex flex-col gap-2 bg-background p-3 rounded-lg border border-dashed">
                                                                    <div className="flex justify-between items-center text-sm">
                                                                        <div className="flex flex-col"><span className="font-bold">{kpi.name}</span><span className="text-[10px] text-muted-foreground uppercase tracking-widest">Прогресс</span></div>
                                                                        <div className="text-right"><div className="flex items-baseline gap-1 justify-end"><span className="font-black text-sm">{formatCurrency(kpi.current_value)}</span><span className="text-[10px] text-muted-foreground">/ {formatCurrency(kpi.target_value)}</span></div><span className="text-[10px] font-bold text-primary">{Math.round(kpi.progress_percent)}%</span></div>
                                                                    </div>
                                                                    <div className="flex items-center gap-4">
                                                                        <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden relative">
                                                                            <div className={`h-full transition-all duration-500 rounded-full ${kpi.is_met ? 'bg-gradient-to-r from-green-500 to-emerald-400' : 'bg-gradient-to-r from-blue-500 to-indigo-400'}`} style={{ width: `${Math.min(kpi.progress_percent, 100)}%` }} />
                                                                        </div>
                                                                        <div className={`px-2 py-0.5 rounded text-[9px] font-black uppercase shrink-0 ${kpi.is_met ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-amber-100 text-amber-700 border border-amber-200 animate-pulse'}`}>{kpi.is_met ? '✓ Ok' : '⏳ В работе'}</div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {activeTabs[employee.id] === 'kpi' && (
                                            <div className="space-y-6 animate-in slide-in-from-left-2 duration-300">
                                                {(() => {
                                                    const shiftsCompletedForCalc = employee.shifts_count || 0;
                                                    const standardShifts = employee.standard_monthly_shifts || 15;

                                                    // Context Detection
                                                    const now = new Date();
                                                    const isCurrentMonth = selectedMonth === (now.getMonth() + 1) && selectedYear === now.getFullYear();
                                                    const isPastMonth = selectedYear < now.getFullYear() || (selectedYear === now.getFullYear() && selectedMonth < (now.getMonth() + 1));

                                                    return (
                                                        <>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-100 dark:from-blue-900/10 dark:to-indigo-900/10">
                                                                    <h5 className="text-xs font-bold text-blue-700 uppercase mb-3 flex items-center gap-2">
                                                                        {isPastMonth ? '🏆 Итоги месяца' : '📈 Прогноз на конец месяца'}
                                                                    </h5>
                                                                    {employee.period_bonuses?.[0] ? (() => {
                                                                        const kpi = employee.period_bonuses[0];
                                                                        const shiftsCompleted = employee.shifts_count || 1;
                                                                        const avgPerShift = kpi.current_value / shiftsCompleted;
                                                                        const projectedValue = avgPerShift * standardShifts;
                                                                        const shiftsLeft = Math.max(0, standardShifts - shiftsCompleted);
                                                                        const targetPerShift = shiftsLeft > 0 ? Math.max(0, (kpi.target_value - kpi.current_value) / shiftsLeft) : 0;

                                                                        // Realism checks (only for current month)
                                                                        const isUnrealistic = !isPastMonth && shiftsLeft > 0 && targetPerShift > (avgPerShift * 1.5);
                                                                        const isNearlyImpossible = !isPastMonth && shiftsLeft > 0 && targetPerShift > (avgPerShift * 2.2);

                                                                        return (
                                                                            <div className="space-y-3">
                                                                                <div className="flex justify-between items-end">
                                                                                    <div>
                                                                                        <p className="text-[10px] text-blue-600">
                                                                                            {isPastMonth ? 'Фактическая выручка' : 'Ожидаемая выручка'}
                                                                                        </p>
                                                                                        <p className="text-lg font-bold">{formatCurrency(isPastMonth ? kpi.current_value : projectedValue)}</p>
                                                                                    </div>
                                                                                    <div className="text-right">
                                                                                        <p className="text-[10px] text-blue-600">
                                                                                            {isPastMonth ? 'Результат' : 'Цель на смену'}
                                                                                        </p>
                                                                                        <p className="text-lg font-bold text-primary">
                                                                                            {isPastMonth
                                                                                                ? (kpi.is_met ? 'Выполнен' : 'Не выполнен')
                                                                                                : formatCurrency(targetPerShift)
                                                                                            }
                                                                                        </p>
                                                                                    </div>
                                                                                </div>
                                                                                <div className={`text-[11px] p-2 rounded-lg border ${isPastMonth
                                                                                    ? (kpi.is_met ? 'text-green-800 bg-green-50 border-green-200' : 'text-amber-800 bg-amber-50 border-amber-200')
                                                                                    : (isNearlyImpossible ? 'text-red-800 bg-red-50 border-red-200' : isUnrealistic ? 'text-amber-800 bg-amber-50 border-amber-200' : 'text-blue-800 bg-white/50 border-blue-200/50')
                                                                                    }`}>
                                                                                    {isPastMonth ? (
                                                                                        kpi.is_met ? "✅ Цель достигнута! KPI бонус начислен." : "❌ Цель не достигнута в этом периоде."
                                                                                    ) : (
                                                                                        projectedValue >= kpi.target_value
                                                                                            ? "🚀 Сотрудник идет на выполнение плана!"
                                                                                            : isNearlyImpossible
                                                                                                ? `❌ План практически недостижим (требуется ${formatCurrency(targetPerShift)} за смену)`
                                                                                                : isUnrealistic
                                                                                                    ? `⚠️ Требуется значительное ускорение (+${Math.round((targetPerShift / avgPerShift - 1) * 100)}% к темпу)`
                                                                                                    : `⚠️ Нужно прибавить ${formatCurrency(Math.max(0, targetPerShift - avgPerShift))} к средней смене для KPI`
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })() : <p className="text-sm text-muted-foreground italic">Настройте KPI для отображения прогноза</p>}
                                                                </div>
                                                                <div className="bg-muted/30 p-4 rounded-xl border">
                                                                    <h5 className="text-xs font-bold uppercase mb-3 text-muted-foreground">Состав зарплаты</h5>
                                                                    <div className="space-y-2 text-sm">
                                                                        <div className="flex justify-between items-center"><span>База:</span><span className="font-medium">{formatCurrency(employee.breakdown?.base_salary || 0)}</span></div>
                                                                        <div className="flex justify-between items-center text-green-600"><span className="flex items-center gap-1">KPI бонусы:</span><span className="font-bold">{formatCurrency(employee.breakdown?.kpi_bonuses || 0)}</span></div>
                                                                        <div className="pt-2 border-t mt-2 flex justify-between items-center font-bold"><span>Итого начислено:</span><span>{formatCurrency(employee.total_accrued)}</span></div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="space-y-4">
                                                                <h4 className="text-sm font-bold">Прогресс по порогам KPI</h4>
                                                                {employee.period_bonuses?.map((kpi: any) => (
                                                                    <div key={kpi.id} className="bg-background border rounded-xl p-4 space-y-4">
                                                                        <div className="flex justify-between items-center">
                                                                            <div className="flex items-center gap-2"><span className="text-xl">🎯</span><div><span className="font-bold text-sm">{kpi.name}</span><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Текущая выручка</p></div></div>
                                                                            <div className="text-right"><span className="font-bold text-lg">{formatCurrency(kpi.current_value)}</span><p className="text-[10px] text-muted-foreground">из {formatCurrency(kpi.target_value)}</p></div>
                                                                        </div>
                                                                        <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 flex items-start gap-3 dark:bg-blue-900/10 dark:border-blue-900/30">
                                                                            <div className="bg-blue-100 p-1.5 rounded-lg text-blue-600 shrink-0 dark:bg-blue-900/50 dark:text-blue-400"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg></div>
                                                                            <div className="text-[11px] leading-relaxed text-blue-800 dark:text-blue-300">
                                                                                <p className="font-bold mb-0.5 whitespace-nowrap">Учет отработанных смен</p>
                                                                                <p>Пороги адаптированы под <b>{employee.shifts_count}</b> смен. Базовые значения пересчитаны относительно эталона в <b>{standardShifts}</b> смен.</p>
                                                                            </div>
                                                                        </div>
                                                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                                                            {(kpi.thresholds || []).map((threshold: any, idx: number) => {
                                                                                const isCompleted = kpi.current_value >= threshold.from;
                                                                                const prevThresholdValue = idx === 0 ? 0 : kpi.thresholds[idx - 1]?.from;
                                                                                const isCurrentTarget = !isCompleted && kpi.current_value >= prevThresholdValue;
                                                                                const segmentTotal = threshold.from - prevThresholdValue;
                                                                                const segmentEarned = Math.max(0, kpi.current_value - prevThresholdValue);
                                                                                const segmentPercent = segmentTotal > 0 ? Math.min(100, (segmentEarned / segmentTotal) * 100) : (isCompleted ? 100 : 0);
                                                                                return (
                                                                                    <div key={idx} className={`relative p-3 rounded-xl border-2 transition-all duration-300 ${isCompleted ? 'bg-green-50/50 border-green-200 dark:bg-green-900/10 dark:border-green-900/30' : isCurrentTarget ? 'bg-blue-50 border-blue-400 shadow-sm shadow-blue-100 dark:bg-blue-900/20 dark:border-blue-500' : 'bg-muted/10 border-muted/30 opacity-60'}`}>
                                                                                        <div className="flex justify-between items-start mb-2">
                                                                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${isCompleted ? 'bg-green-100 text-green-700' : isCurrentTarget ? 'bg-blue-100 text-blue-700 animate-pulse' : 'bg-muted text-muted-foreground'}`}>
                                                                                                {threshold.label || (isCompleted ? '✓ OK' : isCurrentTarget ? '🎯 Цель' : '⏳ План')}
                                                                                            </span>
                                                                                            <span className="text-sm font-black text-primary">{threshold.percent}%</span>
                                                                                        </div>
                                                                                        <div className="space-y-2">
                                                                                            <div>
                                                                                                <p className="text-[9px] text-muted-foreground uppercase leading-none mb-1">Личная</p>
                                                                                                <p className="text-xs font-bold leading-none mb-1">{formatCurrency(threshold.from)}</p>
                                                                                                {threshold.original_from !== threshold.from && (
                                                                                                    <p className="text-[9px] text-muted-foreground">
                                                                                                        Цель: {formatCurrency(threshold.original_from)}
                                                                                                    </p>
                                                                                                )}
                                                                                            </div>
                                                                                            <div className="space-y-1">
                                                                                                <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-tighter">
                                                                                                    <span className={isCompleted ? 'text-green-600' : isCurrentTarget ? 'text-blue-600' : 'text-muted-foreground'}>Выполнение</span>
                                                                                                    <span>{Math.round(segmentPercent)}%</span>
                                                                                                </div>
                                                                                                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                                                                                    <div className={`h-full transition-all duration-700 rounded-full ${isCompleted ? 'bg-green-500' : 'bg-blue-400'}`} style={{ width: `${segmentPercent}%` }} />
                                                                                                </div>
                                                                                            </div>
                                                                                            {isCurrentTarget && <p className="text-[10px] font-medium text-blue-600">Осталось: {formatCurrency(threshold.from - kpi.current_value)}</p>}
                                                                                        </div>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                        {(kpi.thresholds || []).length === 0 && <div className="col-span-full p-4 bg-muted/20 border border-dashed rounded-xl text-center text-xs text-muted-foreground">Пороги для этого KPI не настроены</div>}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        )}

                                        {activeTabs[employee.id] === 'shifts' && (
                                            <div className="space-y-4 animate-in slide-in-from-left-2 duration-300">
                                                {/* Stats Summary for Shifts */}
                                                {(() => {
                                                    const shifts = employee.shifts || [];
                                                    const totalHours = shifts.reduce((sum: number, s: any) => sum + (s.hours || s.total_hours || 0), 0);
                                                    const totalRevenue = shifts.reduce((sum: number, s: any) => sum + (s.revenue || s.total_revenue || 0), 0);
                                                    const totalKpiBonus = shifts.reduce((sum: number, s: any) => sum + (s.kpi_bonus || 0), 0);
                                                    const avgEfficiency = totalHours > 0 ? totalRevenue / totalHours : 0;

                                                    return (
                                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                            <div className="bg-muted/30 p-3 rounded-xl border flex flex-col items-center">
                                                                <span className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Всего часов</span>
                                                                <span className="font-bold text-sm flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-blue-500" /> {totalHours} ч</span>
                                                            </div>
                                                            <div className="bg-muted/30 p-3 rounded-xl border flex flex-col items-center">
                                                                <span className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Ср. эффективность</span>
                                                                <span className="font-bold text-sm flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5 text-emerald-500" /> {formatCurrency(avgEfficiency)}/ч</span>
                                                            </div>
                                                            <div className="bg-muted/30 p-3 rounded-xl border flex flex-col items-center">
                                                                <span className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Бонусы смен</span>
                                                                <span className="font-bold text-sm flex items-center gap-1.5"><Plus className="h-3.5 w-3.5 text-purple-500" /> {formatCurrency(totalKpiBonus)}</span>
                                                            </div>
                                                            <div className="bg-muted/30 p-3 rounded-xl border flex flex-col items-center">
                                                                <span className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Смен закрыто</span>
                                                                <span className="font-bold text-sm flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5 text-green-500" /> {shifts.length}</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })()}

                                                <div className="rounded-xl border overflow-hidden">
                                                    <table className="w-full text-xs">
                                                        <thead className="bg-muted/50 border-b">
                                                            <tr className="text-muted-foreground text-left">
                                                                <th className="p-3 font-bold uppercase tracking-wider">Дата</th>
                                                                <th className="p-3 font-bold uppercase tracking-wider text-center">Часы</th>
                                                                <th className="p-3 font-bold uppercase tracking-wider text-right">Выручка</th>
                                                                <th className="p-3 font-bold uppercase tracking-wider text-right">Эффект.</th>
                                                                <th className="p-3 font-bold uppercase tracking-wider text-right text-emerald-600">KPI</th>
                                                                <th className="p-3 font-bold uppercase tracking-wider text-right">З/П</th>
                                                                <th className="p-3 font-bold uppercase tracking-wider text-center">Статус</th>
                                                                <th className="p-3"></th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y">
                                                            {(employee.shifts || [])
                                                                .filter((s: any) => s.type !== 'PERIOD_BONUS')
                                                                .map((shift: any) => {
                                                                    const sDate = new Date(shift.date);
                                                                    const dayOfWeek = sDate.toLocaleDateString('ru-RU', { weekday: 'short' });
                                                                    const hours = shift.hours || shift.total_hours || 0;
                                                                    const revenue = shift.revenue || shift.total_revenue || 0;
                                                                    const efficiency = hours > 0 ? revenue / hours : 0;

                                                                    return (
                                                                        <tr key={shift.id} className="hover:bg-muted/40 transition-colors group">
                                                                            <td className="p-3">
                                                                                <div className="flex flex-col">
                                                                                    <span className="font-bold">{sDate.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}</span>
                                                                                    <span className="text-[10px] text-muted-foreground uppercase">{dayOfWeek}</span>
                                                                                </div>
                                                                            </td>
                                                                            <td className="p-3 text-center">
                                                                                <span className="inline-flex items-center gap-1 bg-muted/40 px-1.5 py-0.5 rounded font-medium">{hours} ч</span>
                                                                            </td>
                                                                            <td className="p-3 text-right font-medium">{formatCurrency(revenue)}</td>
                                                                            <td className="p-3 text-right">
                                                                                <span className={`text-[10px] font-bold ${efficiency > 1000 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                                                                                    {formatCurrency(efficiency)}/ч
                                                                                </span>
                                                                            </td>
                                                                            <td className="p-3 text-right">
                                                                                {shift.kpi_bonus > 0 ? (
                                                                                    <div className="flex flex-col items-end">
                                                                                        <span className="text-emerald-600 font-black">+{formatCurrency(shift.kpi_bonus)}</span>
                                                                                        {shift.bonuses && shift.bonuses.length > 0 && (
                                                                                            <div className="flex flex-col items-end gap-0.5 mt-1 overflow-hidden">
                                                                                                {shift.bonuses.filter((b: any) => b.amount > 0).map((b: any, bi: number) => {
                                                                                                    const sourceLabels: Record<string, string> = {
                                                                                                        'total': 'Выручка',
                                                                                                        'cash': 'Нал',
                                                                                                        'card': 'Карта',
                                                                                                        'revenue_bar': 'Бар',
                                                                                                        'revenue_kitchen': 'Кухня'
                                                                                                    };
                                                                                                    const label = sourceLabels[b.source_key] || b.name || 'Бонус';
                                                                                                    return (
                                                                                                        <span key={bi} className="text-[8px] text-muted-foreground leading-tight whitespace-nowrap bg-muted/30 px-1 rounded flex items-center gap-1">
                                                                                                            {label} {b.source_value ? `(${formatCurrency(b.source_value)})` : ''}
                                                                                                            <span className="font-bold text-emerald-600">+{formatCurrency(b.amount)}</span>
                                                                                                        </span>
                                                                                                    );
                                                                                                })}
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                ) : (
                                                                                    <span className="text-muted-foreground/30">—</span>
                                                                                )}
                                                                            </td>
                                                                            <td className="p-3 text-right font-black text-sm">{formatCurrency(shift.total_pay || shift.calculated_salary)}</td>
                                                                            <td className="p-3 text-center">
                                                                                <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-tight shadow-sm ${shift.status === 'PAID' || shift.is_paid
                                                                                    ? 'bg-green-100 text-green-700 border border-green-200'
                                                                                    : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
                                                                                    {shift.status === 'PAID' || shift.is_paid ? 'Оплачено' : 'Ожидает'}
                                                                                </span>
                                                                            </td>
                                                                            <td className="p-3 text-right">
                                                                                {(shift.status !== 'PAID' && !shift.is_paid) && (
                                                                                    <Button
                                                                                        variant="ghost"
                                                                                        size="icon"
                                                                                        className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                                        onClick={(e) => { e.stopPropagation(); handleDeleteShift(shift.id); }}
                                                                                    >
                                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                                    </Button>
                                                                                )}
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                        </tbody>
                                                    </table>
                                                    {(employee.shifts || []).length === 0 && (
                                                        <div className="p-12 text-center bg-muted/5">
                                                            <Clock className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                                                            <p className="text-sm text-muted-foreground italic">Нет данных по сменам в этом периоде</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {activeTabs[employee.id] === 'payments' && (
                                            <div className="space-y-4 animate-in slide-in-from-left-2 duration-300">
                                                <div className="bg-muted/10 rounded-xl border p-4">
                                                    <h5 className="text-sm font-bold mb-4">История всех транзакций</h5>
                                                    <div className="space-y-3">
                                                        {(employee.payment_history || []).map((payment: any, idx: number) => (
                                                            <div key={idx} className="flex items-center justify-between p-3 bg-background rounded-lg border">
                                                                <div className="flex items-center gap-3">
                                                                    <div className={`p-2 rounded-lg ${payment.payment_type === 'advance' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}><DollarSign className="h-4 w-4" /></div>
                                                                    <div><p className="text-sm font-bold">{formatCurrency(payment.amount)}</p><p className="text-[10px] text-muted-foreground">{new Date(payment.date).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long' })} • {payment.method === 'CASH' ? 'Наличные' : 'Безнал'}</p></div>
                                                                </div>
                                                                <div className="flex items-center gap-3">
                                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${payment.payment_type === 'advance' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{payment.payment_type === 'advance' ? 'Аванс' : 'Зарплата'}</span>
                                                                    {payment.id && <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setConfirmingDeleteId(payment.id!)}><Trash2 className="h-3.5 w-3.5" /></Button>}
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {(employee.payment_history || []).length === 0 && <div className="py-4 text-center text-muted-foreground italic">Выплат еще не было</div>}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="flex items-center gap-2 mt-4 justify-end">
                                    <Button variant="ghost" size="sm" onClick={() => toggleCard(employee.id)}>{expandedCards.has(employee.id) ? '↑ Свернуть' : '↓ Детали'}</Button>
                                    {employee.balance > 0 && <Button size="sm" onClick={() => openPaymentModal(employee)}>Выплатить</Button>}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {paymentModal.open && paymentModal.employee && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                        <h2 className="text-xl font-semibold mb-4">Выплата: {paymentModal.employee.full_name}</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Сумма</label>
                                <input type="number" step="0.01" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} className="w-full border rounded px-3 py-2" placeholder="0.00" />
                                <p className="text-xs text-muted-foreground mt-1">Остаток к выплате: {formatCurrency(paymentModal.employee.balance)}</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">Тип выплаты</label>
                                <div className="flex gap-2">
                                    <Button type="button" variant={paymentForm.paymentType === 'advance' ? 'default' : 'outline'} className="flex-1" onClick={() => { const baseAmount = paymentModal.employee?.breakdown?.base_salary || 0; setPaymentForm(prev => ({ ...prev, paymentType: 'advance', amount: baseAmount.toString() })); }}>Аванс</Button>
                                    <Button type="button" variant={paymentForm.paymentType === 'salary' ? 'default' : 'outline'} className="flex-1" onClick={() => { const fullAmount = paymentModal.employee?.balance || 0; setPaymentForm(prev => ({ ...prev, paymentType: 'salary', amount: fullAmount.toString() })); }}>Зарплата</Button>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">{paymentForm.paymentType === 'advance' ? 'Аванс: только базовая часть, KPI не замораживается' : 'Зарплата: полная сумма с KPI, смены замораживаются'}</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Способ оплаты</label>
                                <select value={paymentForm.method} onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })} className="w-full border rounded px-3 py-2"><option value="CASH">Наличные</option><option value="CARD">Карта</option><option value="BANK_TRANSFER">Банковский перевод</option></select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Комментарий</label>
                                <textarea value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} className="w-full border rounded px-3 py-2" rows={3} placeholder="Примечание..." />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <Button variant="outline" onClick={closePaymentModal} className="flex-1" disabled={processingPayment}>Отмена</Button>
                            <Button onClick={handlePayment} className="flex-1" disabled={processingPayment || !paymentForm.amount || parseFloat(paymentForm.amount) <= 0}>{processingPayment ? 'Обработка...' : 'Выплатить'}</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
