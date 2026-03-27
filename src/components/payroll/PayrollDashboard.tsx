'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Users,
    DollarSign,
    CheckCircle,
    Clock,
    ChevronLeft,
    ChevronRight,
    Loader2,
    Trash2,
    Plus,
    Percent,
    TrendingUp,
    Wallet,
    Wrench,
    Trophy,
    Lock
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
    planned_shifts: number;
    standard_monthly_shifts: number;
    total_accrued: number;
    kpi_bonus_amount?: number;
    virtual_balance_accrued?: number;
    total_paid: number;
    total_paid_bonus?: number;
    total_bar_purchases?: number;
    bar_details?: Array<{ id: number | string; date: string; amount: number; product_name?: string; quantity?: number; shift_id?: string }>;
    balance: number;
    virtual_balance?: number;
    payment_status: 'PAID' | 'PARTIAL' | 'PENDING';
    has_active_kpi: boolean;
    has_kpi_feature?: boolean;
    has_virtual_balance_feature?: boolean;
    period_bonuses?: any[];
    checklist_bonuses?: any[];
    shift_bonuses_breakdown?: any[];
    maintenance_status?: any;
    kpi_summary?: Array<{
        metric: string;
        progress: number;
        target: number;
    }>;
    breakdown?: {
        base_salary: number;
        virtual_balance: number;
        kpi_bonuses: number;
        other_bonuses: number;
        instant_payout?: number;
        accrued_payout?: number;
    };
    metrics?: {
        total_hours?: number;
        total_revenue?: number;
        avg_revenue_per_shift?: number;
        revenue_by_metric: Record<string, {
            total: number;
            avg_per_shift: number;
        }>;
        maintenance_tasks_completed?: number;
        maintenance_tasks_assigned?: number;
        maintenance_bonus?: number;
    };
    bonuses?: Array<{ type: string; amount?: number; calculation_mode?: string }>;
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
        calculated_salary: number;  // Только REAL_MONEY
        virtual_balance_earned: number;  // VIRTUAL_BALANCE
        kpi_bonus: number;
        status: string;
        is_paid: boolean;
        type: string;
        metrics?: Record<string, number>;
        bonuses?: any[];
        real_money_bonuses?: any[];
        virtual_bonuses?: any[];
    }>;
    metric_categories?: Record<string, 'INCOME' | 'EXPENSE' | 'OTHER'>;
    metric_metadata?: Record<string, { label: string; category: string; is_numeric?: boolean }>;
    leaderboard?: {
        rank: number;
        score: number;
        total_participants: number;
        is_frozen?: boolean;
        finalized_at?: string | null;
        leader?: {
            rank: number;
            user_id: string;
            full_name: string;
            score: number;
        } | null;
        top?: Array<{
            rank: number;
            user_id: string;
            full_name: string;
            score: number;
        }>;
        breakdown?: {
            revenue: number;
            checklist: number;
            maintenance: number;
            schedule: number;
            discipline: number;
        };
        details?: {
            revenue_per_shift: number;
            completed_shifts: number;
            planned_shifts: number;
            evaluation_score: number;
            maintenance_tasks_completed: number;
            maintenance_tasks_assigned: number;
            maintenance_overdue_open_tasks: number;
            maintenance_rework_open_tasks: number;
            maintenance_stale_rework_tasks: number;
            maintenance_overdue_completed_tasks: number;
            maintenance_overdue_completed_days: number;
        };
    } | null;
}

interface PayrollData {
    period: { month: number; year: number };
    stats: PayrollStats;
    employees: Employee[];
    leaderboard?: {
        is_frozen: boolean;
        finalized_at: string | null;
        top: Array<{
            rank: number;
            user_id: string;
            full_name: string;
            score: number;
        }>;
    };
}

export default function PayrollDashboard({ clubId }: { clubId: string }) {
    const [data, setData] = useState<PayrollData | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm] = useState('');
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [activeTabs, setActiveTabs] = useState<Record<number, string>>({});
    const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
    const [paymentModal, setPaymentModal] = useState<{ open: boolean; employee: Employee | null }>({ open: false, employee: null });
    const [paymentForm, setPaymentForm] = useState({ amount: '', method: 'CASH', notes: '', paymentType: 'salary' as 'salary' | 'advance' | 'bonus' });
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

    const handleDeleteBarPurchase = async (movementId: number | string) => {
        if (!confirm('Вы уверены, что хотите отменить эту покупку? Товар будет возвращен на склад, а сумма вычтена из удержаний.')) {
            return;
        }

        try {
            const response = await fetch(`/api/clubs/${clubId}/bar-purchases/${movementId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                alert('Покупка отменена, товар возвращен на склад.');
                fetchData();
            } else {
                const error = await response.json();
                alert(`Ошибка: ${error.error}`);
            }
        } catch (error) {
            console.error('Delete bar purchase error:', error);
            alert('Не удалось отменить покупку');
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
                        kpi_summary: Array.isArray(emp.period_bonuses) ? emp.period_bonuses.map((b: any) => ({
                            metric: b.name || b.metric_key,
                            progress: b.progress_percent || 0,
                            target: b.target_value || 0,
                            is_met: b.is_met || false
                        })) : []
                    })),
                    leaderboard: json.leaderboard
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



    if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
    if (!data) return <div className="flex items-center justify-center h-64 text-muted-foreground">Нет данных</div>;

    const stats = data.stats || { total_employees: 0, total_accrued: 0, total_paid: 0, pending_payment: 0 };
    const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    const now = new Date();
    const isFuturePeriod = selectedYear > now.getFullYear() || (selectedYear === now.getFullYear() && selectedMonth > now.getMonth() + 1);

    return (
        <div className="space-y-6 p-4 md:p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Зарплаты</h1>
                    <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg self-start">
                        <Button variant="ghost" size="icon" onClick={() => navigateMonth(-1)} className="h-8 w-8"><ChevronLeft className="h-4 w-4" /></Button>
                        <div className="text-sm md:text-lg font-medium min-w-[120px] md:min-w-[160px] text-center">{monthNames[selectedMonth - 1]} {selectedYear}</div>
                        <Button variant="ghost" size="icon" onClick={() => navigateMonth(1)} className="h-8 w-8"><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {data.leaderboard?.is_frozen ? (
                        <Badge variant="secondary" className="gap-1.5 px-3 py-2 text-xs md:text-sm">
                            <Lock className="h-3.5 w-3.5" />
                            Рейтинг заморожен
                        </Badge>
                    ) : null}
                </div>
            </div>

            <div className="grid gap-3 md:gap-6 grid-cols-2 lg:grid-cols-4">
                <Card className="shadow-sm border-slate-100">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2 p-3 md:p-6">
                        <CardTitle className="text-[10px] md:text-sm font-medium text-muted-foreground uppercase tracking-wider">Сотрудники</CardTitle>
                        <div className="rounded-lg bg-primary/10 p-1.5 md:p-2"><Users className="h-3 w-3 md:h-4 md:w-4 text-primary" /></div>
                    </CardHeader>
                    <CardContent className="p-3 md:p-6 pt-0 md:pt-0">
                        <div className="text-lg md:text-2xl font-bold tracking-tight">{stats.total_employees}</div>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-slate-100">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2 p-3 md:p-6">
                        <CardTitle className="text-[10px] md:text-sm font-medium text-muted-foreground uppercase tracking-wider">Начислено</CardTitle>
                        <div className="rounded-lg bg-primary/10 p-1.5 md:p-2"><DollarSign className="h-3 w-3 md:h-4 md:w-4 text-primary" /></div>
                    </CardHeader>
                    <CardContent className="p-3 md:p-6 pt-0 md:pt-0">
                        <div className="text-lg md:text-2xl font-bold tracking-tight">{formatCurrency(stats.total_accrued)}</div>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-slate-100">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2 p-3 md:p-6">
                        <CardTitle className="text-[10px] md:text-sm font-medium text-muted-foreground uppercase tracking-wider">Выплачено</CardTitle>
                        <div className="rounded-lg bg-primary/10 p-1.5 md:p-2"><CheckCircle className="h-3 w-3 md:h-4 md:w-4 text-primary" /></div>
                    </CardHeader>
                    <CardContent className="p-3 md:p-6 pt-0 md:pt-0">
                        <div className="text-lg md:text-2xl font-bold tracking-tight">{formatCurrency(stats.total_paid)}</div>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-slate-100">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2 p-3 md:p-6">
                        <CardTitle className="text-[10px] md:text-sm font-medium text-muted-foreground uppercase tracking-wider">К выплате</CardTitle>
                        <div className="rounded-lg bg-primary/10 p-1.5 md:p-2"><Clock className="h-3 w-3 md:h-4 md:w-4 text-primary" /></div>
                    </CardHeader>
                    <CardContent className="p-3 md:p-6 pt-0 md:pt-0">
                        <div className="text-lg md:text-2xl font-bold tracking-tight">{formatCurrency(stats.pending_payment)}</div>
                    </CardContent>
                </Card>
            </div>



            {data.leaderboard?.top?.length ? (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Trophy className="h-4 w-4 text-amber-500" />
                            Рейтинг сотрудников
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {data.leaderboard.top.slice(0, 5).map((item) => (
                            <div key={item.user_id} className="flex items-center justify-between rounded-xl border px-4 py-3">
                                <div className="flex items-center gap-3">
                                    <Badge variant={item.rank === 1 ? 'default' : 'secondary'}>#{item.rank}</Badge>
                                    <span className="font-medium">{item.full_name}</span>
                                </div>
                                <span className="font-bold">{item.score.toFixed(1)} / 10</span>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            ) : null}

            {filteredEmployees.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">Сотрудники не найдены</div>
            ) : (
                <div className="space-y-4">
                    {filteredEmployees.map((employee) => (
                        <Card key={employee.id} className="transition-all hover:shadow-md border-slate-200/60 overflow-hidden">
                            <CardContent className="p-4 md:p-6">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex flex-wrap items-center gap-2 mb-4">
                                            <div>
                                                <h3 className="font-bold text-base md:text-lg text-slate-900">{employee.full_name}</h3>
                                                <p className="text-xs text-muted-foreground">{employee.role || 'Сотрудник'}</p>
                                            </div>
                                            <div className="flex flex-wrap gap-2 items-center">
                                                {employee.has_active_kpi && <Badge variant="secondary" className="text-[10px] h-5">KPI</Badge>}
                                                {employee.leaderboard?.rank ? (
                                                    <Badge variant="outline" className="text-[10px] h-5 gap-1 bg-amber-50 text-amber-700 border-amber-100">
                                                        <Trophy className="h-2.5 w-2.5" />
                                                        #{employee.leaderboard.rank} · {employee.leaderboard.score.toFixed(1)}
                                                    </Badge>
                                                ) : null}
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-4 text-xs">
                                            <div className="bg-slate-50/50 p-2 rounded-lg border border-slate-100/50">
                                                <p className="text-muted-foreground mb-1 uppercase text-[9px] font-bold tracking-wider">Смены</p>
                                                <p className="font-bold text-slate-900">{employee.shifts_count}</p>
                                            </div>
                                            <div className="bg-slate-50/50 p-2 rounded-lg border border-slate-100/50">
                                                <p className="text-muted-foreground mb-1 uppercase text-[9px] font-bold tracking-wider">Начислено</p>
                                                <p className="font-bold text-slate-900">{formatCurrency(employee.total_accrued)}</p>
                                            </div>
                                            <div className="bg-slate-50/50 p-2 rounded-lg border border-slate-100/50">
                                                <p className="text-muted-foreground mb-1 uppercase text-[9px] font-bold tracking-wider">Выплачено</p>
                                                <div className="flex flex-col">
                                                    <p className="font-bold text-slate-900">{formatCurrency(employee.total_paid)}</p>
                                                    {employee.total_paid_bonus && employee.total_paid_bonus > 0 ? (
                                                        <p className="text-[9px] text-purple-600 font-bold">+{formatCurrency(employee.total_paid_bonus)} бон.</p>
                                                    ) : null}
                                                </div>
                                            </div>
                                            <div className="bg-slate-50/50 p-2 rounded-lg border border-slate-100/50">
                                                <p className="text-muted-foreground mb-1 uppercase text-[9px] font-bold tracking-wider">Остаток</p>
                                                <p className="font-bold text-slate-900">{formatCurrency(employee.balance)}</p>
                                            </div>
                                            {employee.total_bar_purchases && employee.total_bar_purchases > 0 ? (
                                                <div className="bg-rose-50/30 p-2 rounded-lg border border-rose-100/50">
                                                    <p className="text-rose-600/70 mb-1 uppercase text-[9px] font-bold tracking-wider">Покупки бара</p>
                                                    <p className="font-bold text-rose-600">-{formatCurrency(employee.total_bar_purchases)}</p>
                                                </div>
                                            ) : null}
                                            {employee.has_kpi_feature && (
                                                <div className="bg-emerald-50/30 p-2 rounded-lg border border-emerald-100/50">
                                                    <p className="text-emerald-600/70 mb-1 uppercase text-[9px] font-bold tracking-wider">KPI премия</p>
                                                    <p className={`font-bold ${employee.kpi_bonus_amount && employee.kpi_bonus_amount > 0 ? 'text-emerald-600' : ''}`}>{formatCurrency(employee.kpi_bonus_amount || 0)}</p>
                                                </div>
                                            )}
                                            {employee.has_virtual_balance_feature && (
                                                <div className="bg-purple-50/30 p-2 rounded-lg border border-purple-100/50">
                                                    <p className="text-purple-600/70 mb-1 uppercase text-[9px] font-bold tracking-wider">Бонусный баланс</p>
                                                    <p className={`font-bold ${employee.virtual_balance && employee.virtual_balance > 0 ? 'text-purple-600' : ''}`}>{formatCurrency(employee.virtual_balance || 0)}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {expandedCards.has(employee.id) && (
                                    <div className="mt-6 pt-6 border-t animate-in fade-in duration-300">
                                        <div className="flex border-b mb-6 overflow-x-auto scrollbar-hide">
                                            {[
                                                { id: 'overview', label: 'Обзор' },
                                                { id: 'kpi', label: 'KPI и Начисления' },
                                                { id: 'shifts', label: 'Смены' },
                                                { id: 'bar', label: 'Бар' },
                                                { id: 'payments', label: 'Выплаты' }
                                            ].map((tab) => (
                                                <button
                                                    key={tab.id}
                                                    onClick={() => setActiveTabs(prev => ({ ...prev, [employee.id]: tab.id }))}
                                                    className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeTabs[employee.id] === tab.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                                                >
                                                    {tab.label}
                                                </button>
                                            ))}
                                        </div>

                                        {activeTabs[employee.id] === 'overview' && (
                                            <div className="space-y-6 animate-in slide-in-from-left-2 duration-300">
                                                {/* 1. Metrics Grid (copied from Shifts tab) */}
                                                {(() => {
                                                    const totalRevenue = employee.metrics?.total_revenue || 0;

                                                    return (
                                                        <div className="space-y-4">
                                                            {/* Total Revenue Card */}
                                                            <div className="bg-background p-4 md:p-6 rounded-2xl border shadow-sm border-slate-100">
                                                                <div className="flex justify-between items-start mb-3">
                                                                    <div>
                                                                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-1">Выручка за период</p>
                                                                        <p className="text-2xl md:text-3xl font-black tracking-tight text-slate-900">{formatCurrency(totalRevenue)}</p>
                                                                    </div>
                                                                    <div className="bg-emerald-100 p-2.5 rounded-xl text-emerald-700">
                                                                        <Wallet className="h-5 w-5" />
                                                                    </div>
                                                                </div>
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 pt-4 border-t border-dashed border-slate-100">
                                                                    {(Array.isArray(employee.period_bonuses) ? employee.period_bonuses : []).map((kpi: any) => (
                                                                        <div key={kpi.id} className="flex justify-between items-center text-xs">
                                                                            <span className="text-muted-foreground font-medium">{kpi.name}</span>
                                                                            <span className="font-bold text-slate-900">{formatCurrency(kpi.current_value)}</span>
                                                                        </div>
                                                                    ))}
                                                                    <div className="flex justify-between items-center text-xs">
                                                                        <span className="text-muted-foreground font-medium">В среднем:</span>
                                                                        <span className="font-bold text-slate-900">{formatCurrency(employee.metrics?.avg_revenue_per_shift || 0)}/смена</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })()}

                                                {employee.leaderboard?.breakdown && (
                                                    <div className="bg-amber-50/40 border border-amber-100/60 rounded-2xl p-4 md:p-6 space-y-4">
                                                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                                            <div>
                                                                <h4 className="text-sm font-bold flex items-center gap-2 text-amber-900">
                                                                    <Trophy className="h-4 w-4 text-amber-500" />
                                                                    Анализ оценки
                                                                </h4>
                                                                <p className="text-[11px] text-amber-800/70 mt-1 font-medium">
                                                                    Итог: {employee.leaderboard.score.toFixed(1)} / 10, место #{employee.leaderboard.rank} из {employee.leaderboard.total_participants}
                                                                </p>
                                                            </div>
                                                            <div className="self-start">
                                                                {employee.leaderboard.is_frozen ? (
                                                                    <Badge variant="secondary" className="gap-1.5 bg-amber-100 text-amber-800 border-amber-200">
                                                                        <Lock className="h-3 w-3" />
                                                                        Заморожен
                                                                    </Badge>
                                                                ) : (
                                                                    <Badge variant="outline" className="bg-white/50 border-amber-200 text-amber-700">Живой рейтинг</Badge>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 md:gap-3">
                                                            {[
                                                                { key: 'revenue', label: 'Выручка', weight: '35%', value: employee.leaderboard.breakdown.revenue, tone: 'emerald' },
                                                                { key: 'checklist', label: 'Чек-листы', weight: '25%', value: employee.leaderboard.breakdown.checklist, tone: 'purple' },
                                                                { key: 'maintenance', label: 'Обслуживание', weight: '20%', value: employee.leaderboard.breakdown.maintenance, tone: 'indigo' },
                                                                { key: 'schedule', label: 'График', weight: '10%', value: employee.leaderboard.breakdown.schedule, tone: 'sky' },
                                                                { key: 'discipline', label: 'Дисциплина', weight: '10%', value: employee.leaderboard.breakdown.discipline, tone: 'rose' }
                                                            ].map((item) => (
                                                                <div key={item.key} className="rounded-xl bg-white border border-amber-100/50 p-3 shadow-sm">
                                                                    <div className="flex items-center justify-between gap-2 mb-2">
                                                                        <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">{item.label}</span>
                                                                        <span className="text-[9px] font-black text-amber-600">{item.weight}</span>
                                                                    </div>
                                                                    <div className="text-lg font-black text-slate-900">{item.value.toFixed(1)}</div>
                                                                    <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                                                        <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.min(item.value * 10, 100)}%` }} />
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>

                                                        {employee.leaderboard.details && (
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                                                                <div className="rounded-xl bg-white/60 border border-amber-100/50 p-4 space-y-2 shadow-sm">
                                                                    <p className="font-bold text-amber-900 mb-2 uppercase tracking-wider text-[10px]">Исходные данные</p>
                                                                    <div className="flex justify-between gap-4"><span className="text-muted-foreground font-medium">Выручка на смену</span><span className="font-bold text-slate-900">{formatCurrency(employee.leaderboard.details.revenue_per_shift)}</span></div>
                                                                    <div className="flex justify-between gap-4"><span className="text-muted-foreground font-medium">Чек-лист средний</span><span className="font-bold text-slate-900">{employee.leaderboard.details.evaluation_score.toFixed(1)}%</span></div>
                                                                    <div className="flex justify-between gap-4"><span className="text-muted-foreground font-medium">Смены</span><span className="font-bold text-slate-900">{employee.leaderboard.details.completed_shifts} / {employee.leaderboard.details.planned_shifts || employee.leaderboard.details.completed_shifts}</span></div>
                                                                    <div className="flex justify-between gap-4"><span className="text-muted-foreground font-medium">Обслуживание</span><span className="font-bold text-slate-900">{employee.leaderboard.details.maintenance_tasks_completed} / {employee.leaderboard.details.maintenance_tasks_assigned}</span></div>
                                                                </div>
                                                                <div className="rounded-xl bg-white/60 border border-amber-100/50 p-4 space-y-2 shadow-sm">
                                                                    <p className="font-bold text-rose-900 mb-2 uppercase tracking-wider text-[10px]">Факторы снижения</p>
                                                                    <div className="flex justify-between gap-4"><span className="text-muted-foreground font-medium">Просрочки открытые</span><span className="font-bold text-rose-600">{employee.leaderboard.details.maintenance_overdue_open_tasks}</span></div>
                                                                    <div className="flex justify-between gap-4"><span className="text-muted-foreground font-medium">Возвраты в доработку</span><span className="font-bold text-rose-600">{employee.leaderboard.details.maintenance_rework_open_tasks}</span></div>
                                                                    <div className="flex justify-between gap-4"><span className="text-muted-foreground font-medium">Старые rework</span><span className="font-bold text-rose-600">{employee.leaderboard.details.maintenance_stale_rework_tasks}</span></div>
                                                                    <div className="flex justify-between gap-4"><span className="text-muted-foreground font-medium">Закрыто с просрочкой</span><span className="font-bold text-rose-600">{employee.leaderboard.details.maintenance_overdue_completed_tasks}</span></div>
                                                                    <div className="flex justify-between gap-4"><span className="text-muted-foreground font-medium">Дней просрочки</span><span className="font-bold text-rose-600">{employee.leaderboard.details.maintenance_overdue_completed_days}</span></div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}


                                            </div>
                                        )}

                                        {activeTabs[employee.id] === 'kpi' && (
                                            <div className="space-y-6 animate-in slide-in-from-left-2 duration-300">
                                                {/* Maintenance KPI Card */}
                                                {(() => {
                                                    const mBonus = employee.metrics?.revenue_by_metric?.['maintenance_bonus']?.total 
                                                        || (employee.metrics as any)?.maintenance_bonus 
                                                        || 0;
                                                    const mCompleted = (employee.metrics as any)?.maintenance_tasks_completed || 0;
                                                    const mAssigned = (employee.metrics as any)?.maintenance_tasks_assigned || 0;
                                                    
                                                    // Check if maintenance KPI is configured in bonuses
                                                    const hasMaintenanceBonus = employee.bonuses?.some((b: any) => b.type === 'maintenance_kpi' || b.type === 'MAINTENANCE_KPI');
                                                    
                                                    // Only show if explicitly configured in the salary scheme
                                                    if (!hasMaintenanceBonus) return null;

                                                    const efficiency = mAssigned > 0 ? (mCompleted / mAssigned) * 100 : (mCompleted > 0 ? 100 : 0);
                                                    
                                                    return (
                                                        <div className="bg-background border rounded-xl p-4 space-y-4 shadow-sm">
                                                            <div className="flex justify-between items-center">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                                                                        <Wrench className="h-5 w-5" />
                                                                    </div>
                                                                    <div>
                                                                        <span className="font-bold text-sm">KPI Обслуживания</span>
                                                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Эффективность</p>
                                                                    </div>
                                                                </div>
                                                                <div className="text-right">
                                                                    <span className="font-bold text-lg text-emerald-600">+{formatCurrency(mBonus)}</span>
                                                                    <p className="text-[10px] text-muted-foreground">Бонус за период</p>
                                                                </div>
                                                            </div>

                                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                                {/* Progress Bar */}
                                                                <div className="md:col-span-2 space-y-2">
                                                                    <div className="flex justify-between text-xs font-medium">
                                                                        <span>Выполнено задач</span>
                                                                        <span className={efficiency >= 90 ? "text-emerald-600" : efficiency >= 50 ? "text-amber-600" : "text-red-600"}>
                                                                            {mCompleted} / {mAssigned} ({efficiency.toFixed(0)}%)
                                                                        </span>
                                                                    </div>
                                                                    <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                                                                        <div 
                                                                            className={`h-full transition-all duration-500 rounded-full ${
                                                                                efficiency >= 90 ? 'bg-emerald-500' : 
                                                                                efficiency >= 50 ? 'bg-amber-500' : 'bg-red-500'
                                                                            }`} 
                                                                            style={{ width: `${Math.min(100, efficiency)}%` }} 
                                                                        />
                                                                    </div>
                                                                    <p className="text-[10px] text-muted-foreground">
                                                                        {efficiency >= 90 ? '🚀 Отличный результат! Максимальный бонус.' : 
                                                                         efficiency >= 50 ? '⚠️ Нормальный результат. Есть куда расти.' : 
                                                                         '❌ Низкая эффективность. Бонус может быть не начислен.'}
                                                                    </p>
                                                                </div>

                                                                {/* Stats */}
                                                                <div className="bg-muted/30 rounded-lg p-2 flex flex-col justify-center items-center text-center">
                                                                    <span className="text-[10px] text-muted-foreground uppercase">Ср. бонус за задачу</span>
                                                                    <span className="font-bold text-indigo-600">
                                                                        {mCompleted > 0 ? formatCurrency(mBonus / mCompleted) : '0 ₽'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })()}

                                                {(() => {
                                                    const standardShifts = employee.planned_shifts || employee.standard_monthly_shifts || 15;

                                                    return (
                                                        <>

                                                            <div className="bg-muted/30 p-4 rounded-xl border mt-4">
                                                                <h5 className="text-xs font-bold uppercase mb-3 text-muted-foreground">Состав начислений</h5>
                                                                <div className="space-y-2 text-sm">
                                                                        {employee.breakdown?.base_salary && employee.breakdown.base_salary > 0 ? (
                                                                            <div className="flex justify-between items-center">
                                                                                <span>База (ставка):</span>
                                                                                <span className="font-medium text-blue-600">{formatCurrency(employee.breakdown.base_salary)}</span>
                                                                            </div>
                                                                        ) : null}

                                                                        {/* Расшифровка KPI (Денежные) */}
                                                                        {employee.period_bonuses?.filter((kpi: any) => kpi.is_met && kpi.bonus_amount > 0 && kpi.payout_type !== 'VIRTUAL_BALANCE').map((kpi: any, idx: number) => (
                                                                            <div key={`kpi-cash-${idx}`} className="flex justify-between items-center text-[11px] pl-2 text-emerald-600 border-l-2 border-emerald-100 ml-1">
                                                                                <span>KPI: {kpi.name}</span>
                                                                                <span>{formatCurrency(kpi.bonus_amount)}</span>
                                                                            </div>
                                                                        ))}

                                                                        {/* Расшифровка Чек-листов (Денежные - месячные) */}
                                                                        {employee.checklist_bonuses?.filter((cb: any) => cb.is_met && cb.bonus_amount > 0 && cb.payout_type !== 'VIRTUAL_BALANCE' && cb.mode === 'MONTH').map((cb: any, idx: number) => (
                                                                            <div key={`cb-cash-month-${idx}`} className="flex justify-between items-center text-[11px] pl-2 text-emerald-600 border-l-2 border-emerald-100 ml-1">
                                                                                <span>Чек-лист (за мес): {cb.name}</span>
                                                                                <span>{formatCurrency(cb.bonus_amount)}</span>
                                                                            </div>
                                                                        ))}

                                                                        {/* Расшифровка сменных бонусов (Денежные) */}
                                                                        {employee.shift_bonuses_breakdown?.filter((sb: any) => sb.payout_type !== 'VIRTUAL_BALANCE' && sb.amount > 0).map((sb: any, idx: number) => (
                                                                            <div key={`sb-cash-${idx}`} className="flex justify-between items-center text-[11px] pl-2 text-emerald-600 border-l-2 border-emerald-100 ml-1">
                                                                                <span>{sb.name} (за смены)</span>
                                                                                <span>{formatCurrency(sb.amount)}</span>
                                                                            </div>
                                                                        ))}

                                                                        {employee.has_kpi_feature && (
                                                                            <div className="flex justify-between items-center font-bold text-emerald-600 pt-1">
                                                                                <span>Итого премия (на руки):</span>
                                                                                <span>{formatCurrency(employee.kpi_bonus_amount || 0)}</span>
                                                                            </div>
                                                                        )}

                                                                        {/* Виртуальные бонусы */}
                                                                        {employee.has_virtual_balance_feature && (
                                                                            <div className="pt-2 mt-2 border-t border-purple-100 space-y-1">
                                                                                <div className="flex justify-between items-center text-purple-600 font-bold">
                                                                                    <span>Бонусные (баланс):</span>
                                                                                    <span>{formatCurrency(employee.breakdown?.virtual_balance || 0)}</span>
                                                                                </div>
                                                                                
                                                                                {/* Расшифровка KPI (Виртуальные) */}
                                                                                {employee.period_bonuses?.filter((kpi: any) => kpi.is_met && kpi.bonus_amount > 0 && kpi.payout_type === 'VIRTUAL_BALANCE').map((kpi: any, idx: number) => (
                                                                                    <div key={`kpi-virt-${idx}`} className="flex justify-between items-center text-[10px] pl-2 text-purple-400 border-l-2 border-purple-100 ml-1">
                                                                                        <span>KPI: {kpi.name}</span>
                                                                                        <span>{formatCurrency(kpi.bonus_amount)}</span>
                                                                                    </div>
                                                                                ))}

                                                                                {/* Расшифровка Чек-листов (Виртуальные - месячные) */}
                                                                                {employee.checklist_bonuses?.filter((cb: any) => cb.is_met && cb.bonus_amount > 0 && cb.payout_type === 'VIRTUAL_BALANCE' && cb.mode === 'MONTH').map((cb: any, idx: number) => (
                                                                                    <div key={`cb-virt-month-${idx}`} className="flex justify-between items-center text-[10px] pl-2 text-purple-400 border-l-2 border-purple-100 ml-1">
                                                                                        <span>Чек-лист (за мес): {cb.name}</span>
                                                                                        <span>{formatCurrency(cb.bonus_amount)}</span>
                                                                                    </div>
                                                                                ))}

                                                                                {/* Расшифровка сменных бонусов (Виртуальные) */}
                                                                                {employee.shift_bonuses_breakdown?.filter((sb: any) => sb.payout_type === 'VIRTUAL_BALANCE' && sb.amount > 0).map((sb: any, idx: number) => (
                                                                                    <div key={`sb-virt-${idx}`} className="flex justify-between items-center text-[10px] pl-2 text-purple-400 border-l-2 border-purple-100 ml-1">
                                                                                        <span>{sb.name} (за смены)</span>
                                                                                        <span>{formatCurrency(sb.amount)}</span>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        )}

                                                                        {employee.total_bar_purchases && employee.total_bar_purchases > 0 ? (
                                                                            <div className="flex justify-between items-center text-red-600 border-t border-dashed pt-1 mt-1">
                                                                                <span>Удержание (бар):</span>
                                                                                <span>-{formatCurrency(employee.total_bar_purchases)}</span>
                                                                            </div>
                                                                        ) : null}

                                                                        <div className="pt-2 border-t mt-2 flex justify-between items-center font-bold">
                                                                            <span>Итого зарплата:</span>
                                                                            <span className="text-blue-600">{formatCurrency(employee.total_accrued)}</span>
                                                                        </div>
                                                                        
                                                                        {/* Breakdown by payout timing */}
                                                                        <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-dashed">
                                                                            <div className="bg-orange-50 p-2 rounded-lg border border-orange-100 flex flex-col items-center">
                                                                                <span className="text-[9px] text-orange-600 uppercase font-bold">В конце смены</span>
                                                                                <span className="font-bold text-sm text-orange-700">{formatCurrency(employee.breakdown?.instant_payout || 0)}</span>
                                                                            </div>
                                                                            <div className="bg-blue-50 p-2 rounded-lg border border-blue-100 flex flex-col items-center">
                                                                                <span className="text-[9px] text-blue-600 uppercase font-bold">Копить на балансе</span>
                                                                                <span className="font-bold text-sm text-blue-700">{formatCurrency(employee.breakdown?.accrued_payout || 0)}</span>
                                                                            </div>
                                                                        </div>

                                                                        {employee.has_virtual_balance_feature && (
                                                                            <div className={`pt-2 border-t flex justify-between items-center font-bold px-2 py-1 rounded -mx-2 ${employee.virtual_balance_accrued && employee.virtual_balance_accrued > 0 ? 'text-purple-600 bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800' : 'text-muted-foreground border-muted/20'}`}>
                                                                                <span>Итого на депозит:</span>
                                                                                <span>{employee.virtual_balance_accrued && employee.virtual_balance_accrued > 0 ? formatCurrency(employee.virtual_balance_accrued) : '0 ₽'}</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                            </div>

                                                            <div className="space-y-4 mt-4">
                                                                <h4 className="text-sm font-bold">Прогресс по порогам KPI</h4>
                                                                {Array.isArray(employee.period_bonuses) && employee.period_bonuses.map((kpi: any) => (
                                                                    <div key={kpi.id} className="bg-background border rounded-xl p-4 space-y-4">
                                                                        <div className="flex justify-between items-center">
                                                                            <div className="flex items-center gap-2"><div><span className="font-bold text-sm">{kpi.name}</span><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Текущая выручка</p></div></div>
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

                                                                {/* Checklist KPI Block */}
                                                                {employee.checklist_bonuses && employee.checklist_bonuses.length > 0 && (
                                                                    <div className="space-y-4">
                                                                        <h4 className="text-sm font-bold">Статус по чек-листам</h4>
                                                                        {employee.checklist_bonuses.map((bonus: any, bi: number) => (
                                                                            <div key={bi} className="bg-background border rounded-xl p-4 space-y-4">
                                                                                <div className="flex justify-between items-center">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <div>
                                                                                            <span className="font-bold text-sm">{bonus.name || 'Чек-лист'}</span>
                                                                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                                                                                                {bonus.mode === 'MONTH' ? 'Средний балл за месяц' : 'Среднее за смены'}
                                                                                            </p>
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="text-right">
                                                                                        <span className="font-bold text-lg text-purple-600">{bonus.current_value?.toFixed(1)}%</span>
                                                                                        <p className="text-[10px] text-muted-foreground">
                                                                                            Начислено: +{formatCurrency(bonus.bonus_amount || 0)}
                                                                                        </p>
                                                                                    </div>
                                                                                </div>

                                                                                <div className="bg-purple-50/50 border border-purple-100 rounded-xl p-3 flex items-start gap-3 dark:bg-purple-900/10 dark:border-purple-900/30">
                                                                                    <div className="bg-purple-100 p-1.5 rounded-lg text-purple-600 shrink-0 dark:bg-purple-900/50 dark:text-purple-400">
                                                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                                                                                    </div>
                                                                                    <div className="text-[11px] leading-relaxed text-purple-800 dark:text-purple-300">
                                                                                        <p className="font-bold mb-0.5 whitespace-nowrap">Условия вознаграждения</p>
                                                                                        <p>
                                                                                            {bonus.mode === 'MONTH' 
                                                                                                ? 'Бонус рассчитывается один раз в конце месяца по среднему баллу всех проверок.' 
                                                                                                : 'Бонус рассчитывается индивидуально за каждую смену, в которой была проверка.'}
                                                                                        </p>
                                                                                    </div>
                                                                                </div>

                                                                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                                                                                    {bonus.use_thresholds && bonus.thresholds && [...bonus.thresholds].sort((a, b) => (Number(a.from) || 0) - (Number(b.from) || 0)).map((t: any, ti: number) => (
                                                                                        <div 
                                                                                            key={ti} 
                                                                                            className={`relative p-3 rounded-xl border-2 transition-all duration-300 ${
                                                                                                t.is_met 
                                                                                                ? 'bg-purple-50/50 border-purple-400 shadow-sm dark:bg-purple-900/20 dark:border-purple-500' 
                                                                                                : 'bg-muted/10 border-muted/30 opacity-60'
                                                                                            }`}
                                                                                        >
                                                                                            <div className="flex justify-between items-start mb-2">
                                                                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                                                                                    t.is_met ? 'bg-purple-600 text-white' : 'bg-muted text-muted-foreground'
                                                                                                }`}>
                                                                                                    {t.is_met ? '✓ Пройден' : '⏳ Порог'}
                                                                                                </span>
                                                                                            </div>
                                                                                            <div className="space-y-1">
                                                                                                <p className="text-[9px] text-muted-foreground uppercase leading-none mb-1">Балл ≥</p>
                                                                                                <p className="text-xs font-black">{t.from}%</p>
                                                                                                <div className="pt-1 mt-1 border-t border-purple-100/50">
                                                                                                    <p className="text-[10px] font-bold text-purple-700">{formatCurrency(t.amount)}</p>
                                                                                                </div>
                                                                                            </div>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>

                                                                                <div className={`text-[11px] p-2 rounded-lg border ${
                                                                                    bonus.is_met 
                                                                                    ? 'text-purple-800 bg-purple-50 border-purple-200' 
                                                                                    : 'text-muted-foreground bg-white/40 border-dashed border-muted/30'
                                                                                }`}>
                                                                                    {bonus.is_met 
                                                                                        ? `✅ Цель достигнута! Бонус за уровень начислен.` 
                                                                                        : `⌛️ Для получения бонуса необходимо поднять качество выполнения чек-листа.`}
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}

                                                                {/* Maintenance KPI Block */}
                                                                {employee.maintenance_status && (
                                                                    <div className="space-y-4">
                                                                        <h4 className="text-sm font-bold">Статус обслуживания</h4>
                                                                        <div className="bg-background border rounded-xl p-4 space-y-4">
                                                                            <div className="flex justify-between items-center">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <div>
                                                                                            <span className="font-bold text-sm">{employee.maintenance_status.name || 'KPI Обслуживание'}</span>
                                                                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Единый стандарт месяца</p>
                                                                                        </div>
                                                                                    </div>
                                                                                <div className="text-right">
                                                                                    <span className="font-bold text-lg text-indigo-600">
                                                                                        {employee.maintenance_status.current_value} / {employee.maintenance_status.target_value}
                                                                                    </span>
                                                                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">выполнено по плану</p>
                                                                                </div>
                                                                            </div>

                                                                            <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 flex items-start gap-3 dark:bg-indigo-900/10 dark:border-indigo-900/30">
                                                                                <div className="bg-indigo-100 p-1.5 rounded-lg text-indigo-600 shrink-0 dark:bg-indigo-900/50 dark:text-indigo-400">
                                                                                    <Wrench className="h-4 w-4" />
                                                                                </div>
                                                                                <div className="text-[11px] leading-relaxed text-indigo-800 dark:text-indigo-300">
                                                                                    <p className="font-bold mb-0.5 whitespace-nowrap">Эффективность обслуживания: {employee.maintenance_status.efficiency.toFixed(1)}%</p>
                                                                                    <p>По плану месяца выполнено: {employee.maintenance_status.current_value} из {employee.maintenance_status.target_value}. Просрочки и доработки штрафуются деньгами, а не уменьшают процент выполнения.</p>
                                                                                </div>
                                                                            </div>

                                                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                                                                                {employee.maintenance_status.thresholds && [...employee.maintenance_status.thresholds].sort((a, b) => (Number(a.from) || 0) - (Number(b.from) || 0)).map((t: any, ti: number) => (
                                                                                    <div 
                                                                                        key={ti} 
                                                                                        className={`relative p-3 rounded-xl border-2 transition-all duration-300 ${
                                                                                            t.is_met 
                                                                                            ? 'bg-indigo-50/50 border-indigo-400 shadow-sm dark:bg-indigo-900/20 dark:border-indigo-500' 
                                                                                            : 'bg-muted/10 border-muted/30 opacity-60'
                                                                                        }`}
                                                                                    >
                                                                                        <div className="flex justify-between items-start mb-2">
                                                                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                                                                                t.is_met ? 'bg-indigo-600 text-white' : 'bg-muted text-muted-foreground'
                                                                                             }`}>
                                                                                                {t.is_met ? '✓ Пройден' : '⏳ Порог'}
                                                                                            </span>
                                                                                        </div>
                                                                                        <div className="space-y-1">
                                                                                            <p className="text-[9px] text-muted-foreground uppercase leading-none mb-1">
                                                                                                {employee.maintenance_status.calculation_mode === 'MONTHLY' ? 'Эфф. ≥' : 'Задач ≥'}
                                                                                            </p>
                                                                                            <p className="text-xs font-black">{t.from}{employee.maintenance_status.calculation_mode === 'MONTHLY' ? '%' : ''}</p>
                                                                                            <div className="pt-1 mt-1 border-t border-indigo-100/50">
                                                                                                <p className="text-[10px] font-bold text-indigo-700">{formatCurrency(t.amount)}</p>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                            </div>

                                                                            <div className="flex justify-between items-center p-3 bg-muted/20 rounded-xl border border-dashed">
                                                                                <div>
                                                                                    <p className="text-[10px] text-muted-foreground uppercase font-bold">К выплате за обслуживание</p>
                                                                                    <p className="text-lg font-black text-indigo-600">{formatCurrency(employee.maintenance_status.bonus_amount)}</p>
                                                                                    {(employee.maintenance_status.base_bonus_amount || 0) > 0 && (
                                                                                        <div className="mt-1 space-y-0.5">
                                                                                            <p className="text-[10px] text-muted-foreground">По порогу: {formatCurrency(employee.maintenance_status.base_bonus_amount || 0)}</p>
                                                                                            <p className="text-[10px] text-rose-500">Штраф применен: -{formatCurrency(employee.maintenance_status.penalty_amount || 0)}</p>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                                <div className="text-right">
                                                                                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${
                                                                                        employee.maintenance_status.is_met ? 'bg-indigo-100 text-indigo-700' : 'bg-muted text-muted-foreground'
                                                                                    }`}>
                                                                                        {employee.maintenance_status.is_met ? 'Активен' : 'Нет задач'}
                                                                                    </span>
                                                                                    {(employee.maintenance_status.old_debt_closed_tasks || 0) > 0 && (
                                                                                        <p className="text-[10px] text-muted-foreground mt-1">
                                                                                            Закрыт старый долг: {employee.maintenance_status.old_debt_closed_tasks}
                                                                                        </p>
                                                                                    )}
                                                                                    {(employee.maintenance_status.rework_open_tasks || 0) > 0 && (
                                                                                        <p className="text-[10px] text-muted-foreground mt-1">
                                                                                            Доработка: {employee.maintenance_status.rework_open_tasks}, старых: {employee.maintenance_status.stale_rework_tasks || 0}
                                                                                        </p>
                                                                                    )}
                                                                                    {(employee.maintenance_status.overdue_open_tasks || 0) > 0 && (
                                                                                        <p className="text-[10px] text-muted-foreground mt-2">
                                                                                            Просрочено сейчас: {employee.maintenance_status.overdue_open_tasks || 0}
                                                                                        </p>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}
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
                                                    const shifts = employee.shifts?.filter((s: any) => s.type !== 'PERIOD_BONUS') || [];
                                                    const totalHours = shifts.reduce((sum: number, s: any) => sum + (s.hours || s.total_hours || 0), 0);
                                                    const totalRevenue = shifts.reduce((sum: number, s: any) => sum + (s.total_revenue || 0), 0);
                                                    const totalKpiBonus = shifts.reduce((sum: number, s: any) => sum + (s.kpi_bonus || 0), 0);

                                                    // Find all relevant "OTHER" metrics
                                                    const metadata = employee.metric_metadata || {};
                                                    const kpiKeys = (employee.period_bonuses || []).map((b: any) => b.metric_key);

                                                    const otherMetrics = Object.keys(metadata).filter(key =>
                                                        metadata[key].category === 'OTHER' &&
                                                        (kpiKeys.includes(key) || metadata[key].is_numeric !== false) &&
                                                        !key.includes('comment')
                                                    );

                                                    let otherMetricTotal = 0;
                                                    let otherMetricLabel = 'Доп. продажи';

                                                    if (otherMetrics.length > 0) {
                                                        otherMetrics.forEach(key => {
                                                            otherMetricTotal += shifts.reduce((sum: number, s: any) => {
                                                                const val = s.metrics?.[key];
                                                                return sum + (typeof val === 'number' ? val : parseFloat(val || '0') || 0);
                                                            }, 0);
                                                        });

                                                        if (otherMetrics.length === 1) {
                                                            otherMetricLabel = metadata[otherMetrics[0]].label;
                                                        }
                                                    }

                                                    const upsellEfficiency = totalHours > 0 ? otherMetricTotal / totalHours : 0;
                                                    const upsellShare = totalRevenue > 0 ? (otherMetricTotal / totalRevenue) * 100 : 0;

                                                    return (
                                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                            <div className="bg-muted/30 p-3 rounded-xl border flex flex-col items-center">
                                                                <span className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Ср. эффективность</span>
                                                                <span className="font-bold text-sm flex items-center gap-1.5">
                                                                    <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                                                                    {totalHours > 0 ? formatCurrency(totalRevenue / totalHours) + '/ч' : '0 ₽/ч'}
                                                                </span>
                                                            </div>
                                                            <div className="bg-muted/30 p-3 rounded-xl border flex flex-col items-center">
                                                                <span className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Доля {otherMetricLabel}</span>
                                                                <span className="font-bold text-sm flex items-center gap-1.5"><Percent className="h-3.5 w-3.5 text-purple-500" /> {upsellShare.toFixed(1)}%</span>
                                                            </div>
                                                            <div className="bg-muted/30 p-3 rounded-xl border flex flex-col items-center">
                                                                <span className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Эфф. {otherMetricLabel}</span>
                                                                <span className="font-bold text-sm flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5 text-emerald-500" /> {formatCurrency(upsellEfficiency)}/ч</span>
                                                            </div>
                                                            <div className="bg-muted/30 p-3 rounded-xl border flex flex-col items-center">
                                                                <span className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Бонусы смен</span>
                                                                <span className="font-bold text-sm flex items-center gap-1.5"><Plus className="h-3.5 w-3.5 text-purple-500" /> {formatCurrency(totalKpiBonus)}</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })()}

                                                {/* Define identification again for the table below */}
                                                {(() => {
                                                    const metadata = employee.metric_metadata || {};
                                                    const kpiKeys = (employee.period_bonuses || []).map((b: any) => b.metric_key);
                                                    const otherMetrics = Object.keys(metadata).filter(key =>
                                                        metadata[key].category === 'OTHER' &&
                                                        (kpiKeys.includes(key) || metadata[key].is_numeric !== false) &&
                                                        !key.includes('comment')
                                                    );

                                                    const otherMetricLabel = otherMetrics.length === 1 ? metadata[otherMetrics[0]].label : 'Доп. продажи';
                                                    
                                                    // Check if any shift has virtual balance bonuses
                                                    const hasVirtualBonuses = (employee.virtual_balance_accrued || 0) > 0 || 
                                                        (employee.shifts || []).some((s: any) => (s.virtual_balance_earned || 0) > 0);

                                                    return (
                                                        <div className="rounded-xl border border-slate-100 overflow-hidden bg-white shadow-sm">
                                                            <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200">
                                                                <table className="w-full text-[11px] md:text-xs">
                                                                    <thead className="bg-slate-50 border-b border-slate-100">
                                                                        <tr className="text-muted-foreground text-left whitespace-nowrap">
                                                                            <th className="p-3 font-bold uppercase tracking-wider">Дата</th>
                                                                            <th className="p-3 font-bold uppercase tracking-wider text-center">Часы</th>
                                                                            <th className="p-3 font-bold uppercase tracking-wider text-right">Выручка</th>
                                                                            <th className="p-3 font-bold uppercase tracking-wider text-right text-indigo-600">Эффект.</th>
                                                                            <th className="p-3 font-bold uppercase tracking-wider text-right text-emerald-600">KPI</th>
                                                                            {hasVirtualBonuses && (
                                                                                <th className="p-3 font-bold uppercase tracking-wider text-right text-purple-600">Бонусные</th>
                                                                            )}
                                                                            <th className="p-3 font-bold uppercase tracking-wider text-right text-blue-600">З/П</th>
                                                                            <th className="p-3 font-bold uppercase tracking-wider text-center">Статус</th>
                                                                            <th className="p-3"></th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-slate-50">
                                                                    {(Array.isArray(employee.shifts) ? employee.shifts : [])
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
                                                                                    <td className="p-3 text-right">
                                                                                        <div className="flex flex-col items-end">
                                                                                            <span className="font-medium">{formatCurrency(revenue)}</span>
                                                                                            {(() => {
                                                                                                // Find primary KPI metric and its value
                                                                                                const primaryKPI = (employee.period_bonuses || [])[0];
                                                                                                if (primaryKPI && primaryKPI.metric_key !== 'total_revenue') {
                                                                                                    const val = shift.metrics?.[primaryKPI.metric_key];
                                                                                                    const numVal = typeof val === 'number' ? val : parseFloat(val || '0') || 0;
                                                                                                    const label = metadata[primaryKPI.metric_key]?.label || primaryKPI.name || primaryKPI.metric_key;
                                                                                                    
                                                                                                    // Check if it's maintenance or tasks
                                                                                                    const isMaintenance = primaryKPI.metric_key?.toLowerCase().includes('maintenance') || label.toLowerCase().includes('обслуживани');
                                                                                                    
                                                                                                    return (
                                                                                                        <span className="text-[9px] text-muted-foreground font-bold">
                                                                                                            {label}: {isMaintenance ? `${numVal} шт.` : formatCurrency(numVal)}
                                                                                                        </span>
                                                                                                    );
                                                                                                }
                                                                                                return null;
                                                                                            })()}
                                                                                        </div>
                                                                                    </td>
                                                                                    <td className="p-3 text-right">
                                                                                        <div className="flex flex-col items-end">
                                                                                            <span className={`text-[10px] font-bold ${efficiency > 1000 ? 'text-indigo-600' : 'text-muted-foreground'}`}>
                                                                                                {formatCurrency(efficiency)}/ч
                                                                                            </span>
                                                                                            {(() => {
                                                                                                const shiftOtherTotal = otherMetrics.reduce((sum, key) => {
                                                                                                    const val = shift.metrics?.[key];
                                                                                                    return sum + (typeof val === 'number' ? val : parseFloat(val || '0') || 0);
                                                                                                }, 0);

                                                                                                if (shiftOtherTotal > 0 && revenue > 0 && otherMetrics.length > 0) {
                                                                                                    return (
                                                                                                        <span className="text-[8px] text-indigo-400 font-bold">
                                                                                                            {((shiftOtherTotal / revenue) * 100).toFixed(0)}% доля {otherMetricLabel}
                                                                                                        </span>
                                                                                                    );
                                                                                                }
                                                                                                return null;
                                                                                            })()}
                                                                                        </div>
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
                                                                                                            
                                                                                                            // Special handling for maintenance bonuses (show monthly plan status)
                                                                                                            const isMaintenance = b.name?.toLowerCase().includes('обслуживани') || b.source_key?.toLowerCase().includes('maintenance');
                                                                                                            const displaySource = isMaintenance && employee.maintenance_status 
                                                                                                                ? `${employee.maintenance_status.efficiency.toFixed(0)}% плана` 
                                                                                                                : b.source_value ? formatCurrency(b.source_value) : null;

                                                                                                            return (
                                                                                                                <span key={bi} className="text-[8px] text-muted-foreground leading-tight whitespace-nowrap bg-muted/30 px-1 rounded flex items-center gap-1">
                                                                                                                    {label} {displaySource ? `(${displaySource})` : ''}
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
                                                                                    {hasVirtualBonuses && (
                                                                                        <td className="p-3 text-right">
                                                                                            {shift.virtual_balance_earned > 0 ? (
                                                                                                <div className="flex flex-col items-end">
                                                                                                    <span className="text-purple-600 font-black">+{formatCurrency(shift.virtual_balance_earned)}</span>
                                                                                                    {shift.virtual_bonuses && shift.virtual_bonuses.length > 0 && (
                                                                                                        <div className="flex flex-col items-end gap-0.5 mt-1 overflow-hidden">
                                                                                                            {shift.virtual_bonuses.map((b: any, bi: number) => (
                                                                                                                <span key={bi} className="text-[8px] text-purple-600 leading-tight whitespace-nowrap bg-purple-50 dark:bg-purple-900/20 px-1 rounded">
                                                                                                                    {b.name || b.type} <span className="font-bold">+{formatCurrency(b.amount)}</span>
                                                                                                                </span>
                                                                                                            ))}
                                                                                                        </div>
                                                                                                    )}
                                                                                                </div>
                                                                                            ) : (
                                                                                                <span className="text-muted-foreground/30">—</span>
                                                                                            )}
                                                                                        </td>
                                                                                    )}
                                                                                    <td className="p-3 text-right font-black text-sm text-blue-600">{formatCurrency(shift.calculated_salary)}</td>
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
                                                            </div>
                                                            {(employee.shifts || []).length === 0 && (
                                                                <div className="p-12 text-center bg-muted/5">
                                                                    <Clock className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                                                                    <p className="text-sm text-muted-foreground italic">Нет данных по сменам в этом периоде</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        )}

                                        {activeTabs[employee.id] === 'bar' && (
                                            <div className="space-y-4 animate-in slide-in-from-left-2 duration-300">
                                                <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                                                    <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
                                                        <h4 className="font-bold text-sm text-slate-900">Покупки из бара</h4>
                                                        <div className="text-right">
                                                            <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Итого удержано</p>
                                                            <p className="text-lg font-black text-rose-600">
                                                                -{formatCurrency(employee.total_bar_purchases || 0)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200">
                                                        <table className="w-full text-[11px] md:text-xs">
                                                            <thead className="bg-slate-50 border-b border-slate-100">
                                                                <tr className="text-muted-foreground text-left whitespace-nowrap">
                                                                    <th className="px-4 py-3 font-bold uppercase tracking-wider">Дата</th>
                                                                    <th className="px-4 py-3 font-bold uppercase tracking-wider">Товар</th>
                                                                    <th className="px-4 py-3 font-bold uppercase tracking-wider">Смена</th>
                                                                    <th className="px-4 py-3 text-right font-bold uppercase tracking-wider">Сумма</th>
                                                                    <th className="px-4 py-3 w-[50px]"></th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-50">
                                                                {(employee.bar_details || [])
                                                                    .map(item => (
                                                                        <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                                                                            <td className="px-4 py-3 whitespace-nowrap font-medium">{new Date(item.date).toLocaleDateString('ru-RU')}</td>
                                                                            <td className="px-4 py-3">
                                                                                <span className="font-bold text-slate-900">{item.product_name}</span>
                                                                                {item.quantity! > 1 && <span className="ml-1 text-muted-foreground">× {item.quantity}</span>}
                                                                            </td>
                                                                            <td className="px-4 py-3 font-mono text-muted-foreground">
                                                                                {item.shift_id ? `#${item.shift_id.slice(0, 8)}` : '—'}
                                                                            </td>
                                                                            <td className="px-4 py-3 text-right font-black text-rose-600">-{formatCurrency(item.amount)}</td>
                                                                            <td className="px-4 py-3 text-right">
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="icon"
                                                                                    className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                                                                                    onClick={(e) => { e.stopPropagation(); handleDeleteBarPurchase(item.id); }}
                                                                                >
                                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                                </Button>
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                {(!employee.bar_details || employee.bar_details.length === 0) && (
                                                                    <tr>
                                                                        <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground italic bg-slate-50/20">
                                                                            <p>В этом периоде покупок не было</p>
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {activeTabs[employee.id] === 'payments' && (
                                            <div className="space-y-4 animate-in slide-in-from-left-2 duration-300">
                                                <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-4 md:p-6 shadow-sm">
                                                    <h5 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6">История транзакций</h5>
                                                    <div className="space-y-3">
                                                        {(employee.payment_history || []).map((payment: any, idx: number) => (
                                                            <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white rounded-xl border border-slate-100 shadow-sm gap-4">
                                                                <div className="flex items-center gap-4">
                                                                    <div className={`p-3 rounded-xl ${payment.payment_type === 'advance' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                                        <DollarSign className="h-5 w-5" />
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-base font-black text-slate-900">{formatCurrency(payment.amount)}</p>
                                                                        <p className="text-[11px] font-medium text-muted-foreground mt-0.5">
                                                                            {new Date(payment.date).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long' })} • {
                                                                                payment.method === 'VIRTUAL' ? 'Виртуально' :
                                                                                payment.method === 'CASH' ? 'Наличные' : 'Безнал'
                                                                            }
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-none pt-3 sm:pt-0">
                                                                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider ${payment.payment_type === 'advance' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                                        {payment.payment_type === 'advance' ? 'Аванс' : 'Зарплата'}
                                                                    </span>
                                                                    {payment.id && (
                                                                        <Button 
                                                                            variant="ghost" 
                                                                            size="icon" 
                                                                            className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-xl transition-colors" 
                                                                            onClick={() => setConfirmingDeleteId(payment.id!)}
                                                                        >
                                                                            <Trash2 className="h-4 w-4" />
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {(employee.payment_history || []).length === 0 && (
                                                            <div className="py-12 text-center text-muted-foreground italic bg-white rounded-xl border border-dashed border-slate-200">
                                                                Выплат еще не было
                                                            </div>
                                                        )}
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
                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        type="button"
                                        variant={paymentForm.paymentType === 'advance' ? 'default' : 'outline'}
                                        className="flex-1"
                                        onClick={() => {
                                            const baseAmount = paymentModal.employee?.breakdown?.base_salary || 0;
                                            setPaymentForm(prev => ({ ...prev, paymentType: 'advance', amount: baseAmount.toString() }));
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
                                            setPaymentForm(prev => ({ ...prev, paymentType: 'salary', amount: fullAmount.toString() }));
                                        }}
                                    >
                                        Зарплата
                                    </Button>
                                    {paymentModal.employee.has_virtual_balance_feature && (
                                        <Button
                                        type="button"
                                        variant={paymentForm.paymentType === 'bonus' ? 'default' : 'outline'}
                                        className="flex-1"
                                        onClick={() => {
                                            const bonusAmount = paymentModal.employee?.virtual_balance || 0;
                                            setPaymentForm(prev => ({ 
                                                ...prev, 
                                                paymentType: 'bonus', 
                                                amount: bonusAmount.toString(),
                                                method: 'VIRTUAL'
                                            }));
                                        }}
                                    >
                                        Бонусы
                                    </Button>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {paymentForm.paymentType === 'advance' ? 'Аванс: только базовая часть, KPI не замораживается' :
                                 paymentForm.paymentType === 'salary' ? 'Зарплата: полная сумма с KPI, смены замораживаются' :
                                 'Бонусы: выплата с виртуального (бонусного) баланса'}
                            </p>
                        </div>
                        
                        {paymentForm.paymentType !== 'bonus' && (
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
                        )}
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

            {confirmingDeleteId && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
                    <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl border animate-in zoom-in duration-200">
                        <div className="flex items-center gap-3 text-destructive mb-4">
                            <div className="p-2 bg-destructive/10 rounded-full">
                                <Trash2 className="h-5 w-5" />
                            </div>
                            <h3 className="text-lg font-bold">Удалить выплату?</h3>
                        </div>
                        <p className="text-sm text-muted-foreground mb-6">
                            Это действие отменит фиксацию зарплаты за этот период. Все смены снова станут доступны для пересчета.
                        </p>
                        <div className="flex gap-3">
                            <Button variant="outline" onClick={() => setConfirmingDeleteId(null)} className="flex-1">Отмена</Button>
                            <Button variant="destructive" onClick={() => onDeletePaymentClick(confirmingDeleteId)} className="flex-1">Удалить</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
