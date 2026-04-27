'use client';

import { Fragment, useEffect, useState } from 'react';
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
    ChevronDown,
    ChevronUp,
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
        base_salary?: number;
        kpi_bonus: number;
        bar_deduction?: number;
        deductions?: any[];
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
    const [expandedShiftDetails, setExpandedShiftDetails] = useState<Record<number, string[]>>({});
    const [paymentModal, setPaymentModal] = useState<{ open: boolean; employee: Employee | null }>({ open: false, employee: null });
    const [paymentForm, setPaymentForm] = useState({ amount: '', method: 'CASH', notes: '', paymentType: 'salary' as 'salary' | 'advance' | 'bonus' });
    const [processingPayment, setProcessingPayment] = useState(false);
    const [periodCalcOpen, setPeriodCalcOpen] = useState(false)
    const [periodCalcStart, setPeriodCalcStart] = useState('')
    const [periodCalcEnd, setPeriodCalcEnd] = useState('')
    const [periodCalcSummary, setPeriodCalcSummary] = useState<null | { shiftsCount: number, base: number, bonuses: number, bar: number, total: number }>(null)

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

    const toggleShiftDetail = (employeeId: number, shiftId: any) => {
        const key = String(shiftId)
        setExpandedShiftDetails(prev => {
            const list = Array.isArray(prev[employeeId]) ? [...prev[employeeId]] : []
            const idx = list.indexOf(key)
            if (idx >= 0) list.splice(idx, 1)
            else list.push(key)
            return { ...prev, [employeeId]: list }
        })
    }

    const isShiftExpanded = (employeeId: number, shiftId: any) => {
        const key = String(shiftId)
        const list = expandedShiftDetails[employeeId]
        return Array.isArray(list) && list.includes(key)
    }

    const openPaymentModal = (employee: Employee) => {
        setPaymentModal({ open: true, employee });
        setPeriodCalcOpen(false)
        setPeriodCalcStart('')
        setPeriodCalcEnd('')
        setPeriodCalcSummary(null)
        setPaymentForm({
            amount: employee.balance.toString(),
            method: 'CASH',
            notes: '',
            paymentType: 'salary'
        });
    };

    const closePaymentModal = () => {
        setPaymentModal({ open: false, employee: null });
        setPeriodCalcOpen(false)
        setPeriodCalcStart('')
        setPeriodCalcEnd('')
        setPeriodCalcSummary(null)
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

    useEffect(() => {
        if (!paymentModal.open || !paymentModal.employee || !periodCalcStart || !periodCalcEnd) {
            setPeriodCalcSummary(null)
            return
        }

        const shifts = paymentModal.employee.shifts || []
        const filtered = shifts.filter((s) => {
            const d = new Date(s.date).toISOString().slice(0, 10)
            return d >= periodCalcStart && d <= periodCalcEnd
        })

        const base = filtered.reduce((sum, s) => sum + (Number(s.base_salary) || 0), 0)
        const bonuses = filtered.reduce((sum, s) => {
            const list = Array.isArray(s.real_money_bonuses) ? s.real_money_bonuses : []
            return sum + list.reduce((acc: number, b: any) => acc + (parseFloat(b.amount) || 0), 0)
        }, 0)
        const bar = filtered.reduce((sum, s) => sum + (Number(s.bar_deduction) || 0), 0)
        const total = filtered.reduce((sum, s) => sum + (Number(s.calculated_salary) || 0), 0)

        setPeriodCalcSummary({
            shiftsCount: filtered.length,
            base,
            bonuses,
            bar,
            total
        })
    }, [paymentModal.employee, paymentModal.open, periodCalcEnd, periodCalcStart])

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

    const PayrollKpiTab = ({ employee }: { employee: any }) => {
        const [openThresholds, setOpenThresholds] = useState<Record<string, boolean>>({});
        const [openMaintenanceThresholds, setOpenMaintenanceThresholds] = useState(false);

        const shifts = (Array.isArray(employee.shifts) ? employee.shifts : []).filter((s: any) => s.type !== 'PERIOD_BONUS');
        const shiftBonusMap = new Map<string, { name: string; payoutType: string; amount: number }>();

        shifts.forEach((s: any) => {
            const list = Array.isArray(s.bonuses) ? s.bonuses : [];
            list.forEach((b: any) => {
                const type = String(b?.type || '');
                const mode = String(b?.mode || '');
                if (type === 'PERIOD_BONUS_CONTRIBUTION' || mode === 'MONTH') return;

                const payoutType = String(b?.payout_type || 'REAL_MONEY');
                const name = String(b?.name || b?.type || 'Бонус');
                const key = `${payoutType}||${name}`;
                const existing = shiftBonusMap.get(key);
                const amt = parseFloat(b?.amount) || 0;
                if (existing) existing.amount += amt;
                else shiftBonusMap.set(key, { name, payoutType, amount: amt });
            });
        });

        const shiftBonusesReal = Array.from(shiftBonusMap.values())
            .filter(v => v.payoutType !== 'VIRTUAL_BALANCE' && v.amount > 0.0001)
            .sort((a, b) => b.amount - a.amount);
        const shiftBonusesVirtual = Array.from(shiftBonusMap.values())
            .filter(v => v.payoutType === 'VIRTUAL_BALANCE' && v.amount > 0.0001)
            .sort((a, b) => b.amount - a.amount);

        const rawMonthlyKpis = Array.isArray(employee.period_bonuses) ? employee.period_bonuses : [];
        const kpiGroups = new Map<string, any[]>();
        rawMonthlyKpis.forEach((k: any) => {
            const key = String(k?.metric_key || k?.source || k?.name || '');
            const arr = kpiGroups.get(key) || [];
            arr.push(k);
            kpiGroups.set(key, arr);
        });
        const kpiGroupMeta = new Map<string, { showRole: boolean, dedupe: boolean }>();
        kpiGroups.forEach((arr, key) => {
            if (!key || arr.length <= 1) {
                kpiGroupMeta.set(key, { showRole: false, dedupe: false });
                return;
            }
            const first = arr[0];
            const allSame = arr.every((x: any) =>
                Number(x?.bonus_amount || 0) === Number(first?.bonus_amount || 0) &&
                Number(x?.target_value || 0) === Number(first?.target_value || 0) &&
                String(x?.payout_type || 'REAL_MONEY') === String(first?.payout_type || 'REAL_MONEY')
            );
            kpiGroupMeta.set(key, { showRole: !allSame, dedupe: allSame });
        });
        const seenKpiKeys = new Set<string>();
        const monthlyKpis = rawMonthlyKpis.filter((k: any) => {
            const key = String(k?.metric_key || k?.source || k?.name || '');
            const meta = kpiGroupMeta.get(key);
            if (meta?.dedupe) {
                if (seenKpiKeys.has(key)) return false;
                seenKpiKeys.add(key);
                return true;
            }
            return true;
        });
        const monthCash = monthlyKpis.filter((k: any) => k?.payout_type !== 'VIRTUAL_BALANCE' && Number(k?.bonus_amount || 0) > 0);
        const monthVirtual = monthlyKpis.filter((k: any) => k?.payout_type === 'VIRTUAL_BALANCE' && Number(k?.bonus_amount || 0) > 0);

        const checklist = Array.isArray(employee.checklist_bonuses) ? employee.checklist_bonuses : [];

        const base = Number(employee.breakdown?.base_salary || 0);
        const premiumTotal = Number(employee.kpi_bonus_amount || 0);
        const perShiftBonusTotal = shiftBonusesReal.reduce((sum, x) => sum + x.amount, 0);
        const deductions = Number(employee.total_bar_purchases || 0);
        const total = Number(employee.total_accrued || 0);

        const instant = Number(employee.breakdown?.instant_payout || 0);
        const accrued = Number(employee.breakdown?.accrued_payout || 0);
        const virtualTotal = Number(employee.virtual_balance_accrued || 0);

        const progressPercent = (k: any) => {
            const p = Number(k?.progress_percent);
            if (Number.isFinite(p) && p > 0) return Math.max(0, Math.min(100, p));
            const cur = Number(k?.current_value || 0);
            const tgt = Number(k?.target_value || 0);
            if (tgt > 0) return Math.max(0, Math.min(100, (cur / tgt) * 100));
            return 0;
        };

        const toggleThresholds = (key: string) => {
            setOpenThresholds(prev => ({ ...prev, [key]: !prev[key] }));
        };

        return (
            <div className="space-y-4">
                <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="p-6">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                            <div className="min-w-0">
                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Начисления за месяц</div>
                                <div className="mt-1 text-3xl font-black tracking-tight text-slate-900">{formatCurrency(total)}</div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 min-w-[260px]">
                                <div className="rounded-2xl border border-orange-200 bg-orange-50/60 p-3 text-center">
                                    <div className="text-[9px] font-black uppercase tracking-widest text-orange-700">В конце смен</div>
                                    <div className="mt-1 text-lg font-black text-orange-800">{formatCurrency(instant)}</div>
                                </div>
                                <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-3 text-center">
                                    <div className="text-[9px] font-black uppercase tracking-widest text-blue-700">В накопление</div>
                                    <div className="mt-1 text-lg font-black text-blue-800">{formatCurrency(accrued)}</div>
                                </div>
                                <div className="col-span-2 rounded-2xl border border-purple-200 bg-purple-50/60 p-3 text-center">
                                    <div className="text-[9px] font-black uppercase tracking-widest text-purple-700">Виртуальный баланс</div>
                                    <div className="mt-1 text-lg font-black text-purple-800">{formatCurrency(virtualTotal)}</div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-5 grid gap-4 lg:grid-cols-2">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50/30 p-4">
                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Что вошло</div>
                                <div className="mt-3 space-y-2 text-sm">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="text-slate-700">База</div>
                                        <div className="font-black text-slate-900 whitespace-nowrap">{formatCurrency(base)}</div>
                                    </div>
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="text-slate-700">Премия</div>
                                        <div className="font-black text-emerald-700 whitespace-nowrap">+{formatCurrency(premiumTotal)}</div>
                                    </div>
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="text-slate-700">Удержания (бар)</div>
                                        <div className="font-black text-rose-700 whitespace-nowrap">-{formatCurrency(deductions)}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-slate-50/30 p-4">
                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Премия: состав</div>
                                <div className="mt-3 space-y-2 text-sm">
                                    {(() => {
                                        const features = employee.scheme_features || {}

                                        const showShift = (features.has_shift_premium !== undefined) ? !!features.has_shift_premium : shiftBonusesReal.length > 0
                                        const showMonthKpi = monthlyKpis.length > 0
                                        const showChecklistMonth = (features.has_checklist_month !== undefined) ? !!features.has_checklist_month : checklist.some((c: any) => String(c?.mode || '').toUpperCase() === 'MONTH')
                                        const showMaintenance = (features.has_maintenance !== undefined) ? !!features.has_maintenance : !!employee.maintenance_status

                                        const shiftAmount = perShiftBonusTotal
                                        const monthKpiAmount = monthlyKpis
                                            .filter((k: any) => String(k?.payout_type || 'REAL_MONEY') !== 'VIRTUAL_BALANCE')
                                            .reduce((sum: number, k: any) => sum + Number(k?.bonus_amount || 0), 0)
                                        const checklistMonthAmount = checklist
                                            .filter((c: any) => String(c?.mode || '').toUpperCase() === 'MONTH' && String(c?.payout_type || 'REAL_MONEY') !== 'VIRTUAL_BALANCE')
                                            .reduce((sum: number, c: any) => sum + Number(c?.bonus_amount || 0), 0)
                                        const maintenanceAmount = (employee.maintenance_status && String(employee.maintenance_status.payout_type || 'REAL_MONEY') !== 'VIRTUAL_BALANCE')
                                            ? Number(employee.maintenance_status.bonus_amount || 0)
                                            : 0

                                        return (
                                            <>
                                                {showShift && (
                                                    <div className="flex items-center justify-between gap-4">
                                                        <div className="text-slate-700">Бонусы за смены</div>
                                                        <div className="font-black text-slate-900 whitespace-nowrap">{formatCurrency(shiftAmount)}</div>
                                                    </div>
                                                )}
                                                {showMonthKpi && (
                                                    <div className="flex items-center justify-between gap-4">
                                                        <div className="text-slate-700">KPI за месяц</div>
                                                        <div className="font-black text-slate-900 whitespace-nowrap">{formatCurrency(monthKpiAmount)}</div>
                                                    </div>
                                                )}
                                                {showChecklistMonth && (
                                                    <div className="flex items-center justify-between gap-4">
                                                        <div className="text-slate-700">Чек-листы (месяц)</div>
                                                        <div className="font-black text-slate-900 whitespace-nowrap">{formatCurrency(checklistMonthAmount)}</div>
                                                    </div>
                                                )}
                                                {showMaintenance && (
                                                    <div className="flex items-center justify-between gap-4">
                                                        <div className="text-slate-700">Обслуживание</div>
                                                        <div className="font-black text-slate-900 whitespace-nowrap">{formatCurrency(maintenanceAmount)}</div>
                                                    </div>
                                                )}
                                            </>
                                        )
                                    })()}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6 space-y-4">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="text-sm font-black text-slate-900">KPI за месяц</div>
                        <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
                            План: {employee.planned_shifts || employee.standard_monthly_shifts || 15} смен
                        </Badge>
                    </div>

                    {monthlyKpis.length > 0 ? (
                        <div className="space-y-3">
                            {monthlyKpis.map((k: any, idx: number) => {
                                const percent = progressPercent(k);
                                const bonusAmount = Number(k?.bonus_amount || 0);
                                const payoutType = String(k?.payout_type || 'REAL_MONEY');
                                const pill = payoutType === 'VIRTUAL_BALANCE'
                                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200';
                                const rewardLabel = payoutType === 'VIRTUAL_BALANCE' ? 'Депозит' : 'Деньги';
                                const kpiKey = String(k?.metric_key || k?.source || k?.name || '');
                                const showRoleBadge = !!kpiGroupMeta.get(kpiKey)?.showRole;
                                const current = Number(k?.current_value || 0);
                                const target = Number(k?.target_value || 0);
                                const isRankKpi = String(k?.metric_key || '') === 'leaderboard_rank';
                                const rankValue = employee?.leaderboard?.rank ?? current;
                                const rankTotal = employee?.leaderboard?.total_participants;
                                const thresholds = Array.isArray(k?.thresholds) ? k.thresholds : [];
                                const kKey = String(k?.id || k?.metric_key || `kpi-${idx}`);
                                const isOpen = !!openThresholds[kKey];
                                const sortedThresholds = [...thresholds].sort((a: any, b: any) => (Number(a?.from || 0) - Number(b?.from || 0)));
                                const metThresholdIndex = sortedThresholds.reduce((acc: number, t: any, i: number) => {
                                    const from = Number(t?.from || 0);
                                    return current >= from ? i : acc;
                                }, -1);
                                const currentTier = metThresholdIndex >= 0 ? sortedThresholds[metThresholdIndex] : null;
                                const currentTierLabel = currentTier?.label ? String(currentTier.label) : currentTier ? `≥ ${formatCurrency(Number(currentTier.from || 0))}` : '—';
                                const currentTierReward = currentTier
                                    ? (Number(currentTier?.amount || 0) > 0 ? formatCurrency(Number(currentTier.amount || 0)) : `${Number(currentTier?.percent || 0)}%`)
                                    : null;
                                const tierPos = sortedThresholds.length > 0 ? `${Math.max(0, metThresholdIndex + 1)}/${sortedThresholds.length}` : null;

                                return (
                                    <div key={k?.id || `kpi-${idx}`} className="rounded-2xl border border-slate-200 p-4">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <div className="text-sm font-black text-slate-900 truncate">{k?.name || 'KPI'}</div>
                                                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-tight border ${pill}`}>{rewardLabel}</span>
                                                    {showRoleBadge && k?.role_name ? (
                                                        <span className="text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-tight border bg-slate-50 text-slate-700 border-slate-200">
                                                            {String(k.role_name)}
                                                        </span>
                                                    ) : null}
                                                </div>
                                                <div className="mt-1 text-[11px] text-slate-600">
                                                    {isRankKpi ? (
                                                        <>
                                                            Место: <span className="font-bold text-slate-900">{rankValue}</span>
                                                            {rankTotal ? <span> из <span className="font-bold text-slate-900">{rankTotal}</span></span> : null}
                                                            {target ? <span> • Цель: <span className="font-bold text-slate-900">{target}</span></span> : null}
                                                        </>
                                                    ) : (
                                                        <>
                                                            Текущее значение: <span className="font-bold text-slate-900">{formatCurrency(current)}</span> • Цель: <span className="font-bold text-slate-900">{formatCurrency(target)}</span>
                                                        </>
                                                    )}
                                                </div>
                                                {sortedThresholds.length > 0 ? (
                                                    <div className="mt-1 text-[11px] text-slate-600">
                                                        Ступень: <span className="font-bold text-slate-900">{currentTierLabel}</span> <span className="text-slate-500">({tierPos})</span>
                                                        {currentTierReward ? <span> • <span className="font-bold text-slate-900">{currentTierReward}</span></span> : null}
                                                    </div>
                                                ) : null}
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Начислено</div>
                                                <div className={`text-lg font-black whitespace-nowrap ${payoutType === 'VIRTUAL_BALANCE' ? 'text-purple-700' : 'text-emerald-700'}`}>
                                                    +{formatCurrency(bonusAmount)}
                                                </div>
                                                {sortedThresholds.length > 0 ? (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="mt-2 h-7 px-2 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-slate-900"
                                                        onClick={() => toggleThresholds(kKey)}
                                                    >
                                                        Ступени {isOpen ? <ChevronUp className="ml-1 h-3.5 w-3.5" /> : <ChevronDown className="ml-1 h-3.5 w-3.5" />}
                                                    </Button>
                                                ) : null}
                                            </div>
                                        </div>
                                        <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden">
                                            <div className="h-full rounded-full bg-slate-900/70" style={{ width: `${percent}%` }} />
                                        </div>
                                        <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                            <span>Прогресс</span>
                                            <span>{Math.round(percent)}%</span>
                                        </div>
                                        {isOpen && sortedThresholds.length > 0 ? (
                                            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/40 p-3">
                                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Ступени</div>
                                                <div className="mt-2 space-y-2">
                                                    {sortedThresholds.map((t: any, ti: number) => {
                                                        const from = Number(t?.from || 0);
                                                        const originalFrom = Number(t?.original_from || 0);
                                                        const amount = Number(t?.amount || 0);
                                                        const pct = Number(t?.percent || 0);
                                                        const reward = amount > 0 ? formatCurrency(amount) : `${pct}%`;
                                                        const isActive = ti === metThresholdIndex;
                                                        const isMet = current >= from;
                                                        const rowClass = isActive
                                                            ? 'rounded-xl border border-slate-300 bg-white px-2 py-1 -mx-2'
                                                            : isMet
                                                                ? 'text-slate-700'
                                                                : 'text-slate-400';
                                                        return (
                                                            <div key={`${kKey}-th-${ti}`} className={`flex items-start justify-between gap-4 ${rowClass}`}>
                                                                <div className="min-w-0">
                                                                    <div className="text-[11px] font-bold text-slate-900">
                                                                        {t?.label ? String(t.label) : `≥ ${formatCurrency(from)}`}
                                                                    </div>
                                                                    {originalFrom > 0 && originalFrom !== from ? (
                                                                        <div className="text-[10px] text-slate-500">
                                                                            База: {formatCurrency(originalFrom)}
                                                                        </div>
                                                                    ) : null}
                                                                </div>
                                                                <div className="text-[11px] font-black text-slate-900 whitespace-nowrap">{reward}</div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-sm text-muted-foreground">KPI за месяц не настроены</div>
                    )}

                    {employee.maintenance_status && (Number(employee.maintenance_status.bonus_amount || 0) > 0 || Number(employee.maintenance_status.current_value || 0) > 0) ? (
                        <div className="pt-4 border-t border-slate-200">
                            {(() => {
                                const thresholds = Array.isArray(employee.maintenance_status?.thresholds) ? employee.maintenance_status.thresholds : [];
                                const sortedThresholds = [...thresholds].sort((a: any, b: any) => (Number(a?.from || 0) - Number(b?.from || 0)));
                                const mode = String(employee.maintenance_status?.calculation_mode || '');
                                const metricValue = mode === 'MONTHLY' ? Number(employee.maintenance_status?.efficiency || 0) : Number(employee.maintenance_status?.current_value || 0);
                                const metIndex = sortedThresholds.reduce((acc: number, t: any, i: number) => {
                                    const from = Number(t?.from || 0);
                                    return metricValue >= from ? i : acc;
                                }, -1);
                                const tier = metIndex >= 0 ? sortedThresholds[metIndex] : null;
                                const tierLabel = tier?.label ? String(tier.label) : tier ? `≥ ${tier.from}${mode === 'MONTHLY' ? '%' : ''}` : '—';
                                const tierReward = tier ? formatCurrency(Number(tier?.amount || 0)) : null;
                                const tierPos = sortedThresholds.length > 0 ? `${Math.max(0, metIndex + 1)}/${sortedThresholds.length}` : null;
                                const penaltyAmount = Number(employee.maintenance_status?.penalty_amount || 0);
                                const penaltyRawAmount = Number(employee.maintenance_status?.penalty_raw_amount || 0);
                                const baseBonusAmount = Number(employee.maintenance_status?.base_bonus_amount || 0);
                                const qualityPenaltyUnits = Number(employee.maintenance_status?.quality_penalty_units || 0);

                                return (
                                    <>
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="min-w-0">
                                                <div className="text-sm font-black text-slate-900">{employee.maintenance_status.name || 'KPI Обслуживание'}</div>
                                                <div className="mt-1 text-[11px] text-slate-600">
                                                    Выполнено: <span className="font-bold text-slate-900">{employee.maintenance_status.current_value}</span> из <span className="font-bold text-slate-900">{employee.maintenance_status.target_value}</span> • Эффективность: <span className="font-bold text-slate-900">{Number(employee.maintenance_status.efficiency || 0).toFixed(0)}%</span>
                                                </div>
                                                {sortedThresholds.length > 0 ? (
                                                    <div className="mt-1 text-[11px] text-slate-600">
                                                        Ступень: <span className="font-bold text-slate-900">{tierLabel}</span> <span className="text-slate-500">({tierPos})</span>
                                                        {tierReward ? <span> • <span className="font-bold text-slate-900">{tierReward}</span></span> : null}
                                                    </div>
                                                ) : null}
                                                {(penaltyAmount > 0 || qualityPenaltyUnits > 0) ? (
                                                    <div className="mt-1 text-[11px] text-slate-600">
                                                        {penaltyAmount > 0 ? (
                                                            <>
                                                                Штраф: <span className="font-bold text-rose-700">-{formatCurrency(penaltyAmount)}</span>
                                                                {baseBonusAmount > 0 ? <span> • База: <span className="font-bold text-slate-900">{formatCurrency(baseBonusAmount)}</span></span> : null}
                                                            </>
                                                        ) : null}
                                                        {qualityPenaltyUnits > 0 ? (
                                                            <span>{penaltyAmount > 0 ? ' • ' : ''}Качество: <span className="font-bold text-rose-700">-{qualityPenaltyUnits}</span></span>
                                                        ) : null}
                                                    </div>
                                                ) : null}
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Начислено</div>
                                                <div className="text-lg font-black text-indigo-700 whitespace-nowrap">+{formatCurrency(employee.maintenance_status.bonus_amount || 0)}</div>
                                                {Array.isArray(employee.maintenance_status.thresholds) && employee.maintenance_status.thresholds.length > 0 ? (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="mt-2 h-7 px-2 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-slate-900"
                                                        onClick={() => setOpenMaintenanceThresholds(v => !v)}
                                                    >
                                                        Ступени {openMaintenanceThresholds ? <ChevronUp className="ml-1 h-3.5 w-3.5" /> : <ChevronDown className="ml-1 h-3.5 w-3.5" />}
                                                    </Button>
                                                ) : null}
                                            </div>
                                        </div>
                                        {openMaintenanceThresholds && Array.isArray(employee.maintenance_status.thresholds) && employee.maintenance_status.thresholds.length > 0 ? (
                                            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/40 p-3">
                                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Ступени</div>
                                                <div className="mt-2 space-y-2">
                                                    {[...employee.maintenance_status.thresholds]
                                                        .sort((a: any, b: any) => (Number(a?.from || 0) - Number(b?.from || 0)))
                                                        .map((t: any, ti: number) => {
                                                            const from = Number(t?.from || 0);
                                                            const isActive = ti === metIndex;
                                                            const isMet = metricValue >= from;
                                                            const rowClass = isActive
                                                                ? 'rounded-xl border border-slate-300 bg-white px-2 py-1 -mx-2'
                                                                : isMet
                                                                    ? 'text-slate-700'
                                                                    : 'text-slate-400';
                                                            return (
                                                                <div key={`maint-th-${ti}`} className={`flex items-start justify-between gap-4 ${rowClass}`}>
                                                                    <div className="text-[11px] font-bold text-slate-900">
                                                                        {t?.label ? String(t.label) : `≥ ${t.from}${employee.maintenance_status.calculation_mode === 'MONTHLY' ? '%' : ''}`}
                                                                    </div>
                                                                    <div className="text-[11px] font-black text-slate-900 whitespace-nowrap">
                                                                        {formatCurrency(Number(t?.amount || 0))}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                </div>
                                            </div>
                                        ) : null}
                                    </>
                                );
                            })()}
                        </div>
                    ) : null}
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6 space-y-4">
                        <div className="text-sm font-black text-slate-900">Бонусы за смены</div>
                        {shiftBonusesReal.length > 0 ? (
                            <div className="space-y-2">
                                {shiftBonusesReal.map((b, i) => (
                                    <div key={`sb-${i}`} className="flex items-start justify-between gap-4">
                                        <div className="min-w-0">
                                            <div className="text-sm font-bold text-slate-900 truncate">{b.name}</div>
                                        </div>
                                        <div className="text-sm font-black text-emerald-700 whitespace-nowrap">+{formatCurrency(b.amount)}</div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-sm text-muted-foreground">Бонусов за смены нет</div>
                        )}

                        {shiftBonusesVirtual.length > 0 ? (
                            <div className="pt-4 border-t border-slate-200">
                                <div className="text-[10px] font-black uppercase tracking-widest text-purple-600">Виртуальный баланс</div>
                                <div className="mt-3 space-y-2">
                                    {shiftBonusesVirtual.map((b, i) => (
                                        <div key={`sv-${i}`} className="flex items-start justify-between gap-4">
                                            <div className="min-w-0">
                                                <div className="text-sm font-bold text-slate-900 truncate">{b.name}</div>
                                            </div>
                                            <div className="text-sm font-black text-purple-700 whitespace-nowrap">+{formatCurrency(b.amount)}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6 space-y-4">
                        <div className="text-sm font-black text-slate-900">Чек-листы</div>
                        {checklist.length > 0 ? (
                            <div className="space-y-3">
                                {checklist.map((b: any, i: number) => (
                                    <div key={`cl-${i}`} className="rounded-2xl border border-slate-200 p-4">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="min-w-0">
                                                <div className="text-sm font-black text-slate-900 truncate">{b?.name || 'Чек-лист'}</div>
                                                <div className="mt-1 text-[11px] text-slate-600">
                                                    {String(b?.mode) === 'MONTH' ? 'За месяц' : 'За смены'} • Текущий балл: <span className="font-bold text-slate-900">{Number(b?.current_value || 0).toFixed(1)}%</span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Начислено</div>
                                                <div className={`text-lg font-black whitespace-nowrap ${String(b?.payout_type) === 'VIRTUAL_BALANCE' ? 'text-purple-700' : 'text-emerald-700'}`}>
                                                    +{formatCurrency(Number(b?.bonus_amount || 0))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-sm text-muted-foreground">Чек-листы не настроены</div>
                        )}
                    </div>
                </div>

                <div className="rounded-3xl border border-rose-200 bg-rose-50/30 shadow-sm p-6 space-y-3">
                    <div className="text-sm font-black text-rose-700">Удержания</div>
                    <div className="flex items-center justify-between gap-4">
                        <div className="text-sm font-bold text-slate-900">Бар (в счёт зарплаты)</div>
                        <div className="text-sm font-black text-rose-700 whitespace-nowrap">-{formatCurrency(deductions)}</div>
                    </div>
                </div>
            </div>
        );
    };

    const shiftTypeLabel = (v: any) => {
        const s = String(v || '').toUpperCase()
        if (s === 'DAY') return 'День'
        if (s === 'NIGHT') return 'Ночь'
        return s ? s : '—'
    }

    const dayOfWeekLabel = (d: Date) => {
        const js = d.getDay()
        if (js === 0) return 'Вс'
        if (js === 1) return 'Пн'
        if (js === 2) return 'Вт'
        if (js === 3) return 'Ср'
        if (js === 4) return 'Чт'
        if (js === 5) return 'Пт'
        return 'Сб'
    }

    const bonusExplainLine = (b: any, shift: any) => {
        if (!b) return null
        if (b.type === 'PERSONAL_OVERPLAN') {
            const dow = String(b.day_of_week || '')
            const dowRu = dow === 'MON' ? 'Пн' : dow === 'TUE' ? 'Вт' : dow === 'WED' ? 'Ср' : dow === 'THU' ? 'Чт' : dow === 'FRI' ? 'Пт' : dow === 'SAT' ? 'Сб' : dow === 'SUN' ? 'Вс' : dow
            const st = shiftTypeLabel(b.shift_type)
            const fact = Number(b.source_value || 0)
            const plan = Number(b.plan_per_shift || 0)
            const kpi = Math.round(Number(b.kpi_percent || 0))
            const over = Math.round(Number(b.over_percent || 0))
            const perc = Math.round(Number(b.bonus_percent || 0))
            const base = Number(b.base_amount || 0)
            return `${dowRu} / ${st}: факт ${formatCurrency(fact)} / план ${formatCurrency(plan)} (${kpi}%) → +${over}% → ${perc}% от базы ${formatCurrency(base)}`
        }

        if (b.source_key) {
            const sourceLabels: Record<string, string> = {
                total_revenue: 'Выручка',
                revenue_cash: 'Наличные',
                revenue_card: 'Безнал',
                total: 'Выручка',
                cash: 'Наличные',
                card: 'Безнал',
                checklist_score: 'Чек-лист',
                maintenance_tasks: 'Обслуживание'
            }
            const label = sourceLabels[String(b.source_key)] || String(b.source_key)
            if (b.source_key === 'checklist_score') return `${label}: ${Number(b.source_value || 0).toFixed(0)}%`
            return b.source_value !== undefined && b.source_value !== null ? `${label}: ${formatCurrency(Number(b.source_value || 0))}` : null
        }

        return null
    }



    if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
    if (!data) return <div className="flex items-center justify-center h-64 text-muted-foreground">Нет данных</div>;

    const stats = data.stats || { total_employees: 0, total_accrued: 0, total_paid: 0, pending_payment: 0 };
    const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

    return (
        <div className="space-y-8 pb-28 sm:pb-12">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-8">
                <div className="flex flex-col gap-4">
                    <div className="space-y-1">
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900">Зарплаты</h1>
                        <p className="text-slate-500 text-lg mt-2">Начисления, выплаты и остатки по сотрудникам</p>
                    </div>
                    <div className="flex w-full items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-2 md:w-auto md:gap-3 shadow-sm">
                        <Button variant="ghost" size="icon" onClick={() => navigateMonth(-1)} className="h-10 w-10 rounded-xl md:h-8 md:w-8 md:rounded-md"><ChevronLeft className="h-4 w-4" /></Button>
                        <div className="min-w-0 flex-1 text-center text-xl font-semibold tracking-[-0.03em] text-slate-900 md:min-w-[160px] md:flex-none md:text-lg md:font-medium md:tracking-normal">
                            {monthNames[selectedMonth - 1]} <span className="text-muted-foreground">{selectedYear}</span>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => navigateMonth(1)} className="h-10 w-10 rounded-xl md:h-8 md:w-8 md:rounded-md"><ChevronRight className="h-4 w-4" /></Button>
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

            <div className="grid grid-cols-2 gap-3 md:gap-6 lg:grid-cols-4">
                <div className="bg-white rounded-3xl border border-slate-200 p-6 flex flex-col gap-4">
                    <div className="flex flex-row items-center justify-between space-y-0">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Сотрудники</h3>
                        <div className="rounded-lg bg-primary/10 p-1.5 md:p-2"><Users className="h-3.5 w-3.5 text-primary md:h-4 md:w-4" /></div>
                    </div>
                    <div>
                        <div className="text-3xl font-black tracking-tight text-slate-900">{stats.total_employees}</div>
                    </div>
                </div>
                <div className="bg-white rounded-3xl border border-slate-200 p-6 flex flex-col gap-4">
                    <div className="flex flex-row items-center justify-between space-y-0">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Начислено</h3>
                        <div className="rounded-lg bg-primary/10 p-1.5 md:p-2"><DollarSign className="h-3.5 w-3.5 text-primary md:h-4 md:w-4" /></div>
                    </div>
                    <div>
                        <div className="text-3xl font-black tracking-tight text-slate-900">{formatCurrency(stats.total_accrued)}</div>
                    </div>
                </div>
                <div className="bg-white rounded-3xl border border-slate-200 p-6 flex flex-col gap-4">
                    <div className="flex flex-row items-center justify-between space-y-0">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Выплачено</h3>
                        <div className="rounded-lg bg-primary/10 p-1.5 md:p-2"><CheckCircle className="h-3.5 w-3.5 text-primary md:h-4 md:w-4" /></div>
                    </div>
                    <div>
                        <div className="text-3xl font-black tracking-tight text-slate-900">{formatCurrency(stats.total_paid)}</div>
                    </div>
                </div>
                <div className="bg-white rounded-3xl border border-slate-200 p-6 flex flex-col gap-4">
                    <div className="flex flex-row items-center justify-between space-y-0">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">К выплате</h3>
                        <div className="rounded-lg bg-primary/10 p-1.5 md:p-2"><Clock className="h-3.5 w-3.5 text-primary md:h-4 md:w-4" /></div>
                    </div>
                    <div>
                        <div className="text-3xl font-black tracking-tight text-slate-900">{formatCurrency(stats.pending_payment)}</div>
                    </div>
                </div>
            </div>



            {data.leaderboard?.top?.length ? (
                <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8">
                    <div className="mb-6">
                        <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
                            <Trophy className="h-4 w-4 text-amber-500" />
                            Рейтинг сотрудников
                        </h2>
                    </div>
                    <div className="space-y-2">
                        {data.leaderboard.top.slice(0, 5).map((item) => (
                            <div key={item.user_id} className="flex items-center justify-between rounded-xl border px-4 py-3">
                                <div className="flex items-center gap-3">
                                    <Badge variant={item.rank === 1 ? 'default' : 'secondary'}>#{item.rank}</Badge>
                                    <span className="font-medium">{item.full_name}</span>
                                </div>
                                <span className="font-bold">{item.score.toFixed(1)} / 10</span>
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}

            {filteredEmployees.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">Сотрудники не найдены</div>
            ) : (
                <div className="space-y-4">
                    {filteredEmployees.map((employee) => (
                        <div key={employee.id} className="bg-white rounded-3xl border border-slate-200 overflow-hidden transition-all hover:shadow-md">
                            <div className="p-6 sm:p-8">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="mb-4 flex flex-wrap items-start gap-2">
                                            <div>
                                                <h3 className="font-bold text-base md:text-lg text-slate-900">{employee.full_name}</h3>
                                                <p className="text-xs text-muted-foreground">{employee.role || 'Сотрудник'}</p>
                                            </div>
                                            <div className="flex flex-wrap gap-2 items-center">
                                                {employee.has_active_kpi && <Badge variant="secondary" className="text-[10px] h-5 font-bold uppercase tracking-wider bg-slate-100 text-slate-600">KPI</Badge>}
                                                {employee.leaderboard?.rank ? (
                                                    <Badge variant="outline" className="text-[10px] h-5 gap-1 bg-amber-50 text-amber-700 border-amber-200 font-bold uppercase tracking-wider">
                                                        <Trophy className="h-2.5 w-2.5" />
                                                        #{employee.leaderboard.rank} · {employee.leaderboard.score.toFixed(1)}
                                                    </Badge>
                                                ) : null}
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2 md:grid-cols-5 md:gap-4">
                                            <div className="rounded-xl border border-slate-100/60 bg-slate-50/60 p-3">
                                                <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Смены</p>
                                                <p className="font-bold text-slate-900">{employee.shifts_count}</p>
                                            </div>
                                            <div className="rounded-xl border border-slate-100/60 bg-slate-50/60 p-3">
                                                <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Начислено</p>
                                                <p className="font-bold text-slate-900">{formatCurrency(employee.total_accrued)}</p>
                                            </div>
                                            <div className="rounded-xl border border-slate-100/60 bg-slate-50/60 p-3">
                                                <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Выплачено</p>
                                                <div className="flex flex-col">
                                                    <p className="font-bold text-slate-900">{formatCurrency(employee.total_paid)}</p>
                                                    {employee.total_paid_bonus && employee.total_paid_bonus > 0 ? (
                                                        <p className="text-[9px] text-purple-600 font-bold">+{formatCurrency(employee.total_paid_bonus)} бон.</p>
                                                    ) : null}
                                                </div>
                                            </div>
                                            <div className="rounded-xl border border-slate-100/60 bg-slate-50/60 p-3">
                                                <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Остаток</p>
                                                <p className="font-bold text-slate-900">{formatCurrency(employee.balance)}</p>
                                            </div>
                                            {employee.total_bar_purchases && employee.total_bar_purchases > 0 ? (
                                                <div className="rounded-xl border border-rose-100/60 bg-rose-50/40 p-3">
                                                    <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-rose-600/70">Покупки бара</p>
                                                    <p className="font-bold text-rose-600">-{formatCurrency(employee.total_bar_purchases)}</p>
                                                </div>
                                            ) : null}
                                            {employee.has_kpi_feature && (
                                                <div className="rounded-xl border border-emerald-100/60 bg-emerald-50/40 p-3">
                                                    <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-emerald-600/70">KPI премия</p>
                                                    <p className={`font-bold ${employee.kpi_bonus_amount && employee.kpi_bonus_amount > 0 ? 'text-emerald-600' : ''}`}>{formatCurrency(employee.kpi_bonus_amount || 0)}</p>
                                                </div>
                                            )}
                                            {employee.has_virtual_balance_feature && (
                                                <div className="rounded-xl border border-purple-100/60 bg-purple-50/40 p-3">
                                                    <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-purple-600/70">Бонусный баланс</p>
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
                                                                    {(Array.isArray(employee.period_bonuses) ? employee.period_bonuses : []).map((kpi: any, idx: number) => (
                                                                        <div key={kpi.id || idx} className="flex justify-between items-center text-xs">
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
                                            <div className="space-y-4 animate-in slide-in-from-left-2 duration-300">
                                                <PayrollKpiTab employee={employee} />
                                                {false && (() => {
                                                    const standardShifts = employee.planned_shifts || employee.standard_monthly_shifts || 15;

                                                    return (
                                                        <>

                                                            <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-200 mt-6">
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
                                                                {Array.isArray(employee.period_bonuses) && employee.period_bonuses.map((kpi: any, kpiIdx: number) => (
                                                                    <div key={kpi.id || `kpi-prog-${kpiIdx}`} className="bg-background border rounded-xl p-4 space-y-4">
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
                                                        <div className="space-y-3 mt-4">
                                                            {(Array.isArray(employee.shifts) ? employee.shifts : [])
                                                                .filter((s: any) => s.type !== 'PERIOD_BONUS')
                                                                .map((shift: any) => {
                                                                    const sDate = new Date(shift.date);
                                                                    const dayOfWeek = sDate.toLocaleDateString('ru-RU', { weekday: 'short' });
                                                                    const hours = shift.hours || shift.total_hours || 0;
                                                                    const revenue = shift.revenue || shift.total_revenue || 0;
                                                                    const isExpanded = isShiftExpanded(employee.id, shift.id)

                                                                    const realBonuses = Array.isArray(shift.real_money_bonuses)
                                                                        ? shift.real_money_bonuses
                                                                        : (Array.isArray(shift.bonuses) ? shift.bonuses.filter((b: any) => b?.payout_type !== 'VIRTUAL_BALANCE') : [])
                                                                    const virtualBonuses = Array.isArray(shift.virtual_bonuses) ? shift.virtual_bonuses : []
                                                                    const deductions = Array.isArray(shift.deductions) ? shift.deductions : []

                                                                    const bonusesSum = realBonuses.reduce((sum: number, b: any) => sum + (parseFloat(b.amount) || 0), 0)
                                                                    const deductionsSum = deductions.reduce((sum: number, d: any) => sum + (parseFloat(d.amount) || 0), 0)
                                                                    const baseSum = Number(shift.base_salary || 0)
                                                                    const barDeduction = Number(shift.bar_deduction || 0)

                                                                    const statusLabel = shift.status === 'PAID' || shift.is_paid ? 'Оплачено' : 'Ожидает'
                                                                    const statusClass = shift.status === 'PAID' || shift.is_paid
                                                                        ? 'bg-green-100 text-green-700 border border-green-200'
                                                                        : 'bg-amber-50 text-amber-700 border border-amber-100'

                                                                    return (
                                                                        <div key={shift.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                                                            <button
                                                                                type="button"
                                                                                className="w-full text-left p-4 hover:bg-slate-50 transition-colors"
                                                                                onClick={() => toggleShiftDetail(employee.id, shift.id)}
                                                                            >
                                                                                <div className="flex items-start justify-between gap-4">
                                                                                    <div className="min-w-0">
                                                                                        <div className="flex items-center gap-2 flex-wrap">
                                                                                            <div className="text-sm font-black text-slate-900">
                                                                                                {sDate.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
                                                                                            </div>
                                                                                            <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                                                                                {dayOfWeek} • {shiftTypeLabel(shift.shift_type)}
                                                                                            </div>
                                                                                            {shift.role_name ? (
                                                                                                <span className="text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-tight border bg-slate-50 text-slate-700 border-slate-200">
                                                                                                    {shift.role_name}
                                                                                                </span>
                                                                                            ) : null}
                                                                                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-tight shadow-sm border ${statusClass}`}>
                                                                                                {statusLabel}
                                                                                            </span>
                                                                                        </div>

                                                                                        <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
                                                                                            <span className="font-bold text-slate-900">{hours} ч</span>
                                                                                            <span>Выручка: <span className="font-bold text-slate-900">{formatCurrency(revenue)}</span></span>
                                                                                            {bonusesSum > 0 ? (
                                                                                                <span>Бонусы: <span className="font-black text-emerald-700">+{formatCurrency(bonusesSum)}</span></span>
                                                                                            ) : null}
                                                                                            {barDeduction > 0 ? (
                                                                                                <span>Бар: <span className="font-black text-rose-700">-{formatCurrency(barDeduction)}</span></span>
                                                                                            ) : null}
                                                                                        </div>
                                                                                    </div>

                                                                                    <div className="text-right shrink-0">
                                                                                        <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Итого</div>
                                                                                        <div className="text-xl font-black text-blue-600">{formatCurrency(shift.calculated_salary)}</div>
                                                                                        <div className="mt-1 text-[10px] text-muted-foreground whitespace-nowrap">
                                                                                            База {formatCurrency(baseSum)} • +{formatCurrency(bonusesSum)} • -{formatCurrency(deductionsSum)}
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            </button>

                                                                            {isExpanded && (
                                                                                <div className="border-t border-slate-200 p-4 bg-slate-50/30 space-y-4">
                                                                                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                                                                        <div className="text-[11px] font-black uppercase tracking-wider text-slate-500">Расчёт по шагам</div>
                                                                                        <div className="mt-2 text-sm font-semibold text-slate-900">
                                                                                            {formatCurrency(baseSum)} + {formatCurrency(bonusesSum)} − {formatCurrency(deductionsSum)} = <span className="font-black text-blue-700">{formatCurrency(shift.calculated_salary)}</span>
                                                                                        </div>
                                                                                    </div>

                                                                                    <div className="grid gap-4 lg:grid-cols-2">
                                                                                        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                                                                                            <div className="text-[11px] font-black uppercase tracking-wider text-slate-500">Выручка</div>
                                                                                            <div className="grid grid-cols-3 gap-3">
                                                                                                <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-3">
                                                                                                    <div className="text-[10px] text-muted-foreground font-bold uppercase">Итого</div>
                                                                                                    <div className="text-sm font-black mt-1">{formatCurrency(shift.total_revenue || 0)}</div>
                                                                                                </div>
                                                                                                <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-3">
                                                                                                    <div className="text-[10px] text-muted-foreground font-bold uppercase">Нал</div>
                                                                                                    <div className="text-sm font-black mt-1">{formatCurrency(shift.revenue_cash || 0)}</div>
                                                                                                </div>
                                                                                                <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-3">
                                                                                                    <div className="text-[10px] text-muted-foreground font-bold uppercase">Безнал</div>
                                                                                                    <div className="text-sm font-black mt-1">{formatCurrency(shift.revenue_card || 0)}</div>
                                                                                                </div>
                                                                                            </div>
                                                                                        </div>

                                                                                        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                                                                                            <div className="text-[11px] font-black uppercase tracking-wider text-slate-500">Бонусы</div>
                                                                                            {realBonuses.length > 0 ? (
                                                                                                <div className="space-y-2">
                                                                                                    {realBonuses.map((b: any, bi: number) => {
                                                                                                        const line = bonusExplainLine(b, shift)
                                                                                                        return (
                                                                                                            <div key={`${shift.id}-b-${bi}`} className="flex items-start justify-between gap-4">
                                                                                                                <div className="min-w-0">
                                                                                                                    <div className="text-sm font-bold text-slate-900 truncate">{b.name || b.type}</div>
                                                                                                                    {line && (
                                                                                                                        <div className="text-[11px] text-muted-foreground whitespace-normal break-words leading-snug">
                                                                                                                            {line}
                                                                                                                        </div>
                                                                                                                    )}
                                                                                                                </div>
                                                                                                                <div className="text-sm font-black text-emerald-700 whitespace-nowrap">+{formatCurrency(b.amount || 0)}</div>
                                                                                                            </div>
                                                                                                        )
                                                                                                    })}
                                                                                                </div>
                                                                                            ) : (
                                                                                                <div className="text-xs text-muted-foreground italic">Бонусов нет</div>
                                                                                            )}

                                                                                            {hasVirtualBonuses && virtualBonuses.length > 0 ? (
                                                                                                <div className="pt-3 border-t border-slate-200">
                                                                                                    <div className="text-[10px] font-black uppercase tracking-wider text-purple-600">Виртуальный баланс</div>
                                                                                                    <div className="mt-2 space-y-1">
                                                                                                        {virtualBonuses.map((b: any, bi: number) => (
                                                                                                            <div key={`${shift.id}-vb-${bi}`} className="flex items-center justify-between gap-4 text-[11px]">
                                                                                                                <div className="text-slate-700 truncate">{b.name || b.type}</div>
                                                                                                                <div className="font-black text-purple-700 whitespace-nowrap">+{formatCurrency(b.amount || 0)}</div>
                                                                                                            </div>
                                                                                                        ))}
                                                                                                    </div>
                                                                                                </div>
                                                                                            ) : null}
                                                                                        </div>
                                                                                    </div>

                                                                                    <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                                                                                        <div className="text-[11px] font-black uppercase tracking-wider text-slate-500">Удержания (в том числе бар в счёт З/П)</div>
                                                                                        {deductions.length > 0 ? (
                                                                                            <div className="space-y-2">
                                                                                                {deductions.map((d: any, di: number) => (
                                                                                                    <div key={`${shift.id}-d-${di}`} className="flex items-center justify-between gap-4">
                                                                                                        <div className="text-sm font-bold text-slate-900 truncate">{d.name}</div>
                                                                                                        <div className="text-sm font-black text-rose-700 whitespace-nowrap">-{formatCurrency(d.amount || 0)}</div>
                                                                                                    </div>
                                                                                                ))}
                                                                                            </div>
                                                                                        ) : (
                                                                                            <div className="text-xs text-muted-foreground italic">Удержаний нет</div>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}

                                                            {(employee.shifts || []).filter((s: any) => s.type !== 'PERIOD_BONUS').length === 0 && (
                                                                <div className="p-12 text-center bg-muted/5 rounded-2xl border border-slate-200">
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
                                                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
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
                                                                    <th className="px-4 py-3 font-bold uppercase tracking-wider">Покупки</th>
                                                                    <th className="px-4 py-3 text-right font-bold uppercase tracking-wider">Сумма</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-50">
                                                                {(() => {
                                                                    const list = Array.isArray(employee.bar_details) ? employee.bar_details : []
                                                                    const groups = new Map<string, { key: string; date: number; items: any[]; total: number }>()

                                                                    list.forEach((item: any) => {
                                                                        const ts = new Date(item.date).getTime()
                                                                        const byShift = item.shift_id ? `shift:${item.shift_id}` : `date:${new Date(item.date).toISOString().slice(0, 10)}`
                                                                        const g = groups.get(byShift)
                                                                        if (!g) {
                                                                            groups.set(byShift, { key: byShift, date: ts, items: [item], total: Number(item.amount || 0) })
                                                                            return
                                                                        }
                                                                        g.items.push(item)
                                                                        g.total += Number(item.amount || 0)
                                                                        if (ts > g.date) g.date = ts
                                                                    })

                                                                    const grouped = Array.from(groups.values()).sort((a, b) => b.date - a.date)

                                                                    return grouped.map((g, gIdx) => (
                                                                        <tr key={`${g.key}-${g.date}-${gIdx}`} className="hover:bg-slate-50 transition-colors">
                                                                            <td className="px-4 py-3 whitespace-nowrap font-medium">
                                                                                {new Date(g.date).toLocaleDateString('ru-RU')}
                                                                            </td>
                                                                            <td className="px-4 py-3">
                                                                                <div className="space-y-1.5">
                                                                                    {g.items.map((item: any, idx: number) => (
                                                                                        <div key={`${item.id}-${idx}`} className="flex items-start justify-between gap-3">
                                                                                            <div className="min-w-0">
                                                                                                <span className="font-bold text-slate-900 break-words">{item.product_name}</span>
                                                                                                {Number(item.quantity || 1) > 1 ? (
                                                                                                    <span className="ml-1 text-muted-foreground">× {item.quantity}</span>
                                                                                                ) : null}
                                                                                            </div>
                                                                                            <Button
                                                                                                variant="ghost"
                                                                                                size="icon"
                                                                                                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                                                                onClick={(e) => { e.stopPropagation(); handleDeleteBarPurchase(item.id); }}
                                                                                            >
                                                                                                <Trash2 className="h-3.5 w-3.5" />
                                                                                            </Button>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            </td>
                                                                            <td className="px-4 py-3 text-right font-black text-rose-600 whitespace-nowrap">
                                                                                -{formatCurrency(g.total)}
                                                                            </td>
                                                                        </tr>
                                                                    ))
                                                                })()}
                                                                {(!employee.bar_details || employee.bar_details.length === 0) && (
                                                                    <tr>
                                                                        <td colSpan={3} className="px-4 py-12 text-center text-muted-foreground italic bg-slate-50/20">
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
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {paymentModal.open && paymentModal.employee && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl p-8 max-w-md w-full mx-4">
                        <h2 className="text-2xl font-bold tracking-tight text-slate-900 mb-6">Выплата: {paymentModal.employee.full_name}</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Сумма</label>
                                <input type="number" step="0.01" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} className="w-full h-12 bg-slate-50/50 border border-slate-200 rounded-xl px-4 font-medium text-slate-900 focus:bg-white transition-colors" placeholder="0.00" />
                                <p className="text-xs text-muted-foreground mt-1">Остаток к выплате: {formatCurrency(paymentModal.employee.balance)}</p>
                            </div>
                            <div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full"
                                    onClick={() => setPeriodCalcOpen((v) => !v)}
                                >
                                    Доп. расчёт по периоду
                                </Button>
                                {periodCalcOpen && (
                                    <div className="mt-3 space-y-3 rounded-2xl border border-slate-200 bg-slate-50/30 p-4">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">С</label>
                                                <input
                                                    type="date"
                                                    value={periodCalcStart}
                                                    onChange={(e) => setPeriodCalcStart(e.target.value)}
                                                    className="w-full h-11 bg-white border border-slate-200 rounded-xl px-3 font-medium text-slate-900"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">По</label>
                                                <input
                                                    type="date"
                                                    value={periodCalcEnd}
                                                    onChange={(e) => setPeriodCalcEnd(e.target.value)}
                                                    className="w-full h-11 bg-white border border-slate-200 rounded-xl px-3 font-medium text-slate-900"
                                                />
                                            </div>
                                        </div>

                                        {periodCalcSummary && (
                                            <div className="space-y-2 text-sm">
                                                <div className="flex justify-between gap-4">
                                                    <span className="text-slate-500">Смен</span>
                                                    <span className="font-bold text-slate-900">{periodCalcSummary.shiftsCount}</span>
                                                </div>
                                                <div className="flex justify-between gap-4">
                                                    <span className="text-slate-500">За смены</span>
                                                    <span className="font-bold text-slate-900">{formatCurrency(periodCalcSummary.base)}</span>
                                                </div>
                                                <div className="flex justify-between gap-4">
                                                    <span className="text-slate-500">KPI/бонусы</span>
                                                    <span className="font-bold text-emerald-600">+{formatCurrency(periodCalcSummary.bonuses)}</span>
                                                </div>
                                                <div className="flex justify-between gap-4">
                                                    <span className="text-slate-500">Бар</span>
                                                    <span className="font-bold text-rose-600">-{formatCurrency(periodCalcSummary.bar)}</span>
                                                </div>
                                                <div className="flex justify-between gap-4 pt-2 border-t border-slate-200">
                                                    <span className="text-slate-500">Итого</span>
                                                    <span className="font-black text-slate-900">{formatCurrency(periodCalcSummary.total)}</span>
                                                </div>
                                                {paymentForm.paymentType !== 'bonus' && (
                                                    <Button
                                                        type="button"
                                                        variant="default"
                                                        className="w-full mt-2"
                                                        onClick={() => setPaymentForm((prev) => ({ ...prev, amount: periodCalcSummary.total.toString() }))}
                                                    >
                                                        Подставить сумму
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Тип выплаты</label>
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
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Способ оплаты</label>
                                <select 
                                    value={paymentForm.method} 
                                    onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })} 
                                    className="w-full h-12 bg-slate-50/50 border border-slate-200 rounded-xl px-4 font-medium text-slate-900 focus:bg-white transition-colors"
                                >
                                    <option value="CASH">Наличные</option>
                                    <option value="CARD">Карта</option>
                                    <option value="BANK_TRANSFER">Банковский перевод</option>
                                </select>
                            </div>
                        )}
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Комментарий</label>
                                <textarea value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} className="w-full h-12 bg-slate-50/50 border border-slate-200 rounded-xl px-4 font-medium text-slate-900 focus:bg-white transition-colors" rows={3} placeholder="Примечание..." />
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
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl p-8 max-w-sm w-full mx-4 animate-in zoom-in duration-200">
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
