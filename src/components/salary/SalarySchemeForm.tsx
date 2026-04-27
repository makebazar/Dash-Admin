"use client"

import { useEffect, useState, useMemo, useRef, type ComponentProps } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Loader2, Plus, Wallet, Sun, Moon, Percent, Clock, DollarSign, Edit, Trash2, Save, ArrowLeft, HelpCircle, Calculator, Calendar, Info, TrendingUp, Wrench, ClipboardCheck, Coins, ShieldAlert, ArrowRight, Trophy } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

const BONUS_TYPES = [
    {
        type: 'progressive_percent' as const,
        label: 'Бонус за выполнение плана',
        description: 'Премия за высокую выручку. Установите пороги: чем больше касса, тем выше бонус.',
        icon: TrendingUp,
        activeClass: 'border-emerald-500 ring-1 ring-emerald-500 bg-emerald-50/30',
        iconClass: 'bg-emerald-100 text-emerald-700',
        dotClass: 'bg-emerald-500'
    },
    {
        type: 'personal_overplan' as const,
        label: 'Личный бонус',
        description: 'Процент от базы смены или от выручки, если сотрудник перевыполнил план.',
        icon: ShieldAlert,
        activeClass: 'border-slate-900 ring-1 ring-slate-900 bg-slate-50/70',
        iconClass: 'bg-slate-200 text-slate-800',
        dotClass: 'bg-slate-900'
    },
    {
        type: 'maintenance_kpi' as const,
        label: 'Бонус за обслуживание',
        description: 'Оплата за техническое обслуживание ПК. За каждую задачу или бонус за месяц.',
        icon: Wrench,
        activeClass: 'border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50/30',
        iconClass: 'bg-indigo-100 text-indigo-700',
        dotClass: 'bg-indigo-500'
    },
    {
        type: 'percent_revenue' as const,
        label: 'Процент от выручки',
        description: 'Классический процент от выручки (общей, наличной или безналичной).',
        icon: Percent,
        activeClass: 'border-blue-500 ring-1 ring-blue-500 bg-blue-50/30',
        iconClass: 'bg-blue-100 text-blue-700',
        dotClass: 'bg-blue-500'
    },
    {
        type: 'fixed' as const,
        label: 'Фиксированный бонус',
        description: 'Фиксированная сумма за выход в смену (например, "на такси").',
        icon: Coins,
        activeClass: 'border-amber-500 ring-1 ring-amber-500 bg-amber-50/30',
        iconClass: 'bg-amber-100 text-amber-700',
        dotClass: 'bg-amber-500'
    },
    {
        type: 'checklist' as const,
        label: 'Бонус за чек-лист',
        description: 'Бонус за качество работы. Зависит от оценки по чеклистам.',
        icon: ClipboardCheck,
        activeClass: 'border-purple-500 ring-1 ring-purple-500 bg-purple-50/30',
        iconClass: 'bg-purple-100 text-purple-700',
        dotClass: 'bg-purple-500'
    },
    {
        type: 'leaderboard_rank' as const,
        label: 'Бонус за место',
        description: 'Премия за место в рейтинге сотрудников клуба за месяц.',
        icon: Trophy,
        activeClass: 'border-amber-500 ring-1 ring-amber-500 bg-amber-50/30',
        iconClass: 'bg-amber-100 text-amber-700',
        dotClass: 'bg-amber-500'
    }
]

export interface Formula {
    base: {
        type: 'hourly' | 'per_shift' | 'none'
        amount?: number
        day_rate?: number
        night_rate?: number
        full_shift_hours?: number
        payout_timing?: 'SHIFT' | 'MONTH'
        rate_tiers?: {
            metric_key?: string
            tiers: { from: number; rate: number }[]
        }
    }
    bonuses: Bonus[]
    conditions: {
        shift_type: 'day' | 'night' | 'any'
        min_hours?: number
    }
}

export interface Bonus {
    type: 'percent_revenue' | 'fixed' | 'progressive_percent' | 'checklist' | 'maintenance_kpi' | 'leaderboard_rank' | 'personal_overplan'
    name?: string
    source?: string
    percent?: number
    amount?: number

    thresholds?: { from: number; percent?: number; amount?: number; label?: string }[]
    plan_per_shift?: number
    plan_by_day_of_week?: {
        MON?: { DAY?: number; NIGHT?: number }
        TUE?: { DAY?: number; NIGHT?: number }
        WED?: { DAY?: number; NIGHT?: number }
        THU?: { DAY?: number; NIGHT?: number }
        FRI?: { DAY?: number; NIGHT?: number }
        SAT?: { DAY?: number; NIGHT?: number }
        SUN?: { DAY?: number; NIGHT?: number }
    }
    tiers?: { from_over_percent: number; bonus_percent: number }[]
    checklist_template_id?: number
    min_score?: number
    mode?: 'SHIFT' | 'MONTH'
    use_thresholds?: boolean
    checklist_thresholds?: { min_score: number; amount: number }[]
    calculation_mode?: 'PER_TASK' | 'MONTHLY'
    overdue_tolerance_days?: number
    late_penalty_multiplier?: number
    overdue_penalty_mode?: 'NONE' | 'FIXED_PER_TASK' | 'FIXED_PER_DAY' | 'PERCENT_OF_REWARD'
    overdue_penalty_amount?: number
    reward_type?: 'MULTIPLIER' | 'FIXED' | 'PERCENT'
    efficiency_thresholds?: { from_percent: number; multiplier?: number; amount?: number }[]
    payout_type?: 'REAL_MONEY' | 'VIRTUAL_BALANCE'
    payout_timing?: 'SHIFT' | 'MONTH'
    rank_from?: number
    rank_to?: number
}

export interface PeriodBonus {
    id: string
    name: string
    metric_key: string
    type: 'PROGRESSIVE'
    target_per_shift: number
    reward_type: 'FIXED' | 'PERCENT'
    reward_value: number
    thresholds?: { from: number; percent?: number; amount?: number; label?: string }[]
    bonus_mode?: 'MONTH' | 'SHIFT'
    payout_type?: 'REAL_MONEY' | 'VIRTUAL_BALANCE'
}

export interface SalaryScheme {
    id: number
    name: string
    description: string
    is_active: boolean
    version: number
    formula: Formula
    period_bonuses?: PeriodBonus[]
    standard_monthly_shifts?: number
    employee_count: number
    created_at: string
}

const defaultFormula: Formula = {
    base: { type: 'hourly', amount: 0 },
    bonuses: [],
    conditions: { shift_type: 'any' }
}

type NumericInputProps = Omit<ComponentProps<typeof Input>, 'type' | 'value' | 'onChange'> & {
    value: number
    onValueChange: (value: number) => void
    emptyValue?: number
}

function NumericInput({ value, onValueChange, emptyValue = 0, onBlur, onFocus, ...props }: NumericInputProps) {
    const [raw, setRaw] = useState<string>(String(value ?? emptyValue))
    const isEditing = useRef(false)

    useEffect(() => {
        if (isEditing.current) return
        setRaw(String(value ?? emptyValue))
    }, [emptyValue, value])

    return (
        <Input
            {...props}
            type="number"
            value={raw}
            onFocus={(e) => {
                isEditing.current = true
                onFocus?.(e)
            }}
            onBlur={(e) => {
                isEditing.current = false
                if (raw.trim() === "") {
                    const normalized = emptyValue
                    setRaw(String(normalized))
                    onValueChange(normalized)
                } else {
                    const parsed = Number(raw)
                    if (Number.isFinite(parsed)) {
                        setRaw(String(parsed))
                        onValueChange(parsed)
                    } else {
                        const normalized = emptyValue
                        setRaw(String(normalized))
                        onValueChange(normalized)
                    }
                }
                onBlur?.(e)
            }}
            onChange={(e) => {
                const nextRaw = e.target.value
                setRaw(nextRaw)
                if (nextRaw.trim() === "") return
                const parsed = Number(nextRaw)
                if (Number.isFinite(parsed)) onValueChange(parsed)
            }}
        />
    )
}

interface ReportMetric {
    key: string
    label: string
    type: string
    category: string
}

const generateId = () => Math.random().toString(36).substring(2, 15)

interface SalarySchemeFormProps {
    clubId: string
    schemeId?: string
}

export default function SalarySchemeForm({ clubId, schemeId }: SalarySchemeFormProps) {
    const router = useRouter()
    const isNew = !schemeId || schemeId === 'new'
    
    const [isLoading, setIsLoading] = useState(!isNew)
    const [isSaving, setIsSaving] = useState(false)
    const [reportMetrics, setReportMetrics] = useState<ReportMetric[]>([])
    const [checklistTemplates, setChecklistTemplates] = useState<any[]>([])

    const [schemeName, setSchemeName] = useState('')
    const [schemeDescription, setSchemeDescription] = useState('')
    const [formula, setFormula] = useState<Formula>(defaultFormula)
    const [standardMonthlyShifts, setStandardMonthlyShifts] = useState(15)
    const [exampleHours, setExampleHours] = useState(12)
    const [exampleShiftType, setExampleShiftType] = useState<'DAY' | 'NIGHT'>('DAY')
    const [exampleDayOfWeek, setExampleDayOfWeek] = useState<'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN'>('MON')
    const [exampleShiftRevenue, setExampleShiftRevenue] = useState(0)
    const [exampleRevenueCash, setExampleRevenueCash] = useState(0)
    const [exampleRevenueCard, setExampleRevenueCard] = useState(0)
    const [exampleBarPurchases, setExampleBarPurchases] = useState(0)
    const [exampleMaintenanceRawSum, setExampleMaintenanceRawSum] = useState(0)
    const [exampleMaintenanceTasksCompleted, setExampleMaintenanceTasksCompleted] = useState(0)
    const [exampleMaintenanceTasksAssigned, setExampleMaintenanceTasksAssigned] = useState(0)
    const [exampleMaintenancePenalty, setExampleMaintenancePenalty] = useState(0)
    const [exampleMonthShiftsWorked, setExampleMonthShiftsWorked] = useState(15)
    const [exampleMonthRank, setExampleMonthRank] = useState(1)
    const [exampleMonthMetricOverrides, setExampleMonthMetricOverrides] = useState<Record<string, number>>({})
    const [exampleMonthChecklistScores, setExampleMonthChecklistScores] = useState<Record<string, number>>({})
    const [exampleMetricOverrides, setExampleMetricOverrides] = useState<Record<string, number>>({})
    const [exampleChecklistScores, setExampleChecklistScores] = useState<Record<string, number>>({})
    const [previewResult, setPreviewResult] = useState<any>(null)
    const [isPreviewLoading, setIsPreviewLoading] = useState(false)
    const [examplePreviewMode, setExamplePreviewMode] = useState<'shift' | 'month'>('shift')
    const [monthSpecialShifts, setMonthSpecialShifts] = useState<Array<{
        id: string
        shift_type: 'DAY' | 'NIGHT'
        day_of_week: 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN'
        hours: number
        revenue: number
        revenue_cash?: number
        revenue_card?: number
        bar_purchases: number
        checklistScores?: Record<string, number>
    }>>([])
    const [monthPreview, setMonthPreview] = useState<any>(null)

    useEffect(() => {
        fetchReportMetrics()
        fetchChecklistTemplates()
        if (!isNew && schemeId) fetchScheme(schemeId)
    }, [clubId, schemeId])

    const fetchScheme = async (id: string) => {
        try {
            const res = await fetch(`/api/clubs/${clubId}/salary-schemes/${id}`)
            if (res.ok) {
                const data = await res.json()
                const scheme = data.scheme || data
                setSchemeName(scheme.name)
                setSchemeDescription(scheme.description || '')
                
                let loadedFormula = scheme.formula || defaultFormula
                let bonuses = loadedFormula.bonuses || []

                // Merge legacy period bonuses into main bonuses array
                if (scheme.period_bonuses && scheme.period_bonuses.length > 0) {
                    const convertedPeriodBonuses = scheme.period_bonuses.map((b: PeriodBonus) => {
                        // Fix legacy reward_type if needed
                        let rewardType = b.reward_type;
                        if (b.type === 'PROGRESSIVE' && b.reward_type === 'FIXED') {
                            const hasPercent = b.thresholds?.some(t => t.percent && t.percent > 0);
                            const hasAmount = b.thresholds?.some(t => t.amount && t.amount > 0);
                            if (hasPercent && !hasAmount) {
                                rewardType = 'PERCENT';
                            }
                        }

                        return {
                            type: 'progressive_percent',
                            name: b.name,
                            source: b.metric_key as any,
                            thresholds: b.thresholds,
                            payout_type: b.payout_type,
                            reward_type: rewardType,
                            mode: 'MONTH', // Explicitly set mode to MONTH
                            id: b.id
                        } as Bonus;
                    });
                    bonuses = [...bonuses, ...convertedPeriodBonuses];
                }

                const normalizedBase = (() => {
                    const base = (loadedFormula as any)?.base || {}
                    if (!base?.rate_tiers) return base
                    const tiersRaw = Array.isArray(base.rate_tiers?.tiers) ? base.rate_tiers.tiers : []
                    const tiers = tiersRaw.map((t: any) => ({ ...t, id: t.id || generateId() }))
                    return { ...base, rate_tiers: { ...base.rate_tiers, tiers } }
                })()

                setFormula({ ...loadedFormula, base: normalizedBase, bonuses })
                setStandardMonthlyShifts(scheme.standard_monthly_shifts || 15)
            }
        } catch (error) { console.error(error) } finally { setIsLoading(false) }
    }

    const fetchReportMetrics = async () => {
        try {
            const res = await fetch(`/api/clubs/${clubId}/settings/reports`)
            const data = await res.json()
            if (res.ok && Array.isArray(data.systemMetrics)) {
                const numericMetrics = data.systemMetrics.filter((m: any) => 
                    ['MONEY', 'NUMBER', 'DECIMAL', 'currency', 'number'].includes(m.type.toUpperCase())
                )
                // Ensure 'total_revenue' is present
                if (!numericMetrics.some((m: any) => m.key === 'total_revenue')) {
                    numericMetrics.unshift({ key: 'total_revenue', label: 'Общая выручка', type: 'MONEY', category: 'SYSTEM' })
                }
                numericMetrics.push({ key: 'evaluation_score', label: 'Оценка по чеклистам (%)', type: 'NUMBER', category: 'KPI' })
                setReportMetrics(numericMetrics)
            }
        } catch (error) { console.error(error) }
    }

    const fetchChecklistTemplates = async () => {
        try {
            const res = await fetch(`/api/clubs/${clubId}/evaluations/templates`)
            const data = await res.json()
            if (res.ok && Array.isArray(data)) setChecklistTemplates(data)
        } catch (error) { console.error(error) }
    }

    const handleSave = async () => {
        if (!schemeName.trim()) { alert('Введите название схемы'); return }
        setIsSaving(true)
        try {
            const url = isNew ? `/api/clubs/${clubId}/salary-schemes` : `/api/clubs/${clubId}/salary-schemes/${schemeId}`
            const res = await fetch(url, {
                method: isNew ? 'POST' : 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                // We send empty period_bonuses to clear the legacy field, as everything is now in formula.bonuses
                body: JSON.stringify({ name: schemeName, description: schemeDescription, formula, period_bonuses: [], standard_monthly_shifts: standardMonthlyShifts })
            })
            if (res.ok) { router.push(`/clubs/${clubId}/settings/salary`); router.refresh() }
            else { const data = await res.json(); alert(data.error || 'Ошибка сохранения') }
        } catch (error) { console.error(error); alert('Ошибка сохранения') } finally { setIsSaving(false) }
    }

    const handleUpdateBaseType = (type: 'hourly' | 'per_shift' | 'none') => {
        setFormula(prev => ({ ...prev, base: { ...prev.base, type, amount: type !== 'none' ? (prev.base.amount || (type === 'per_shift' ? 2000 : 0)) : undefined, full_shift_hours: type === 'per_shift' ? (prev.base.full_shift_hours || 12) : undefined } }))
    }

    const updateBaseAmount = (field: string, value: number) => {
        setFormula(prev => ({ ...prev, base: { ...prev.base, [field]: value } }))
    }

    const addBonus = (type: Bonus['type']) => {
        let newBonus: Bonus = { type, name: 'Новый бонус', payout_type: 'REAL_MONEY' }
        if (type === 'percent_revenue') { newBonus.percent = 5; newBonus.source = 'total' }
        else if (type === 'fixed') newBonus.amount = 500

        else if (type === 'progressive_percent') { newBonus.source = 'total'; newBonus.thresholds = [{ from: 30000, percent: 3 }]; newBonus.reward_type = 'PERCENT' }
        else if (type === 'personal_overplan') {
            newBonus.source = 'total'
            ;(newBonus as any).reward_base = 'BASE'
            newBonus.plan_per_shift = 10000
            newBonus.plan_by_day_of_week = {
                MON: { DAY: 10000, NIGHT: 10000 },
                TUE: { DAY: 10000, NIGHT: 10000 },
                WED: { DAY: 10000, NIGHT: 10000 },
                THU: { DAY: 10000, NIGHT: 10000 },
                FRI: { DAY: 10000, NIGHT: 10000 },
                SAT: { DAY: 10000, NIGHT: 10000 },
                SUN: { DAY: 10000, NIGHT: 10000 }
            }
            newBonus.tiers = [
                { from_over_percent: 0, bonus_percent: 0 },
                { from_over_percent: 15, bonus_percent: 20 },
                { from_over_percent: 30, bonus_percent: 30 }
            ]
            newBonus.payout_timing = 'MONTH'
        }
        
        else if (type === 'checklist') { newBonus.amount = 500; newBonus.min_score = 100; newBonus.mode = 'SHIFT' }
        else if (type === 'maintenance_kpi') { newBonus.amount = 50; newBonus.calculation_mode = 'PER_TASK'; newBonus.reward_type = 'FIXED' }
        else if (type === 'leaderboard_rank') { newBonus.amount = 3000; newBonus.rank_from = 1; newBonus.rank_to = 1; newBonus.mode = 'MONTH'; newBonus.payout_timing = 'MONTH' }
        
        setFormula(prev => {
            const newBonuses = [...prev.bonuses, newBonus];
            // Scroll to the new bonus after state update
            setTimeout(() => {
                const element = document.getElementById(`bonus-${newBonuses.length - 1}`);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    // Add highlight effect class temporarily if needed, or use CSS animation
                }
            }, 100);
            return { ...prev, bonuses: newBonuses };
        })
    }

    const removeBonus = (index: number) => setFormula(prev => ({ ...prev, bonuses: prev.bonuses.filter((_, i) => i !== index) }))
    const updateBonus = (index: number, field: string, value: any) => setFormula(prev => ({ ...prev, bonuses: prev.bonuses.map((b, i) => i === index ? { ...b, [field]: value } : b) }))


    const toggleBonusPeriod = (index: number, targetMode: 'daily' | 'monthly') => {
        setFormula(prev => ({
            ...prev,
            bonuses: prev.bonuses.map((b, i) => i === index ? { ...b, mode: targetMode === 'daily' ? 'SHIFT' : 'MONTH' } : b)
        }))
    }

    const isBonusActive = (type: string) => {
        return formula.bonuses.some(b => b.type === type)
    }

    const normalizeBaseRateTiers = (input: any, fallbackRate: number) => {
        const period = (input as any)?.period || 'SHIFT'
        const scope = (input as any)?.scope || 'EMPLOYEE'
        const metric_key = (input as any)?.metric_key || 'total_revenue'
        const tiersRaw = Array.isArray((input as any)?.tiers) ? (input as any).tiers : []
        const tiers = tiersRaw
            .map((t: any) => ({ id: t.id || generateId(), from: Number(t.from || 0), rate: Number(t.rate || 0) }))
            .sort((a: any, b: any) => (Number(a.from) || 0) - (Number(b.from) || 0))
        if (tiers.length === 0) tiers.push({ id: generateId(), from: 0, rate: Number.isFinite(fallbackRate) ? fallbackRate : 0 })
        if ((Number(tiers[0].from) || 0) !== 0) tiers[0] = { ...tiers[0], from: 0 }
        return { metric_key, period, scope, tiers }
    }

    const toggleBaseRateTiers = (enabled: boolean) => {
        setFormula(prev => {
            if (!enabled) return { ...prev, base: { ...prev.base, rate_tiers: undefined } }
            const baseRate = Number(prev.base.amount || 0)
            const normalized = normalizeBaseRateTiers(prev.base.rate_tiers, baseRate)
            return { ...prev, base: { ...prev.base, rate_tiers: normalized } }
        })
    }

    const addBaseRateTier = () => {
        setFormula(prev => {
            const existing = prev.base.rate_tiers
            const tiers = existing?.tiers?.length ? existing.tiers : []
            const maxFrom = tiers.reduce((acc, t) => Math.max(acc, Number(t.from) || 0), 0)
            return {
                ...prev,
                base: {
                    ...prev.base,
                    rate_tiers: {
                        metric_key: existing?.metric_key || 'total_revenue',
                        period: (existing as any)?.period || 'SHIFT',
                        scope: (existing as any)?.scope || 'EMPLOYEE',
                        tiers: [...tiers, { id: generateId(), from: maxFrom ? maxFrom + 5000 : 20000, rate: prev.base.amount || 0 }]
                    }
                }
            }
        })
    }

    const updateBaseRateTier = (id: string, patch: Partial<{ from: number; rate: number }>) => {
        setFormula(prev => {
            const existing = prev.base.rate_tiers
            if (!existing) return prev
            const tiers = [...existing.tiers].map((t: any) => ({ ...t, id: t.id || generateId() }))
            const idx = tiers.findIndex((t: any) => String(t.id) === String(id))
            if (idx < 0) return prev
            tiers[idx] = { ...tiers[idx], ...patch }
            tiers.sort((a: any, b: any) => (Number(a.from) || 0) - (Number(b.from) || 0))
            if (tiers.length && (Number(tiers[0].from) || 0) !== 0) tiers[0] = { ...tiers[0], from: 0 }
            return { ...prev, base: { ...prev.base, rate_tiers: { ...existing, tiers } } }
        })
    }

    const removeBaseRateTier = (id: string) => {
        setFormula(prev => {
            const existing = prev.base.rate_tiers
            if (!existing) return prev
            const tiers = existing.tiers.filter((t: any) => String(t.id || '') !== String(id))
            return { ...prev, base: { ...prev.base, rate_tiers: tiers.length ? { ...existing, tiers } : undefined } }
        })
    }

    const checklistTemplateLabel = (templateId: number) => {
        const template = checklistTemplates.find(t => Number(t.id) === Number(templateId))
        return template?.name || `Шаблон #${templateId}`
    }

    const dayOfWeekLabel = (v?: string) => {
        if (!v) return ''
        if (v === 'MON') return 'Пн'
        if (v === 'TUE') return 'Вт'
        if (v === 'WED') return 'Ср'
        if (v === 'THU') return 'Чт'
        if (v === 'FRI') return 'Пт'
        if (v === 'SAT') return 'Сб'
        if (v === 'SUN') return 'Вс'
        return v
    }

    const shiftTypeLabel = (v?: string) => {
        if (!v) return ''
        if (v === 'DAY') return 'День'
        if (v === 'NIGHT') return 'Ночь'
        return v
    }

    const formatRub = (value: any) => {
        const n = Number(value || 0)
        if (!Number.isFinite(n)) return '0'
        return Math.round(n).toLocaleString('ru-RU')
    }

    const metricOptionsForTiers = useMemo(() => {
        const base = [
            { key: 'total_revenue', label: 'Общая выручка' },
            { key: 'revenue_cash', label: 'Выручка (наличные)' },
            { key: 'revenue_card', label: 'Выручка (безнал)' }
        ]

        const existingKeys = new Set(base.map(b => b.key))
        const extra = reportMetrics
            .filter(m => !existingKeys.has(m.key))
            .map(m => ({ key: m.key, label: m.label || m.key }))

        return [...base, ...extra]
    }, [reportMetrics])

    const requiredMetricKeys = useMemo(() => {
        const keys = new Set<string>()

        if (formula.base.rate_tiers?.metric_key) keys.add(formula.base.rate_tiers.metric_key)
        formula.bonuses.forEach(b => {
            if (b.type === 'percent_revenue' || b.type === 'progressive_percent' || b.type === 'personal_overplan') {
                const sourceKey = b.source || 'total'
                if (sourceKey === 'total') keys.add('total_revenue')
                else if (sourceKey === 'cash') keys.add('revenue_cash')
                else if (sourceKey === 'card') keys.add('revenue_card')
                else keys.add(sourceKey)
            } else if (b.type === 'maintenance_kpi') {
                keys.add('maintenance_raw_sum')
                keys.add('maintenance_tasks_completed')
                keys.add('maintenance_tasks_assigned')
            }
        })

        if (keys.size === 0) keys.add('total_revenue')

        return Array.from(keys)
    }, [formula])

    const needsCashCardSplit = useMemo(() => {
        const tierKey = formula.base.rate_tiers?.metric_key
        if (tierKey === 'revenue_cash' || tierKey === 'revenue_card') return true
        return formula.bonuses.some(b =>
            (b.type === 'percent_revenue' || b.type === 'progressive_percent' || b.type === 'personal_overplan') &&
            (b.source === 'cash' || b.source === 'card' || b.source === 'revenue_cash' || b.source === 'revenue_card')
        )
    }, [formula])

    const hasPersonalOverplan = useMemo(() => {
        return formula.bonuses.some(b => b.type === 'personal_overplan')
    }, [formula.bonuses])

    const personalOverplanPreview = useMemo(() => {
        if (!hasPersonalOverplan) return null
        if (!previewResult?.breakdown) return null

        const cfg = formula.bonuses.find(b => b.type === 'personal_overplan')
        if (!cfg) return null

        const baseAmount = Number(previewResult.breakdown.base || 0)
        const cashRevenue = needsCashCardSplit ? Number(exampleRevenueCash || 0) : Number(exampleShiftRevenue || 0)
        const cardRevenue = needsCashCardSplit ? Number(exampleRevenueCard || 0) : 0
        const totalRevenue = cashRevenue + cardRevenue
        const metricValue =
            cfg.source === 'total' || cfg.source === 'total_revenue' || !cfg.source
                ? totalRevenue
                : cfg.source === 'cash' || cfg.source === 'revenue_cash'
                    ? cashRevenue
                    : cfg.source === 'card' || cfg.source === 'revenue_card'
                        ? cardRevenue
                        : Number(exampleMetricOverrides[cfg.source] || 0)

        const planPerShift =
            Number(cfg.plan_by_day_of_week?.[exampleDayOfWeek]?.[exampleShiftType]) ||
            Number(cfg.plan_per_shift || 0)

        const kpiPercent = planPerShift > 0 ? (metricValue / planPerShift) * 100 : 0
        const overPercent = Math.max(0, kpiPercent - 100)

        const tiers = Array.isArray(cfg.tiers) ? cfg.tiers : []
        const sorted = [...tiers].sort((a, b) => (Number(b.from_over_percent) || 0) - (Number(a.from_over_percent) || 0))
        const tier = sorted.find(t => overPercent >= (Number(t.from_over_percent) || 0))
        const bonusPercent = tier ? (Number(tier.bonus_percent) || 0) : 0
        const rewardBase = String((cfg as any).reward_base || 'BASE').toUpperCase()
        const rewardBaseValue = rewardBase === 'METRIC' ? metricValue : baseAmount
        const amount = rewardBaseValue * (bonusPercent / 100)

        return {
            name: cfg.name || 'Личный бонус',
            amount: parseFloat(amount.toFixed(2)),
            plan_per_shift: parseFloat((planPerShift || 0).toFixed(2)),
            kpi_percent: parseFloat(kpiPercent.toFixed(2)),
            over_percent: parseFloat(overPercent.toFixed(2)),
            bonus_percent: parseFloat(bonusPercent.toFixed(2)),
            metric_value: parseFloat(Number(metricValue || 0).toFixed(2)),
            base_amount: parseFloat(baseAmount.toFixed(2)),
            reward_base: rewardBase,
            reward_base_value: parseFloat(Number(rewardBaseValue || 0).toFixed(2))
        }
    }, [
        hasPersonalOverplan,
        previewResult,
        formula.bonuses,
        needsCashCardSplit,
        exampleRevenueCash,
        exampleRevenueCard,
        exampleShiftRevenue,
        exampleMetricOverrides,
        exampleDayOfWeek,
        exampleShiftType
    ])

    const personalOverplanAdjustment = useMemo(() => {
        if (!hasPersonalOverplan) return null
        if (!personalOverplanPreview) return null
        if (!previewResult?.breakdown) return null

        const bonuses = Array.isArray(previewResult.breakdown.bonuses) ? previewResult.breakdown.bonuses : []
        const alreadyIncluded = bonuses.some((b: any) => b?.type === 'PERSONAL_OVERPLAN' || b?.name === personalOverplanPreview.name)
        if (alreadyIncluded) return { total: 0, instant: 0, accrued: 0, virtual: 0, alreadyIncluded: true }

        const cfg = formula.bonuses.find(b => b.type === 'personal_overplan')
        if (!cfg) return null

        const amount = Number(personalOverplanPreview.amount || 0)
        const payoutType = (cfg as any).payout_type || 'REAL_MONEY'
        const payoutTiming = (cfg as any).payout_timing || 'MONTH'

        if (payoutType === 'VIRTUAL_BALANCE') {
            return { total: 0, instant: 0, accrued: 0, virtual: amount, alreadyIncluded: false }
        }

        if (payoutTiming === 'SHIFT') {
            return { total: amount, instant: amount, accrued: 0, virtual: 0, alreadyIncluded: false }
        }

        return { total: amount, instant: 0, accrued: amount, virtual: 0, alreadyIncluded: false }
    }, [hasPersonalOverplan, personalOverplanPreview, previewResult, formula.bonuses])

    const monthShiftBreakdown = useMemo(() => {
        if (!monthPreview) return null

        const templateCount = Number(monthPreview?.templateCount || 0)
        const typicalBreakdown = monthPreview?.typical?.result?.breakdown
        const special = Array.isArray(monthPreview?.special) ? monthPreview.special : []

        const base = (Number(typicalBreakdown?.base || 0) * templateCount) + special.reduce((acc: number, s: any) => acc + Number(s?.result?.breakdown?.base || 0), 0)

        const bonusMap = new Map<string, { name: string; type: string; amount: number; sample?: any }>()
        const addBonuses = (list: any[], multiplier: number) => {
            if (!Array.isArray(list)) return
            list.forEach(b => {
                const key = `${String(b?.type || '')}||${String(b?.name || '')}`
                const prev = bonusMap.get(key)
                const amt = Number(b?.amount || 0) * multiplier
                if (prev) bonusMap.set(key, { ...prev, amount: prev.amount + amt })
                else bonusMap.set(key, { name: String(b?.name || ''), type: String(b?.type || ''), amount: amt, sample: b })
            })
        }
        addBonuses(typicalBreakdown?.bonuses, templateCount)
        special.forEach((s: any) => addBonuses(s?.result?.breakdown?.bonuses, 1))

        const deductionMap = new Map<string, { name: string; amount: number }>()
        const addDeductions = (list: any[], multiplier: number) => {
            if (!Array.isArray(list)) return
            list.forEach(d => {
                const key = String(d?.name || '')
                const prev = deductionMap.get(key)
                const amt = Number(d?.amount || 0) * multiplier
                if (prev) deductionMap.set(key, { ...prev, amount: prev.amount + amt })
                else deductionMap.set(key, { name: key, amount: amt })
            })
        }
        addDeductions(typicalBreakdown?.deductions, templateCount)
        special.forEach((s: any) => addDeductions(s?.result?.breakdown?.deductions, 1))

        return {
            base: Math.round(base),
            bonuses: Array.from(bonusMap.values()).map(v => ({ ...v, amount: Math.round(v.amount) })).filter(v => v.amount !== 0),
            deductions: Array.from(deductionMap.values()).map(v => ({ ...v, amount: Math.round(v.amount) })).filter(v => v.amount !== 0)
        }
    }, [monthPreview])

    const monthlyBonuses = useMemo(() => {
        return formula.bonuses.filter(b => {
            if (b.type === 'maintenance_kpi') return b.calculation_mode === 'MONTHLY'
            if (b.type === 'leaderboard_rank') return true
            return b.mode === 'MONTH'
        })
    }, [formula.bonuses])

    const shiftChecklistTemplateIds = useMemo(() => {
        return Array.from(
            new Set(
                formula.bonuses
                    .filter(b => b.type === 'checklist' && b.mode !== 'MONTH')
                    .map(b => Number(b.checklist_template_id))
                    .filter(Boolean)
            )
        )
    }, [formula.bonuses])

    const monthlyMetricKeys = useMemo(() => {
        const keys = new Set<string>()
        monthlyBonuses.forEach(b => {
            if (b.type === 'progressive_percent' || b.type === 'percent_revenue') {
                const sourceKey = b.source || 'total'
                if (sourceKey === 'total') keys.add('total_revenue')
                else if (sourceKey === 'cash') keys.add('revenue_cash')
                else if (sourceKey === 'card') keys.add('revenue_card')
                else keys.add(sourceKey)
            } else if (b.type === 'maintenance_kpi') {
                keys.add('maintenance_raw_sum')
                keys.add('maintenance_tasks_completed')
                keys.add('maintenance_tasks_assigned')
            }
        })
        return Array.from(keys)
    }, [monthlyBonuses])

    const hasMaintenanceKpi = useMemo(() => {
        return formula.bonuses.some(b => b.type === 'maintenance_kpi')
    }, [formula])

    const exampleReportMetricsForPreview = useMemo(() => {
        const revenueCash = needsCashCardSplit ? Number(exampleRevenueCash || 0) : Number(exampleShiftRevenue || 0)
        const revenueCard = needsCashCardSplit ? Number(exampleRevenueCard || 0) : 0
        const totalRevenue = revenueCash + revenueCard

        const metrics: Record<string, number> = {
            total_revenue: totalRevenue,
            revenue_cash: revenueCash,
            revenue_card: revenueCard,
            ...Object.fromEntries(Object.entries(exampleMetricOverrides).map(([k, v]) => [k, Number(v || 0)]))
        }

        if (hasMaintenanceKpi) {
            metrics.maintenance_raw_sum = Number(exampleMaintenanceRawSum || 0)
            metrics.maintenance_tasks_completed = Number(exampleMaintenanceTasksCompleted || 0)
            metrics.maintenance_tasks_assigned = Number(exampleMaintenanceTasksAssigned || 0)
            metrics.maintenance_overdue_penalty_applied = Number(exampleMaintenancePenalty || 0)
        }

        return metrics
    }, [
        needsCashCardSplit,
        exampleRevenueCash,
        exampleRevenueCard,
        exampleShiftRevenue,
        exampleMetricOverrides,
        hasMaintenanceKpi,
        exampleMaintenanceRawSum,
        exampleMaintenanceTasksCompleted,
        exampleMaintenanceTasksAssigned,
        exampleMaintenancePenalty
    ])

    const describeMetric = (key?: string, value?: number) => {
        if (!key) return ''
        const metricLabel =
            key === 'total_revenue'
                ? 'выручки смены'
                : key === 'revenue_cash'
                    ? 'выручки (наличные)'
                    : key === 'revenue_card'
                        ? 'выручки (безнал)'
                        : reportMetrics.find(m => m.key === key)?.label || key
        if (value === undefined || value === null || Number.isNaN(Number(value))) return metricLabel
        const v = Number(value)
        return `${metricLabel} (${v.toLocaleString('ru-RU')} ₽)`
    }

    const baseTierExplanation = useMemo(() => {
        if (formula.base.type !== 'hourly') return null
        const tiers = formula.base.rate_tiers?.tiers
        if (!tiers || tiers.length === 0) return null

        const metricKey = formula.base.rate_tiers?.metric_key || 'total_revenue'
        const metricValue = Number(exampleReportMetricsForPreview[metricKey] || 0)
        const sorted = [...tiers].sort((a, b) => (Number(b.from) || 0) - (Number(a.from) || 0))
        const tier = sorted.find(t => metricValue >= (Number(t.from) || 0))
        if (!tier) {
            const minFrom = Math.min(...tiers.map(t => Number(t.from) || 0))
            return `${describeMetric(metricKey, metricValue)} ниже первого порога ${minFrom.toLocaleString('ru-RU')} ₽`
        }
        return `${describeMetric(metricKey, metricValue)} ≥ ${Number(tier.from || 0).toLocaleString('ru-RU')} ₽ → ставка ${Number(tier.rate || 0).toLocaleString('ru-RU')} ₽/ч`
    }, [formula.base, exampleReportMetricsForPreview, describeMetric])

    const exampleMonthMetrics = useMemo(() => {
        const metrics: Record<string, number> = {
            ...Object.fromEntries(Object.entries(exampleMonthMetricOverrides).map(([k, v]) => [k, Number(v || 0)]))
        }

        if (monthlyMetricKeys.includes('total_revenue') && metrics.total_revenue === undefined) metrics.total_revenue = 0
        if (monthlyMetricKeys.includes('revenue_cash') && metrics.revenue_cash === undefined) metrics.revenue_cash = 0
        if (monthlyMetricKeys.includes('revenue_card') && metrics.revenue_card === undefined) metrics.revenue_card = 0

        if (monthlyMetricKeys.includes('maintenance_raw_sum') && metrics.maintenance_raw_sum === undefined) metrics.maintenance_raw_sum = Number(exampleMaintenanceRawSum || 0)
        if (monthlyMetricKeys.includes('maintenance_tasks_completed') && metrics.maintenance_tasks_completed === undefined) metrics.maintenance_tasks_completed = Number(exampleMaintenanceTasksCompleted || 0)
        if (monthlyMetricKeys.includes('maintenance_tasks_assigned') && metrics.maintenance_tasks_assigned === undefined) metrics.maintenance_tasks_assigned = Number(exampleMaintenanceTasksAssigned || 0)

        return metrics
    }, [exampleMonthMetricOverrides, monthlyMetricKeys, exampleMaintenanceRawSum, exampleMaintenanceTasksCompleted, exampleMaintenanceTasksAssigned])

    const monthlyKpiPreview = useMemo(() => {
        if (!monthlyBonuses.length) return { totalReal: 0, totalVirtual: 0, items: [] as any[] }

        const shiftsWorked = Math.max(0, Number(exampleMonthShiftsWorked || 0))
        const standard = Math.max(1, Number(standardMonthlyShifts || 15))
        const scale = shiftsWorked > 0 ? shiftsWorked / standard : 1

        let totalReal = 0
        let totalVirtual = 0
        const items: any[] = []

        const getMonthlyMetricValue = (sourceKey?: string) => {
            const s = sourceKey || 'total'
            if (s === 'total') return Number(exampleMonthMetrics.total_revenue || 0)
            if (s === 'cash') return Number(exampleMonthMetrics.revenue_cash || 0)
            if (s === 'card') return Number(exampleMonthMetrics.revenue_card || 0)
            return Number(exampleMonthMetrics[s] || 0)
        }

        for (const bonus of monthlyBonuses) {
            const name = bonus.name || bonus.type
            const payoutType = (bonus as any).payout_type || 'REAL_MONEY'
            let amount = 0
            let logic = ''

            if (bonus.type === 'progressive_percent') {
                const metricValue = getMonthlyMetricValue(bonus.source)
                const thresholds = (bonus as any).thresholds || []
                const rewardType = (bonus as any).reward_type || 'PERCENT'

                if (thresholds.length) {
                    const scaledThresholds = thresholds.map((t: any) => ({ ...t, effective_from: (Number(t.from) || 0) * scale }))
                    const sorted = [...scaledThresholds].sort((a, b) => (Number(b.effective_from) || 0) - (Number(a.effective_from) || 0))
                    const hit = sorted.find(t => metricValue >= (Number(t.effective_from) || 0))

                    if (!hit) {
                        const minFrom = Math.min(...scaledThresholds.map((t: any) => Number(t.effective_from) || 0))
                        logic = `${describeMetric((bonus.source as any) === 'cash' ? 'revenue_cash' : (bonus.source as any) === 'card' ? 'revenue_card' : (bonus.source ? String(bonus.source) : 'total_revenue'), metricValue)} ниже порога ${minFrom.toLocaleString('ru-RU')} ₽ (масштаб ×${scale.toFixed(2)})`
                    } else if (rewardType === 'FIXED') {
                        amount = Number(hit.amount || 0)
                        logic = `Порог ${Number(hit.effective_from || 0).toLocaleString('ru-RU')} ₽ (масштаб ×${scale.toFixed(2)}), фикс ${amount.toLocaleString('ru-RU')} ₽`
                    } else {
                        const perc = Number(hit.percent || 0)
                        amount = metricValue * (perc / 100)
                        logic = `Порог ${Number(hit.effective_from || 0).toLocaleString('ru-RU')} ₽ (масштаб ×${scale.toFixed(2)}), ${perc.toFixed(1).replace(/\\.0$/, '')}% от ${metricValue.toLocaleString('ru-RU')} ₽`
                    }
                } else {
                    logic = 'Нет порогов'
                }
            } else if (bonus.type === 'percent_revenue') {
                const metricValue = getMonthlyMetricValue(bonus.source)
                const percent = Number(bonus.percent || 0)
                amount = metricValue * (percent / 100)
                logic = `${percent.toFixed(1).replace(/\\.0$/, '')}% от ${metricValue.toLocaleString('ru-RU')} ₽`
            } else if (bonus.type === 'checklist') {
                const templateId = Number(bonus.checklist_template_id)
                const score = Number(exampleMonthChecklistScores[String(templateId)] ?? 100)
                if ((bonus as any).checklist_thresholds && Array.isArray((bonus as any).checklist_thresholds) && (bonus as any).checklist_thresholds.length > 0) {
                    const sorted = [...(bonus as any).checklist_thresholds].sort((a: any, b: any) => (Number(b.min_score) || 0) - (Number(a.min_score) || 0))
                    const hit = sorted.find((t: any) => score >= (Number(t.min_score) || 0))
                    if (hit) {
                        amount = Number(hit.amount || 0)
                        logic = `Оценка ${score.toFixed(0)}%, уровень ≥ ${Number(hit.min_score || 0)}%`
                    } else {
                        const need = Math.max(...(bonus as any).checklist_thresholds.map((t: any) => Number(t.min_score) || 0))
                        logic = `Оценка ${score.toFixed(0)}% ниже порога ${need}%`
                    }
                } else {
                    const minScore = Number(bonus.min_score || 0)
                    if (score >= minScore) {
                        amount = Number(bonus.amount || 0)
                        logic = `Оценка ${score.toFixed(0)}% ≥ ${minScore}%`
                    } else {
                        logic = `Оценка ${score.toFixed(0)}% ниже ${minScore}%`
                    }
                }
            } else if (bonus.type === 'maintenance_kpi') {
                const completed = Number(exampleMonthMetrics.maintenance_tasks_completed || 0)
                const assigned = Number(exampleMonthMetrics.maintenance_tasks_assigned || 0)
                const rawSum = Number(exampleMonthMetrics.maintenance_raw_sum || 0)
                let efficiency = 100
                if (assigned > 0) efficiency = (completed / assigned) * 100

                const thresholds = (bonus as any).efficiency_thresholds || []
                if (thresholds.length) {
                    const sorted = [...thresholds].sort((a: any, b: any) => (Number(b.from_percent) || 0) - (Number(a.from_percent) || 0))
                    const hit = sorted.find((t: any) => efficiency >= (Number(t.from_percent) || 0))
                    if (hit) {
                        if (hit.amount !== undefined && hit.amount !== null) {
                            amount = Number(hit.amount || 0)
                            logic = `Эффективность ${efficiency.toFixed(0)}% ≥ ${Number(hit.from_percent || 0)}% → ${amount.toLocaleString('ru-RU')} ₽`
                        } else if (hit.multiplier !== undefined && hit.multiplier !== null) {
                            const mult = Number(hit.multiplier || 1)
                            amount = rawSum * mult
                            logic = `Сумма ${rawSum.toLocaleString('ru-RU')} ₽ × ${mult.toFixed(2)} (эффективность ${efficiency.toFixed(0)}%)`
                        } else {
                            logic = `Эффективность ${efficiency.toFixed(0)}%`
                        }
                    } else {
                        const minFrom = Math.min(...thresholds.map((t: any) => Number(t.from_percent) || 0))
                        logic = `Эффективность ${efficiency.toFixed(0)}% ниже ${minFrom}%`
                    }
                } else {
                    logic = `Эффективность ${efficiency.toFixed(0)}%`
                }
            } else if (bonus.type === 'leaderboard_rank') {
                const rank = Number(exampleMonthRank || 1)
                const from = Number(bonus.rank_from || 1)
                const to = Number(bonus.rank_to || from)
                if (rank >= from && rank <= to) {
                    amount = Number(bonus.amount || 0)
                    logic = `Место ${rank} попадает в ${from}${to !== from ? `–${to}` : ''}`
                } else {
                    logic = `Место ${rank} вне диапазона ${from}${to !== from ? `–${to}` : ''}`
                }
            }

            if (amount > 0) {
                if (payoutType === 'VIRTUAL_BALANCE') totalVirtual += amount
                else totalReal += amount
            }

            items.push({
                name,
                payoutType,
                amount: parseFloat(amount.toFixed(2)),
                logic,
                isActive: amount > 0
            })
        }

        return {
            totalReal: parseFloat(totalReal.toFixed(2)),
            totalVirtual: parseFloat(totalVirtual.toFixed(2)),
            scale: parseFloat(scale.toFixed(4)),
            shiftsWorked,
            standard,
            items
        }
    }, [monthlyBonuses, exampleMonthShiftsWorked, standardMonthlyShifts, exampleMonthMetrics, exampleMonthChecklistScores, exampleMonthRank, describeMetric])

    const kpiNotAppliedNotes = useMemo(() => {
        const appliedNames = new Set<string>(
            Array.isArray(previewResult?.breakdown?.bonuses)
                ? previewResult.breakdown.bonuses.map((b: any) => String(b.name))
                : []
        )

        const notes: { name: string; reason: string }[] = []

        for (const bonus of formula.bonuses) {
            const name = bonus.name || bonus.type
            if (appliedNames.has(String(name))) continue

            if (bonus.type === 'fixed') {
                if (Number(bonus.amount || 0) <= 0) notes.push({ name, reason: 'Сумма 0 ₽' })
                continue
            }

            if (bonus.type === 'percent_revenue') {
                const sourceKey = bonus.source || 'total'
                const metricKey = sourceKey === 'total' ? 'total_revenue' : sourceKey === 'cash' ? 'revenue_cash' : sourceKey === 'card' ? 'revenue_card' : sourceKey
                const metricValue = Number(exampleReportMetricsForPreview[metricKey] || 0)
                const percent = Number(bonus.percent || 0)
                if (metricValue <= 0) notes.push({ name, reason: `${describeMetric(metricKey, metricValue)} = 0` })
                else if (percent <= 0) notes.push({ name, reason: 'Процент 0%' })
                continue
            }

            if (bonus.type === 'progressive_percent') {
                if (bonus.mode === 'MONTH') {
                    notes.push({ name, reason: 'Месячный KPI — не начисляется в смене' })
                    continue
                }
                const sourceKey = bonus.source || 'total'
                const metricKey = sourceKey === 'total' ? 'total_revenue' : sourceKey === 'cash' ? 'revenue_cash' : sourceKey === 'card' ? 'revenue_card' : sourceKey
                const metricValue = Number(exampleReportMetricsForPreview[metricKey] || 0)
                const thresholds = bonus.thresholds || []
                if (!thresholds.length) {
                    notes.push({ name, reason: 'Нет порогов' })
                    continue
                }
                const minFrom = Math.min(...thresholds.map(t => Number(t.from) || 0))
                if (metricValue < minFrom) {
                    notes.push({ name, reason: `${describeMetric(metricKey, metricValue)} ниже порога ${minFrom.toLocaleString('ru-RU')} ₽` })
                }
                continue
            }

            if (bonus.type === 'checklist') {
                if (bonus.mode === 'MONTH') {
                    notes.push({ name, reason: 'Месячный KPI — не начисляется в смене' })
                    continue
                }
                const templateId = Number(bonus.checklist_template_id)
                const score = Number(exampleChecklistScores[String(templateId)] ?? 100)
                if (Array.isArray(bonus.checklist_thresholds) && bonus.checklist_thresholds.length > 0) {
                    const sorted = [...bonus.checklist_thresholds].sort((a, b) => (Number(b.min_score) || 0) - (Number(a.min_score) || 0))
                    const hit = sorted.find(t => score >= (Number(t.min_score) || 0))
                    if (!hit) {
                        const maxNeed = Math.max(...bonus.checklist_thresholds.map(t => Number(t.min_score) || 0))
                        notes.push({ name, reason: `Оценка ${score.toFixed(0)}% ниже порога ${maxNeed}%` })
                    }
                    continue
                }
                const minScore = Number(bonus.min_score || 0)
                if (score < minScore) notes.push({ name, reason: `Оценка ${score.toFixed(0)}% ниже порога ${minScore}%` })
                continue
            }

            if (bonus.type === 'maintenance_kpi') {
                const isMonthlyTiers = bonus.reward_type === 'FIXED' || bonus.calculation_mode === 'MONTHLY'
                if (isMonthlyTiers) {
                    notes.push({ name, reason: 'Месячный KPI — не начисляется в смене' })
                    continue
                }
                const raw = Number(exampleReportMetricsForPreview.maintenance_raw_sum || 0)
                if (raw <= 0) notes.push({ name, reason: 'Сумма по задачам 0 ₽' })
                continue
            }

            if (bonus.type === 'leaderboard_rank') {
                notes.push({ name, reason: 'Месячный KPI — не начисляется в смене' })
                continue
            }
        }

        return notes
    }, [formula.bonuses, previewResult, exampleReportMetricsForPreview, exampleChecklistScores, describeMetric])

    const explainBonusLine = (b: any): string | null => {
        const cfg = formula.bonuses.find(x => (x.name || x.type) === b.name)
        const metricKey: string | undefined = b.source_key
        const metricValue: number | undefined = typeof b.source_value === 'number' ? b.source_value : undefined

        if (b.type === 'CHECKLIST_BONUS') {
            const score = metricValue ?? 0
            if (cfg && Array.isArray(cfg.checklist_thresholds) && cfg.checklist_thresholds.length > 0) {
                const sorted = [...cfg.checklist_thresholds].sort((a, c) => (Number(c.min_score) || 0) - (Number(a.min_score) || 0))
                const level = sorted.find(t => score >= (Number(t.min_score) || 0))
                if (level) {
                    return `Оценка ${score.toFixed(0)}%, сработал уровень ≥ ${level.min_score}%`
                }
            }
            if (cfg && cfg.min_score) {
                return `Оценка ${score.toFixed(0)}%, порог ${cfg.min_score}%`
            }
            return `Оценка по чек-листу ${score.toFixed(0)}%`
        }

        if (b.type === 'MAINTENANCE_KPI') {
            const raw = metricValue ?? 0
            if (b.multiplier && Number(b.multiplier) !== 1) {
                return `Сумма по задачам ${raw.toFixed(2)} ₽ × множитель эффективности ${Number(b.multiplier).toFixed(2)}`
            }
            return `Сумма по задачам ${raw.toFixed(2)} ₽`
        }

        if (!cfg) {
            if (metricKey && metricValue !== undefined) return describeMetric(metricKey, metricValue)
            return null
        }

        if (cfg.type === 'percent_revenue') {
            const percent = Number(cfg.percent || 0)
            return `${percent.toFixed(1).replace(/\\.0$/, '')}% от ${describeMetric(metricKey, metricValue)}`
        }

        if (cfg.type === 'progressive_percent') {
            const thresholds = cfg.thresholds || []
            if (!thresholds.length || metricValue === undefined) {
                return `Ступенчатый бонус от ${describeMetric(metricKey)}`
            }
            const sorted = [...thresholds].sort((a, c) => (Number(c.from) || 0) - (Number(a.from) || 0))
            const hit = sorted.find(t => metricValue >= (Number(t.from) || 0))
            if (!hit) {
                const minFrom = Math.min(...thresholds.map(t => Number(t.from) || 0))
                return `Текущая метрика ниже первого порога ${minFrom.toLocaleString('ru-RU')} ₽`
            }
            const rt = cfg.reward_type || 'PERCENT'
            if (rt === 'FIXED') {
                const amt = Number(hit.amount || 0)
                return `Порог от ${Number(hit.from || 0).toLocaleString('ru-RU')} ₽, фиксированный бонус ${amt.toLocaleString('ru-RU')} ₽`
            }
            const perc = Number(hit.percent || cfg.percent || 0)
            return `Порог от ${Number(hit.from || 0).toLocaleString('ru-RU')} ₽, ${perc.toFixed(1).replace(/\\.0$/, '')}% от ${describeMetric(metricKey, metricValue)}`
        }

        if (cfg.type === 'personal_overplan') {
            const planPerShift = Number(b.plan_per_shift || 0)
            const kpiPercent = Number(b.kpi_percent || 0)
            const overPercent = Number(b.over_percent || 0)
            const bonusPercent = Number(b.bonus_percent || 0)
            const baseAmountLocal = Number(b.base_amount || 0)
            const fact = metricValue ?? 0
            const dayOfWeek = b.day_of_week ? String(b.day_of_week) : ''
            const shiftType = b.shift_type ? String(b.shift_type) : ''
            const prefix = dayOfWeek || shiftType ? `${dayOfWeekLabel(dayOfWeek)}${dayOfWeek && shiftType ? ' / ' : ''}${shiftTypeLabel(shiftType)}: ` : ''

            return `${prefix}факт ${fact.toLocaleString('ru-RU')} ₽ / план ${planPerShift.toLocaleString('ru-RU')} ₽ (${kpiPercent.toFixed(0)}%) → +${overPercent.toFixed(0)}% → ${bonusPercent.toFixed(0)}% от базы ${baseAmountLocal.toLocaleString('ru-RU')} ₽`
        }

        if (cfg.type === 'fixed') {
            const amt = Number(cfg.amount || b.amount || 0)
            return `Фиксированный бонус ${amt.toLocaleString('ru-RU')} ₽`
        }

        if (cfg.type === 'leaderboard_rank') {
            const from = cfg.rank_from || 1
            const to = cfg.rank_to || from
            return `Место в рейтинге ${from}${to !== from ? `–${to}` : ''}`
        }

        if (metricKey && metricValue !== undefined) {
            return describeMetric(metricKey, metricValue)
        }
        return null
    }

    const effectiveHourlyRateForExample = useMemo(() => {
        if (formula.base.type !== 'hourly') return null
        const baseRate = Number(formula.base.amount || 0)
        const tiers = formula.base.rate_tiers?.tiers
        if (!tiers || tiers.length === 0) return baseRate

        const metricKey = formula.base.rate_tiers?.metric_key || 'total_revenue'
        const cashValue = needsCashCardSplit ? Number(exampleRevenueCash || 0) : Number(exampleShiftRevenue || 0)
        const cardValue = needsCashCardSplit ? Number(exampleRevenueCard || 0) : 0
        const totalRevenue = cashValue + cardValue
        const metricValue =
            metricKey === 'revenue_cash'
                ? cashValue
                : metricKey === 'revenue_card'
                    ? cardValue
                    : metricKey === 'total_revenue'
                        ? totalRevenue
                        : Number(exampleMetricOverrides[metricKey] || 0)

        const sorted = [...tiers].sort((a, b) => (Number(b.from) || 0) - (Number(a.from) || 0))
        const tier = sorted.find(t => metricValue >= (Number(t.from) || 0))
        if (!tier) return baseRate
        const r = Number(tier.rate)
        return Number.isFinite(r) ? r : baseRate
    }, [formula.base, exampleRevenueCash, exampleRevenueCard, exampleShiftRevenue, exampleMetricOverrides, needsCashCardSplit])

    const handleCalculatePreview = async () => {
        setIsPreviewLoading(true)
        try {
            const revenueCash = needsCashCardSplit ? Number(exampleRevenueCash || 0) : Number(exampleShiftRevenue || 0)
            const revenueCard = needsCashCardSplit ? Number(exampleRevenueCard || 0) : 0
            const totalRevenue = revenueCash + revenueCard

            const reportMetricsPayload: Record<string, number> = {
                ...exampleReportMetricsForPreview,
                total_revenue: totalRevenue,
                revenue_cash: revenueCash,
                revenue_card: revenueCard
            }
            const baseRateTiers = (formula.base as any)?.rate_tiers
            if (baseRateTiers && ((baseRateTiers as any).period || 'SHIFT') === 'MONTH') {
                const metricKey = String(baseRateTiers.metric_key || 'total_revenue')
                const monthValue =
                    metricKey === 'total_revenue'
                        ? Number(exampleMonthMetrics.total_revenue || 0)
                        : metricKey === 'revenue_cash'
                            ? Number(exampleMonthMetrics.revenue_cash || 0)
                            : metricKey === 'revenue_card'
                                ? Number(exampleMonthMetrics.revenue_card || 0)
                                : Number((exampleMonthMetrics as any)[metricKey] || 0)
                reportMetricsPayload[`month_employee_${metricKey}`] = monthValue
                reportMetricsPayload[`month_club_${metricKey}`] = monthValue
            }

            const checklistTemplateIds = Array.from(
                new Set(
                    formula.bonuses
                        .filter(b => b.type === 'checklist')
                        .map(b => Number(b.checklist_template_id))
                        .filter(Boolean)
                )
            )

            const evaluations = checklistTemplateIds.map(templateId => ({
                template_id: templateId,
                score_percent: Number(exampleChecklistScores[String(templateId)] ?? 100)
            }))

            const schemePayload = {
                base: formula.base,
                bonuses: formula.bonuses,
                period_bonuses: [],
                standard_monthly_shifts: standardMonthlyShifts
            }

            const shiftPayload = {
                id: 'example',
                shift_type: exampleShiftType,
                day_of_week: exampleDayOfWeek,
                total_hours: Number(exampleHours || 0),
                bar_purchases: Number(exampleBarPurchases || 0),
                evaluations
            }

            const res = await fetch(`/api/clubs/${clubId}/salary-schemes/preview`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scheme: schemePayload, shift: shiftPayload, reportMetrics: reportMetricsPayload })
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data?.error || 'Ошибка расчёта')

            setPreviewResult(data)
        } catch (e: any) {
            alert(e?.message || 'Ошибка расчёта')
        } finally {
            setIsPreviewLoading(false)
        }
    }

    const addMonthSpecialShift = () => {
        setMonthSpecialShifts(prev => {
            const id = generateId()
            return [
                ...prev,
                {
                    id,
                    shift_type: exampleShiftType,
                    day_of_week: exampleDayOfWeek,
                    hours: Number(exampleHours || 0),
                    revenue: Number(exampleShiftRevenue || 0),
                    revenue_cash: Number(exampleRevenueCash || 0),
                    revenue_card: Number(exampleRevenueCard || 0),
                    bar_purchases: Number(exampleBarPurchases || 0),
                    checklistScores: { ...exampleChecklistScores }
                }
            ]
        })
    }

    const removeMonthSpecialShift = (id: string) => {
        setMonthSpecialShifts(prev => prev.filter(s => s.id !== id))
    }

    const updateMonthSpecialShift = (id: string, patch: Partial<{
        shift_type: 'DAY' | 'NIGHT'
        day_of_week: 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN'
        hours: number
        revenue: number
        revenue_cash: number
        revenue_card: number
        bar_purchases: number
    }>) => {
        setMonthSpecialShifts(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s))
    }

    const updateMonthSpecialShiftChecklistScore = (id: string, templateId: number, score: number) => {
        setMonthSpecialShifts(prev => prev.map(s => {
            if (s.id !== id) return s
            const next = { ...(s.checklistScores || {}) }
            next[String(templateId)] = score
            return { ...s, checklistScores: next }
        }))
    }

    const handleCalculateMonthPreview = async () => {
        setIsPreviewLoading(true)
        try {
            const schemePayload = { base: formula.base, bonuses: formula.bonuses, period_bonuses: [], standard_monthly_shifts: standardMonthlyShifts }

            const templateCount = Math.max(0, Number(exampleMonthShiftsWorked || 0) - monthSpecialShifts.length)

            const baseRateTiers = (formula.base as any)?.rate_tiers
            const tierMetricKey = baseRateTiers && ((baseRateTiers as any).period || 'SHIFT') === 'MONTH'
                ? String(baseRateTiers.metric_key || 'total_revenue')
                : null

            const computeMonthMetricFromShifts = (key: string) => {
                const typicalRevenueCash = needsCashCardSplit ? Number(exampleRevenueCash || 0) : Number(exampleShiftRevenue || 0)
                const typicalRevenueCard = needsCashCardSplit ? Number(exampleRevenueCard || 0) : 0
                const typicalTotal = typicalRevenueCash + typicalRevenueCard

                const sumTypical = key === 'revenue_cash'
                    ? typicalRevenueCash * templateCount
                    : key === 'revenue_card'
                        ? typicalRevenueCard * templateCount
                        : typicalTotal * templateCount

                const sumSpecial = monthSpecialShifts.reduce((acc, s) => {
                    const rc = needsCashCardSplit ? Number(s.revenue_cash || 0) : Number(s.revenue || 0)
                    const rcard = needsCashCardSplit ? Number(s.revenue_card || 0) : 0
                    if (key === 'revenue_cash') return acc + rc
                    if (key === 'revenue_card') return acc + rcard
                    return acc + (rc + rcard)
                }, 0)

                return Number((sumTypical + sumSpecial).toFixed(2))
            }

            const monthTierValue =
                tierMetricKey === 'total_revenue'
                    ? computeMonthMetricFromShifts('total_revenue')
                    : tierMetricKey === 'revenue_cash'
                        ? computeMonthMetricFromShifts('revenue_cash')
                        : tierMetricKey === 'revenue_card'
                            ? computeMonthMetricFromShifts('revenue_card')
                            : (tierMetricKey ? Number((exampleMonthMetrics as any)[tierMetricKey] || 0) : 0)

            const buildShiftRequest = (shiftInput: {
                shift_type?: 'DAY' | 'NIGHT'
                day_of_week?: 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN'
                hours: number
                revenue: number
                revenue_cash?: number
                revenue_card?: number
                bar_purchases: number
                checklistScores?: Record<string, number>
            }) => {
                const revenueCash = needsCashCardSplit ? Number(shiftInput.revenue_cash || 0) : Number(shiftInput.revenue || 0)
                const revenueCard = needsCashCardSplit ? Number(shiftInput.revenue_card || 0) : 0
                const totalRevenue = revenueCash + revenueCard

                const reportMetricsPayload: Record<string, number> = {
                    ...exampleReportMetricsForPreview,
                    total_revenue: totalRevenue,
                    revenue_cash: revenueCash,
                    revenue_card: revenueCard
                }
                const baseRateTiers = (formula.base as any)?.rate_tiers
                if (baseRateTiers && ((baseRateTiers as any).period || 'SHIFT') === 'MONTH') {
                    const metricKey = String(baseRateTiers.metric_key || 'total_revenue')
                    reportMetricsPayload[`month_employee_${metricKey}`] = monthTierValue
                    reportMetricsPayload[`month_club_${metricKey}`] = monthTierValue
                }

                const evaluations = shiftChecklistTemplateIds.map(templateId => ({
                    template_id: templateId,
                    score_percent: Number((shiftInput.checklistScores || {})[String(templateId)] ?? exampleChecklistScores[String(templateId)] ?? 100)
                }))

                const shiftPayload = {
                    id: 'example',
                    shift_type: shiftInput.shift_type || exampleShiftType,
                    day_of_week: shiftInput.day_of_week || exampleDayOfWeek,
                    total_hours: Number(shiftInput.hours || 0),
                    bar_purchases: Number(shiftInput.bar_purchases || 0),
                    evaluations
                }

                return { scheme: schemePayload, shift: shiftPayload, reportMetrics: reportMetricsPayload }
            }

            const typicalRequest = buildShiftRequest({
                shift_type: exampleShiftType,
                day_of_week: exampleDayOfWeek,
                hours: Number(exampleHours || 0),
                revenue: Number(exampleShiftRevenue || 0),
                revenue_cash: Number(exampleRevenueCash || 0),
                revenue_card: Number(exampleRevenueCard || 0),
                bar_purchases: Number(exampleBarPurchases || 0),
                checklistScores: { ...exampleChecklistScores }
            })

            const fetchPreview = async (payload: any) => {
                const res = await fetch(`/api/clubs/${clubId}/salary-schemes/preview`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                })
                const data = await res.json()
                if (!res.ok) throw new Error(data?.error || 'Ошибка расчёта')
                return data
            }

            const typicalResult = await fetchPreview(typicalRequest)
            const specialResults = await Promise.all(
                monthSpecialShifts.map(async s => {
                    const payload = buildShiftRequest({
                        shift_type: s.shift_type,
                        day_of_week: s.day_of_week,
                        hours: Number(s.hours || 0),
                        revenue: Number(s.revenue || 0),
                        revenue_cash: Number(s.revenue_cash || 0),
                        revenue_card: Number(s.revenue_card || 0),
                        bar_purchases: Number(s.bar_purchases || 0),
                        checklistScores: s.checklistScores || {}
                    })
                    const result = await fetchPreview(payload)
                    return { id: s.id, input: s, result }
                })
            )

            const sumShiftReal = (Number(typicalResult?.breakdown?.total || 0) * templateCount) + specialResults.reduce((acc, r) => acc + Number(r.result?.breakdown?.total || 0), 0)
            const sumShiftVirtual = (Number(typicalResult?.breakdown?.virtual_balance_total || 0) * templateCount) + specialResults.reduce((acc, r) => acc + Number(r.result?.breakdown?.virtual_balance_total || 0), 0)
            const sumShiftInstant = (Number(typicalResult?.breakdown?.instant_payout || 0) * templateCount) + specialResults.reduce((acc, r) => acc + Number(r.result?.breakdown?.instant_payout || 0), 0)
            const sumShiftAccrued = (Number(typicalResult?.breakdown?.accrued_payout || 0) * templateCount) + specialResults.reduce((acc, r) => acc + Number(r.result?.breakdown?.accrued_payout || 0), 0)

            const monthReal = parseFloat((sumShiftReal + Number(monthlyKpiPreview.totalReal || 0)).toFixed(2))
            const monthVirtual = parseFloat((sumShiftVirtual + Number(monthlyKpiPreview.totalVirtual || 0)).toFixed(2))
            const monthInstant = parseFloat(sumShiftInstant.toFixed(2))
            const monthAccrued = parseFloat((sumShiftAccrued + Number(monthlyKpiPreview.totalReal || 0)).toFixed(2))

            setMonthPreview({
                templateCount,
                specialCount: monthSpecialShifts.length,
                totalCount: Number(exampleMonthShiftsWorked || 0),
                typical: { input: typicalRequest, result: typicalResult },
                special: specialResults,
                shifts: {
                    real: parseFloat(sumShiftReal.toFixed(2)),
                    virtual: parseFloat(sumShiftVirtual.toFixed(2)),
                    instant: parseFloat(sumShiftInstant.toFixed(2)),
                    accrued: parseFloat(sumShiftAccrued.toFixed(2))
                },
                monthly: monthlyKpiPreview,
                totals: {
                    real: monthReal,
                    virtual: monthVirtual,
                    instant: monthInstant,
                    accrued: monthAccrued
                }
            })
        } catch (e: any) {
            alert(e?.message || 'Ошибка расчёта')
        } finally {
            setIsPreviewLoading(false)
        }
    }

    if (isLoading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-purple-600" /></div>

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-11 w-11 rounded-full bg-white border border-slate-200 hover:bg-slate-100 shadow-sm"><ArrowLeft className="h-5 w-5" /></Button>
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">{isNew ? 'Создание схемы оплаты' : `Редактирование: ${schemeName}`}</h1>
                        <p className="text-muted-foreground text-sm">{isNew ? 'Настройте новую формулу расчёта зарплаты' : 'Измените параметры схемы. Это создаст новую версию.'}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" className="h-11 rounded-xl px-6 border-slate-200" onClick={() => router.back()}>Отмена</Button>
                    <Button onClick={handleSave} disabled={isSaving} className="h-11 rounded-xl px-6 gap-2 bg-slate-900 text-white hover:bg-slate-800">{isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Сохранить</Button>
                </div>
            </div>

            <Tabs defaultValue="base" className="space-y-6">
                <TabsList className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-100/50 p-1 text-muted-foreground w-full max-w-2xl">
                    <TabsTrigger value="base" className="inline-flex items-center justify-center whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm w-full">1. База и Условия</TabsTrigger>
                    <TabsTrigger value="motivation" className="inline-flex items-center justify-center whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm w-full">2. Мотивация</TabsTrigger>
                    <TabsTrigger value="example" className="inline-flex items-center justify-center whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm w-full">3. Пример</TabsTrigger>
                </TabsList>

                <TabsContent value="base" className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="p-6 md:p-8 space-y-8">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-purple-50 flex items-center justify-center"><Edit className="h-5 w-5 text-purple-600" /></div>
                                <h2 className="text-xl font-semibold">Базовые настройки</h2>
                            </div>
                            <div className="space-y-6">
                                <div className="grid md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-sm font-medium ml-1">Название схемы *</Label>
                                        <Input value={schemeName} onChange={e => setSchemeName(e.target.value)} placeholder="Например: Старший администратор (Ночь)" className="h-11 rounded-xl bg-slate-50/50" />
                                        <p className="text-xs text-muted-foreground ml-1">Укажите понятное название, чтобы не запутаться при назначении сотрудникам.</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-sm font-medium ml-1">Эталон смен</Label>
                                        <div className="flex items-center gap-3">
                                            <NumericInput value={standardMonthlyShifts} onValueChange={(v) => setStandardMonthlyShifts(Math.max(1, Math.trunc(v)))} emptyValue={15} className="h-11 w-24 rounded-xl bg-slate-50/50 text-center font-bold" />
                                            <span className="text-xs text-muted-foreground font-medium">смен в месяц (норма)</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground ml-1">Используется для расчета KPI. Если сотрудник работает больше нормы — план растет.</p>
                                    </div>
                                </div>

                            <div className="space-y-4 pt-4 border-t border-slate-100">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center"><DollarSign className="h-5 w-5 text-emerald-600" /></div>
                                            <div>
                                                <h3 className="font-medium text-sm">Базовая ставка</h3>
                                                <p className="text-xs text-muted-foreground">Фиксированная оплата за выход или часы</p>
                                            </div>
                                        </div>
                                        <div className="flex p-1 bg-slate-100/50 rounded-xl h-11 items-center">
                                            <button type="button" onClick={() => handleUpdateBaseType('hourly')} className={`px-4 h-9 rounded-lg text-sm font-medium transition-all ${formula.base.type === 'hourly' ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Почасовая</button>
                                            <button type="button" onClick={() => handleUpdateBaseType('per_shift')} className={`px-4 h-9 rounded-lg text-sm font-medium transition-all ${formula.base.type === 'per_shift' ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>За смену</button>
                                        </div>
                                    </div>

                                {formula.base.type !== 'none' && (
                                    <div className="bg-slate-50/50 rounded-2xl p-6 space-y-6 animate-in zoom-in-95 duration-300 border border-slate-100">
                                        <div className="flex flex-col md:flex-row items-start justify-between gap-8">
                                            <div className="space-y-4 flex-1 w-full">
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-sm font-medium">Размер ставки</Label>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-medium text-muted-foreground">Ночной тариф</span>
                                                        <Switch checked={!!(formula.base.day_rate || formula.base.night_rate)} disabled={!!formula.base.rate_tiers} onCheckedChange={checked => { if (checked) { updateBaseAmount('day_rate', formula.base.amount || 500); updateBaseAmount('night_rate', (formula.base.amount || 500) * 1.2) } else { setFormula(prev => ({ ...prev, base: { type: prev.base.type, amount: prev.base.day_rate || prev.base.amount || 500 } })) } }} className="data-[state=checked]:bg-emerald-600" />
                                                    </div>
                                                </div>
                                                
                                                {formula.base.day_rate !== undefined ? (
                                                    <div className="space-y-3">
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div className="relative group">
                                                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-500"><Sun className="h-4 w-4" /></div>
                                                                <NumericInput value={Number(formula.base.day_rate || 0)} onValueChange={(v) => updateBaseAmount('day_rate', v)} className="h-11 rounded-xl border-slate-200 bg-white pl-10 pr-8 text-sm font-medium" />
                                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">₽</span>
                                                            </div>
                                                            <div className="relative group">
                                                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-500"><Moon className="h-4 w-4" /></div>
                                                                <NumericInput value={Number(formula.base.night_rate || 0)} onValueChange={(v) => updateBaseAmount('night_rate', v)} className="h-11 rounded-xl border-slate-200 bg-white pl-10 pr-8 text-sm font-medium" />
                                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">₽</span>
                                                            </div>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground leading-snug">
                                                            Ночной тариф применяется автоматически для смен, которые начинаются или заканчиваются в ночное время (обычно с 22:00 до 08:00).
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {!formula.base.rate_tiers && (
                                                            <>
                                                                <div className="relative group max-w-[160px]">
                                                                    <NumericInput value={Number(formula.base.amount || 0)} onValueChange={(v) => updateBaseAmount('amount', v)} className="h-11 rounded-xl border-slate-200 bg-white pl-4 pr-8 text-sm font-medium" />
                                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">₽</span>
                                                                </div>
                                                                <p className="text-xs text-muted-foreground leading-snug">
                                                                    {formula.base.type === 'hourly'
                                                                        ? "Оплата за один час работы. Умножается на количество отработанных часов."
                                                                        : "Фиксированная сумма за одну смену. Выплачивается при выполнении нормы часов."}
                                                                </p>
                                                            </>
                                                        )}

                                                        {(formula.base.type === 'hourly' || formula.base.type === 'per_shift') && (
                                                            <div className="pt-4 mt-4 border-t border-slate-100 space-y-4">
                                                                <div className="flex items-center justify-between">
                                                                    <div>
                                                                        <p className="text-sm font-medium">Ставка по порогам</p>
                                                                        <p className="text-xs text-muted-foreground">Автоматически выбирает ставку по метрике</p>
                                                                    </div>
                                                                    <Switch checked={!!formula.base.rate_tiers} onCheckedChange={toggleBaseRateTiers} className="data-[state=checked]:bg-slate-900" />
                                                                </div>

                                                                {formula.base.rate_tiers && (
                                                                    <div className="space-y-4">
                                                                        <div className="grid md:grid-cols-2 gap-4">
                                                                            <div className="space-y-2">
                                                                                <Label className="text-xs font-medium text-muted-foreground">Период</Label>
                                                                                <Select
                                                                                    value={(formula.base.rate_tiers as any).period || 'SHIFT'}
                                                                                    onValueChange={(v) => setFormula(prev => {
                                                                                        const current = prev.base.rate_tiers
                                                                                        if (!current) return prev
                                                                                        const next = { ...current, period: v }
                                                                                        const nextBase = { ...prev.base, rate_tiers: next }
                                                                                        if (v === 'MONTH' && nextBase.payout_timing === 'SHIFT') {
                                                                                            nextBase.payout_timing = 'MONTH'
                                                                                        }
                                                                                        return { ...prev, base: nextBase }
                                                                                    })}
                                                                                >
                                                                                    <SelectTrigger className="h-11 rounded-xl bg-white border-slate-200">
                                                                                        <SelectValue />
                                                                                    </SelectTrigger>
                                                                                    <SelectContent>
                                                                                        <SelectItem value="SHIFT">За смену</SelectItem>
                                                                                        <SelectItem value="MONTH">За месяц</SelectItem>
                                                                                    </SelectContent>
                                                                                </Select>
                                                                            </div>
                                                                            <div className="space-y-2">
                                                                                <Label className="text-xs font-medium text-muted-foreground">Считать по</Label>
                                                                                <Select
                                                                                    value={(formula.base.rate_tiers as any).scope || 'EMPLOYEE'}
                                                                                    onValueChange={(v) => setFormula(prev => {
                                                                                        const current = prev.base.rate_tiers
                                                                                        if (!current) return prev
                                                                                        return { ...prev, base: { ...prev.base, rate_tiers: { ...current, scope: v } } }
                                                                                    })}
                                                                                    disabled={((formula.base.rate_tiers as any).period || 'SHIFT') !== 'MONTH'}
                                                                                >
                                                                                    <SelectTrigger className="h-11 rounded-xl bg-white border-slate-200">
                                                                                        <SelectValue />
                                                                                    </SelectTrigger>
                                                                                    <SelectContent>
                                                                                        <SelectItem value="EMPLOYEE">Сотруднику</SelectItem>
                                                                                        <SelectItem value="CLUB">Клубу</SelectItem>
                                                                                    </SelectContent>
                                                                                </Select>
                                                                            </div>
                                                                        </div>

                                                                        <div className="flex flex-col md:flex-row gap-3 md:items-end md:justify-between">
                                                                            <div className="space-y-2">
                                                                                <Label className="text-xs font-medium text-muted-foreground">Метрика для порогов</Label>
                                                                                <Select
                                                                                    value={formula.base.rate_tiers.metric_key || 'total_revenue'}
                                                                                    onValueChange={(v) => setFormula(prev => ({ ...prev, base: { ...prev.base, rate_tiers: prev.base.rate_tiers ? { ...prev.base.rate_tiers, metric_key: v } : { metric_key: v, period: 'SHIFT', scope: 'EMPLOYEE', tiers: [] } } }))}
                                                                                >
                                                                                    <SelectTrigger className="h-11 rounded-xl bg-white border-slate-200 w-full md:w-[320px]">
                                                                                        <SelectValue placeholder="Выберите метрику" />
                                                                                    </SelectTrigger>
                                                                                    <SelectContent>
                                                                                        {metricOptionsForTiers.map(m => (
                                                                                            <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                                                                                        ))}
                                                                                    </SelectContent>
                                                                                </Select>
                                                                            </div>
                                                                            <Button type="button" variant="outline" className="h-11 rounded-xl px-4 border-slate-200 w-full md:w-auto" onClick={addBaseRateTier}>
                                                                                <Plus className="mr-2 h-4 w-4" />
                                                                                Добавить порог
                                                                            </Button>
                                                                        </div>

                                                                        <div className="space-y-2">
                                                                            {formula.base.rate_tiers.tiers.map((t: any, idx: number) => (
                                                                                <div key={String(t.id)} className="flex flex-col md:flex-row md:items-center gap-3 bg-white border border-slate-200 rounded-2xl p-4">
                                                                                    <div className="flex items-center gap-3 w-full">
                                                                                        <div className="flex-1">
                                                                                            <Label className="text-xs font-medium text-muted-foreground">От (₽)</Label>
                                                                                            <NumericInput value={Number(t.from || 0)} onValueChange={(v) => updateBaseRateTier(String(t.id), { from: v })} disabled={idx === 0} className="h-11 rounded-xl border-slate-200" />
                                                                                        </div>
                                                                                        <div className="flex-1">
                                                                                            <Label className="text-xs font-medium text-muted-foreground">{formula.base.type === 'hourly' ? 'Ставка (₽/ч)' : 'Ставка (₽/смена)'}</Label>
                                                                                            <NumericInput value={Number(t.rate || 0)} onValueChange={(v) => updateBaseRateTier(String(t.id), { rate: v })} className="h-11 rounded-xl border-slate-200" />
                                                                                        </div>
                                                                                    </div>
                                                                                    <Button type="button" variant="outline" size="icon" disabled={idx === 0} className={`h-11 w-11 rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 ${idx === 0 ? 'opacity-50 cursor-not-allowed hover:bg-transparent hover:text-rose-600' : ''}`} onClick={() => removeBaseRateTier(String(t.id))}>
                                                                                        <Trash2 className="h-4 w-4" />
                                                                                    </Button>
                                                                                </div>
                                                                            ))}
                                                                            {formula.base.rate_tiers.tiers.length === 0 && (
                                                                                <div className="text-xs text-muted-foreground italic">Добавьте пороги, чтобы ставка менялась автоматически.</div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="hidden md:block w-px bg-slate-200 self-stretch" />

                                            <div className="space-y-4 flex-1 w-full">
                                                <Label className="text-sm font-medium">Условия выплаты</Label>
                                                <div className="space-y-3">
                                                    <div className="flex flex-col gap-2">
                                                        <span className="text-xs font-medium text-slate-500">Когда выплачивать?</span>
                                                        <div className="flex p-1 bg-slate-100/50 rounded-xl h-11 items-center w-fit">
                                                            <button 
                                                                type="button" 
                                                                onClick={() => setFormula(prev => ({ ...prev, base: { ...prev.base, payout_timing: 'MONTH' } }))}
                                                                className={`px-3 h-9 rounded-lg text-xs font-medium transition-all ${(!formula.base.payout_timing || formula.base.payout_timing === 'MONTH') ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                                            >
                                                                В конце месяца
                                                            </button>
                                                            <button 
                                                                type="button" 
                                                                onClick={() => setFormula(prev => ({ ...prev, base: { ...prev.base, payout_timing: 'SHIFT' } }))}
                                                                disabled={!!formula.base.rate_tiers && ((formula.base.rate_tiers as any).period || 'SHIFT') === 'MONTH'}
                                                                className={`px-3 h-9 rounded-lg text-xs font-medium transition-all ${formula.base.payout_timing === 'SHIFT' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'} ${!!formula.base.rate_tiers && ((formula.base.rate_tiers as any).period || 'SHIFT') === 'MONTH' ? 'opacity-50 cursor-not-allowed hover:text-muted-foreground' : ''}`}
                                                            >
                                                                В конце смены
                                                            </button>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground leading-snug">
                                                            {(!formula.base.payout_timing || formula.base.payout_timing === 'MONTH') 
                                                                ? "Сумма будет копиться на балансе и выплачиваться в расчетный день." 
                                                                : "Система предложит выдать деньги из кассы сразу после закрытия смены."}
                                                        </p>
                                                    </div>
                                                    
                                                    {formula.base.type === 'per_shift' && (
                                                        <div className="space-y-2 mt-4 pt-4 border-t border-slate-100">
                                                            <div className="flex items-center gap-3">
                                                                <span className="text-sm font-medium">Полная смена от:</span>
                                                                <div className="relative w-20">
                                                                    <NumericInput value={Number(formula.base.full_shift_hours ?? 12)} onValueChange={(v) => updateBaseAmount('full_shift_hours', Math.max(0, v))} emptyValue={12} className="h-11 rounded-xl border-slate-200 text-center font-medium pr-6" />
                                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">ч</span>
                                                                </div>
                                                            </div>
                                                            <p className="text-xs text-muted-foreground leading-snug">Если отработано меньше — оплата снизится пропорционально.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                </TabsContent>

                <TabsContent value="motivation" className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-500">
                    {/* Daily Bonuses Section */}
                    <div className="space-y-6">
                        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                            <div className="p-6 md:p-8 space-y-8">
                                <div className="flex flex-col gap-2">
                                    <h2 className="text-xl font-semibold">Мотивация</h2>
                                    <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
                                        Настройте систему поощрений, чтобы сотрудники зарабатывали больше, принося пользу клубу. 
                                        Комбинируйте бонусы за выручку, выполнение задач и качество работы (чек-листы). 
                                        Прозрачная система мотивации повышает эффективность персонала.
                                    </p>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {BONUS_TYPES.map((item) => {
                                        const isActive = isBonusActive(item.type)
                                        return (
                                            <button
                                                key={item.type}
                                                type="button"
                                                onClick={() => addBonus(item.type)}
                                                className={cn(
                                                    "relative flex flex-col items-start p-5 rounded-2xl border-2 transition-all duration-200 text-left hover:shadow-md group",
                                                    isActive 
                                                        ? item.activeClass
                                                        : "bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50"
                                                )}
                                            >
                                                <div className="flex items-start justify-between w-full mb-3">
                                                    <div className={cn(
                                                        "h-10 w-10 rounded-xl flex items-center justify-center transition-colors",
                                                        isActive ? item.iconClass : "bg-slate-100 text-slate-500 group-hover:bg-white group-hover:shadow-sm"
                                                    )}>
                                                        <item.icon className="h-5 w-5" />
                                                    </div>
                                                    {isActive && (
                                                        <div className="flex items-center gap-1.5 bg-white/80 backdrop-blur px-2 py-1 rounded-lg shadow-sm border border-black/5">
                                                            <div className={cn("h-1.5 w-1.5 rounded-full animate-pulse", item.dotClass)} />
                                                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-600">Активен</span>
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                <div className="font-bold text-sm text-slate-900 mb-1.5 flex items-center gap-2">
                                                    {item.label}
                                                </div>
                                                <p className={cn(
                                                    "text-xs font-medium leading-relaxed",
                                                    isActive ? "text-slate-600" : "text-slate-500"
                                                )}>
                                                    {item.description}
                                                </p>
                                            </button>
                                        )
                                    })}
                                </div>
                                {formula.bonuses.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border-2 border-dashed rounded-[2rem] bg-slate-50/50 border-slate-200/50"><div className="h-16 w-16 rounded-full bg-white flex items-center justify-center shadow-sm mb-4"><Percent className="h-8 w-8 opacity-20" /></div><p className="text-sm font-bold uppercase tracking-widest opacity-40">Список бонусов пуст</p><p className="text-xs mt-2 font-medium opacity-40">Выберите тип выше, чтобы добавить его в схему</p></div>
                                ) : (
                                    <div className="grid gap-6">
                                        {formula.bonuses.map((bonus, index) => (
                                            <div id={`bonus-${index}`} key={index} className={`group relative rounded-3xl p-6 md:p-8 border border-slate-100 shadow-sm transition-all duration-300 ${'bg-white hover:shadow-md'}`}>
                                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                                                    <div className="flex items-center gap-4 flex-1">
                                                        <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shadow-sm ${bonus.type === 'progressive_percent' ? 'bg-emerald-600 text-white' : bonus.type === 'leaderboard_rank' ? 'bg-amber-500 text-white' : bonus.type === 'personal_overplan' ? 'bg-slate-900 text-white' : 'bg-purple-600 text-white'}`}>{bonus.type === 'percent_revenue' && <Percent className="h-6 w-6" />}{bonus.type === 'fixed' && <Coins className="h-6 w-6" />}{bonus.type === 'progressive_percent' && <TrendingUp className="h-6 w-6" />}{bonus.type === 'personal_overplan' && <ShieldAlert className="h-6 w-6" />}{bonus.type === 'checklist' && <ClipboardCheck className="h-6 w-6" />}{bonus.type === 'maintenance_kpi' && <Wrench className="h-6 w-6" />}{bonus.type === 'leaderboard_rank' && <Trophy className="h-6 w-6" />}</div>
                                                        <div className="space-y-1.5"><Badge variant="secondary" className={`text-xs font-medium px-2.5 py-0.5 rounded-lg ${bonus.type === 'progressive_percent' ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : bonus.type === 'leaderboard_rank' ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : bonus.type === 'personal_overplan' ? 'bg-slate-100 text-slate-800 hover:bg-slate-200' : 'bg-purple-50 text-purple-700 hover:bg-purple-100'}`}>{bonus.type === 'percent_revenue' && 'Процент от выручки'}{bonus.type === 'fixed' && 'Фиксированный бонус'}{bonus.type === 'progressive_percent' && 'Бонус за выполнение плана'}{bonus.type === 'personal_overplan' && 'Личный бонус'}{bonus.type === 'checklist' && 'Бонус за чек-лист'}{bonus.type === 'maintenance_kpi' && 'Бонус за обслуживание'}{bonus.type === 'leaderboard_rank' && 'Бонус за место'}</Badge><Input value={bonus.name || ''} onChange={(e) => updateBonus(index, 'name', e.target.value)} className="h-10 text-xl font-semibold bg-transparent border-none p-0 focus-visible:ring-0 focus-visible:outline-none placeholder:text-slate-300" placeholder="Название бонуса..." /></div>
                                                    </div>
                                                    <Button type="button" variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-red-500 hover:text-white transition-all shrink-0" onClick={() => removeBonus(index)}><Trash2 className="h-5 w-5" /></Button>
                                                </div>
                                                <div className="space-y-8">
                                                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5">
                                                        <div className="flex items-start gap-3">
                                                            <HelpCircle className="h-5 w-5 text-purple-500 shrink-0 mt-0.5" />
                                                            <div className="space-y-1">
                                                                <h5 className="text-sm font-medium text-slate-700">Как это работает?</h5>
                                                                <p className="text-xs text-slate-500 leading-relaxed">
                                                                    {bonus.type === 'percent_revenue' && "Сотрудник получает указанный % от каждой заработанной суммы. Если выручка 50,000₽, а бонус 5%, то к зарплате добавится 2,500₽."}
                                                                    {bonus.type === 'fixed' && "Просто фиксированная сумма за выход в смену. Добавляется к базовой ставке независимо от выручки."}

                                                                    {bonus.type === 'progressive_percent' && "Мотивирует зарабатывать сверх плана. Чем больше выручка, тем выше процент от суммы превышения порога."}
                                                                    {bonus.type === 'personal_overplan' && "Личный бонус за перевыполнение плана. Сначала считаем % выполнения (факт / план на смену). Дальше по ступеням перевыполнения выбираем %, который начисляется от выбранной базы (база смены или выручка)."}
                                                                    
                                                                    {bonus.type === 'checklist' && "Премия за дисциплину. Начисляется только если средний балл по чеклистам за смену (или месяц) выше порога."}
                                                                    {bonus.type === 'maintenance_kpi' && "Оплата за техническую работу. Можно платить за каждую выполненную задачу по обслуживанию ПК."}
                                                                    {bonus.type === 'leaderboard_rank' && "Система сравнивает сотрудников клуба по общему рейтингу за месяц и выдает премию за выбранное место в таблице."}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-col sm:flex-row gap-6">
                                                        <div className="flex flex-col gap-3">
                                                            <Label className="text-sm font-medium ml-1">Куда зачислять бонус?</Label>
                                                            <div className="flex p-1 bg-slate-100/50 rounded-xl h-11 items-center w-fit">
                                                                <button type="button" className={`flex items-center gap-2 px-6 h-9 rounded-lg text-sm font-medium transition-all ${bonus.payout_type === 'REAL_MONEY' || !bonus.payout_type ? 'bg-white shadow-sm text-emerald-600' : 'text-muted-foreground hover:text-foreground'}`} onClick={() => updateBonus(index, 'payout_type', 'REAL_MONEY')}><Coins className="h-4 w-4" /> Деньги</button>
                                                                <button type="button" className={`flex items-center gap-2 px-6 h-9 rounded-lg text-sm font-medium transition-all ${bonus.payout_type === 'VIRTUAL_BALANCE' ? 'bg-white shadow-sm text-purple-600' : 'text-muted-foreground hover:text-foreground'}`} onClick={() => updateBonus(index, 'payout_type', 'VIRTUAL_BALANCE')}><Wallet className="h-4 w-4" /> На депозит</button>
                                                            </div>
                                                        </div>

                                                        {bonus.payout_type !== 'VIRTUAL_BALANCE' && bonus.type !== 'leaderboard_rank' && (
                                                            <div className="flex flex-col gap-3">
                                                                <Label className="text-sm font-medium ml-1">Когда выплачивать?</Label>
                                                                <div className="flex p-1 bg-emerald-50/50 rounded-xl h-11 items-center w-fit border border-emerald-100/50">
                                                                    <button type="button" className={`flex items-center gap-2 px-6 h-9 rounded-lg text-sm font-medium transition-all ${(!bonus.payout_timing || bonus.payout_timing === 'MONTH') ? 'bg-white shadow-sm text-emerald-600' : 'text-emerald-700/50 hover:text-emerald-700'}`} onClick={() => updateBonus(index, 'payout_timing', 'MONTH')}>В конце месяца</button>
                                                                    <button type="button" className={`flex items-center gap-2 px-6 h-9 rounded-lg text-sm font-medium transition-all ${bonus.payout_timing === 'SHIFT' ? 'bg-white shadow-sm text-emerald-600' : 'text-emerald-700/50 hover:text-emerald-700'}`} onClick={() => updateBonus(index, 'payout_timing', 'SHIFT')}>В конце смены</button>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {bonus.type === 'leaderboard_rank' && (
                                                            <div className="flex flex-col gap-3">
                                                                <Label className="text-sm font-medium ml-1">Когда выплачивать?</Label>
                                                                <div className="flex items-center gap-2 px-6 h-11 rounded-xl text-sm font-medium bg-amber-50 text-amber-700 border border-amber-100 w-fit">
                                                                    <Trophy className="h-4 w-4" />
                                                                    Только в конце месяца
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="grid md:grid-cols-2 gap-8 items-start">
                                                        <div className="space-y-4"><Label className="text-sm font-medium ml-1">Настройки расчета</Label>
                                                            {bonus.type === 'percent_revenue' && (
                                                                <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                                                    <div className="relative w-24">
                                                                        <NumericInput value={Number(bonus.percent ?? 0)} onValueChange={(v) => updateBonus(index, 'percent', v)} className="h-11 rounded-xl text-center font-medium text-lg border-slate-200" />
                                                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 font-medium text-muted-foreground">%</span>
                                                                    </div>
                                                                    <span className="text-xs font-medium text-muted-foreground">от</span>
                                                                    <Select value={bonus.source || 'total'} onValueChange={value => updateBonus(index, 'source', value as any)}>
                                                                        <SelectTrigger className="flex-1 h-11 rounded-xl border-slate-200 bg-white font-medium text-sm">
                                                                            <SelectValue placeholder="Выберите показатель" />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            {reportMetrics.length > 0 ? (
                                                                                <>
                                                                                     {!reportMetrics.some(m => m.key === 'total_revenue') && <SelectItem value="total_revenue">Общая выручка</SelectItem>}
                                                                                     {reportMetrics.map(m => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}
                                                                                </>
                                                                            ) : (
                                                                                <>
                                                                                    <SelectItem value="total_revenue">Общая выручка</SelectItem>
                                                                                    <SelectItem value="cash">Наличных</SelectItem>
                                                                                    <SelectItem value="card">Безналичных</SelectItem>
                                                                                </>
                                                                            )}
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                            )}
                                                            {bonus.type === 'fixed' && <div className="relative max-w-xs group"><NumericInput value={Number(bonus.amount ?? 0)} onValueChange={(v) => updateBonus(index, 'amount', v)} className="h-11 rounded-xl border-slate-200 bg-slate-50 pl-6 pr-12 text-lg font-medium text-slate-700" /><span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">₽</span></div>}

                                                            {bonus.type === 'personal_overplan' && (
                                                                <div className="space-y-4">
                                                                    <div className="space-y-2">
                                                                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Считать бонус от</Label>
                                                                        <Select value={String((bonus as any).reward_base || 'BASE')} onValueChange={value => updateBonus(index, 'reward_base', value as any)}>
                                                                            <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-white font-bold">
                                                                                <SelectValue placeholder="Выберите базу" />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                <SelectItem value="BASE">База смены</SelectItem>
                                                                                <SelectItem value="METRIC">Выручка (как в плане)</SelectItem>
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </div>

                                                                    <div className="space-y-3 p-4 bg-slate-50/50 rounded-2xl border border-slate-200">
                                                                        <Label className="text-[10px] font-black uppercase text-slate-700">Планы по дням недели и сменам</Label>
                                                                        <div className="grid sm:grid-cols-2 gap-4">
                                                                            <div className="space-y-2">
                                                                                <Label className="text-[10px] font-black uppercase text-muted-foreground">Пн (день)</Label>
                                                                                <NumericInput value={Number(bonus.plan_by_day_of_week?.MON?.DAY ?? bonus.plan_per_shift ?? 0)} onValueChange={(v) => updateBonus(index, 'plan_by_day_of_week', { ...(bonus.plan_by_day_of_week || {}), MON: { ...(bonus.plan_by_day_of_week?.MON || {}), DAY: v } })} className="h-11 rounded-xl border-slate-200 bg-white font-bold" />
                                                                            </div>
                                                                            <div className="space-y-2">
                                                                                <Label className="text-[10px] font-black uppercase text-muted-foreground">Пн (ночь)</Label>
                                                                                <NumericInput value={Number(bonus.plan_by_day_of_week?.MON?.NIGHT ?? bonus.plan_per_shift ?? 0)} onValueChange={(v) => updateBonus(index, 'plan_by_day_of_week', { ...(bonus.plan_by_day_of_week || {}), MON: { ...(bonus.plan_by_day_of_week?.MON || {}), NIGHT: v } })} className="h-11 rounded-xl border-slate-200 bg-white font-bold" />
                                                                            </div>
                                                                            <div className="space-y-2">
                                                                                <Label className="text-[10px] font-black uppercase text-muted-foreground">Вт (день)</Label>
                                                                                <NumericInput value={Number(bonus.plan_by_day_of_week?.TUE?.DAY ?? bonus.plan_per_shift ?? 0)} onValueChange={(v) => updateBonus(index, 'plan_by_day_of_week', { ...(bonus.plan_by_day_of_week || {}), TUE: { ...(bonus.plan_by_day_of_week?.TUE || {}), DAY: v } })} className="h-11 rounded-xl border-slate-200 bg-white font-bold" />
                                                                            </div>
                                                                            <div className="space-y-2">
                                                                                <Label className="text-[10px] font-black uppercase text-muted-foreground">Вт (ночь)</Label>
                                                                                <NumericInput value={Number(bonus.plan_by_day_of_week?.TUE?.NIGHT ?? bonus.plan_per_shift ?? 0)} onValueChange={(v) => updateBonus(index, 'plan_by_day_of_week', { ...(bonus.plan_by_day_of_week || {}), TUE: { ...(bonus.plan_by_day_of_week?.TUE || {}), NIGHT: v } })} className="h-11 rounded-xl border-slate-200 bg-white font-bold" />
                                                                            </div>
                                                                            <div className="space-y-2">
                                                                                <Label className="text-[10px] font-black uppercase text-muted-foreground">Ср (день)</Label>
                                                                                <NumericInput value={Number(bonus.plan_by_day_of_week?.WED?.DAY ?? bonus.plan_per_shift ?? 0)} onValueChange={(v) => updateBonus(index, 'plan_by_day_of_week', { ...(bonus.plan_by_day_of_week || {}), WED: { ...(bonus.plan_by_day_of_week?.WED || {}), DAY: v } })} className="h-11 rounded-xl border-slate-200 bg-white font-bold" />
                                                                            </div>
                                                                            <div className="space-y-2">
                                                                                <Label className="text-[10px] font-black uppercase text-muted-foreground">Ср (ночь)</Label>
                                                                                <NumericInput value={Number(bonus.plan_by_day_of_week?.WED?.NIGHT ?? bonus.plan_per_shift ?? 0)} onValueChange={(v) => updateBonus(index, 'plan_by_day_of_week', { ...(bonus.plan_by_day_of_week || {}), WED: { ...(bonus.plan_by_day_of_week?.WED || {}), NIGHT: v } })} className="h-11 rounded-xl border-slate-200 bg-white font-bold" />
                                                                            </div>
                                                                        </div>

                                                                        <div className="grid sm:grid-cols-2 gap-4">
                                                                            <div className="space-y-2">
                                                                                <Label className="text-[10px] font-black uppercase text-muted-foreground">Чт (день)</Label>
                                                                                <NumericInput value={Number(bonus.plan_by_day_of_week?.THU?.DAY ?? bonus.plan_per_shift ?? 0)} onValueChange={(v) => updateBonus(index, 'plan_by_day_of_week', { ...(bonus.plan_by_day_of_week || {}), THU: { ...(bonus.plan_by_day_of_week?.THU || {}), DAY: v } })} className="h-11 rounded-xl border-slate-200 bg-white font-bold" />
                                                                            </div>
                                                                            <div className="space-y-2">
                                                                                <Label className="text-[10px] font-black uppercase text-muted-foreground">Чт (ночь)</Label>
                                                                                <NumericInput value={Number(bonus.plan_by_day_of_week?.THU?.NIGHT ?? bonus.plan_per_shift ?? 0)} onValueChange={(v) => updateBonus(index, 'plan_by_day_of_week', { ...(bonus.plan_by_day_of_week || {}), THU: { ...(bonus.plan_by_day_of_week?.THU || {}), NIGHT: v } })} className="h-11 rounded-xl border-slate-200 bg-white font-bold" />
                                                                            </div>
                                                                            <div className="space-y-2">
                                                                                <Label className="text-[10px] font-black uppercase text-muted-foreground">Пт (день)</Label>
                                                                                <NumericInput value={Number(bonus.plan_by_day_of_week?.FRI?.DAY ?? bonus.plan_per_shift ?? 0)} onValueChange={(v) => updateBonus(index, 'plan_by_day_of_week', { ...(bonus.plan_by_day_of_week || {}), FRI: { ...(bonus.plan_by_day_of_week?.FRI || {}), DAY: v } })} className="h-11 rounded-xl border-slate-200 bg-white font-bold" />
                                                                            </div>
                                                                            <div className="space-y-2">
                                                                                <Label className="text-[10px] font-black uppercase text-muted-foreground">Пт (ночь)</Label>
                                                                                <NumericInput value={Number(bonus.plan_by_day_of_week?.FRI?.NIGHT ?? bonus.plan_per_shift ?? 0)} onValueChange={(v) => updateBonus(index, 'plan_by_day_of_week', { ...(bonus.plan_by_day_of_week || {}), FRI: { ...(bonus.plan_by_day_of_week?.FRI || {}), NIGHT: v } })} className="h-11 rounded-xl border-slate-200 bg-white font-bold" />
                                                                            </div>
                                                                            <div className="space-y-2">
                                                                                <Label className="text-[10px] font-black uppercase text-muted-foreground">Сб (день)</Label>
                                                                                <NumericInput value={Number(bonus.plan_by_day_of_week?.SAT?.DAY ?? bonus.plan_per_shift ?? 0)} onValueChange={(v) => updateBonus(index, 'plan_by_day_of_week', { ...(bonus.plan_by_day_of_week || {}), SAT: { ...(bonus.plan_by_day_of_week?.SAT || {}), DAY: v } })} className="h-11 rounded-xl border-slate-200 bg-white font-bold" />
                                                                            </div>
                                                                            <div className="space-y-2">
                                                                                <Label className="text-[10px] font-black uppercase text-muted-foreground">Сб (ночь)</Label>
                                                                                <NumericInput value={Number(bonus.plan_by_day_of_week?.SAT?.NIGHT ?? bonus.plan_per_shift ?? 0)} onValueChange={(v) => updateBonus(index, 'plan_by_day_of_week', { ...(bonus.plan_by_day_of_week || {}), SAT: { ...(bonus.plan_by_day_of_week?.SAT || {}), NIGHT: v } })} className="h-11 rounded-xl border-slate-200 bg-white font-bold" />
                                                                            </div>
                                                                            <div className="space-y-2">
                                                                                <Label className="text-[10px] font-black uppercase text-muted-foreground">Вс (день)</Label>
                                                                                <NumericInput value={Number(bonus.plan_by_day_of_week?.SUN?.DAY ?? bonus.plan_per_shift ?? 0)} onValueChange={(v) => updateBonus(index, 'plan_by_day_of_week', { ...(bonus.plan_by_day_of_week || {}), SUN: { ...(bonus.plan_by_day_of_week?.SUN || {}), DAY: v } })} className="h-11 rounded-xl border-slate-200 bg-white font-bold" />
                                                                            </div>
                                                                            <div className="space-y-2">
                                                                                <Label className="text-[10px] font-black uppercase text-muted-foreground">Вс (ночь)</Label>
                                                                                <NumericInput value={Number(bonus.plan_by_day_of_week?.SUN?.NIGHT ?? bonus.plan_per_shift ?? 0)} onValueChange={(v) => updateBonus(index, 'plan_by_day_of_week', { ...(bonus.plan_by_day_of_week || {}), SUN: { ...(bonus.plan_by_day_of_week?.SUN || {}), NIGHT: v } })} className="h-11 rounded-xl border-slate-200 bg-white font-bold" />
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    <div className="space-y-2">
                                                                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Метрика</Label>
                                                                        <Select value={bonus.source || 'total_revenue'} onValueChange={value => updateBonus(index, 'source', value)}>
                                                                            <SelectTrigger className="w-full h-11 rounded-xl border-slate-200 bg-white font-medium text-sm">
                                                                                <SelectValue placeholder="Выберите показатель" />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                {metricOptionsForTiers.map(m => (
                                                                                    <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                                                                                ))}
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </div>

                                                                    <div className="space-y-3 p-4 bg-slate-50/50 rounded-2xl border border-slate-200">
                                                                        <div className="flex items-center justify-between gap-3">
                                                                            <Label className="text-[10px] font-black uppercase text-slate-700">Ступени (перевыполнение → % от базы)</Label>
                                                                            <Button
                                                                                type="button"
                                                                                variant="outline"
                                                                                size="sm"
                                                                                className="h-9 rounded-xl border-slate-200"
                                                                                onClick={() => {
                                                                                    const tiers = Array.isArray(bonus.tiers) ? bonus.tiers : []
                                                                                    updateBonus(index, 'tiers', [...tiers, { from_over_percent: 10, bonus_percent: 10 }])
                                                                                }}
                                                                            >
                                                                                <Plus className="mr-2 h-4 w-4" />
                                                                                Добавить
                                                                            </Button>
                                                                        </div>
                                                                        <div className="space-y-2">
                                                                            {(Array.isArray(bonus.tiers) ? bonus.tiers : []).map((t, tIdx) => (
                                                                                <div key={tIdx} className="flex items-center gap-2">
                                                                                    <div className="flex-1 bg-white border border-slate-200 rounded-xl p-2">
                                                                                        <div className="grid grid-cols-2 gap-2">
                                                                                            <div className="relative">
                                                                                                <NumericInput value={Number(t.from_over_percent || 0)} onValueChange={(v) => {
                                                                                                    const next = [...(bonus.tiers || [])]
                                                                                                    next[tIdx] = { ...t, from_over_percent: v }
                                                                                                    next.sort((a, b) => (Number(a.from_over_percent) || 0) - (Number(b.from_over_percent) || 0))
                                                                                                    updateBonus(index, 'tiers', next)
                                                                                                }} className="h-10 rounded-lg text-center font-bold" />
                                                                                                <span className="absolute left-2 -top-2 bg-white px-1 text-[8px] font-black text-muted-foreground uppercase rounded">Перевыполн. от %</span>
                                                                                            </div>
                                                                                            <div className="relative">
                                                                                                <NumericInput value={Number(t.bonus_percent || 0)} onValueChange={(v) => {
                                                                                                    const next = [...(bonus.tiers || [])]
                                                                                                    next[tIdx] = { ...t, bonus_percent: v }
                                                                                                    updateBonus(index, 'tiers', next)
                                                                                                }} className="h-10 rounded-lg text-center font-bold" />
                                                                                                <span className="absolute left-2 -top-2 bg-white px-1 text-[8px] font-black text-muted-foreground uppercase rounded">Бонус %</span>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                    <Button
                                                                                        type="button"
                                                                                        variant="outline"
                                                                                        size="icon"
                                                                                        className="h-10 w-10 rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                                                                                        onClick={() => {
                                                                                            const next = (bonus.tiers || []).filter((_, i) => i !== tIdx)
                                                                                            updateBonus(index, 'tiers', next)
                                                                                        }}
                                                                                    >
                                                                                        <Trash2 className="h-4 w-4" />
                                                                                    </Button>
                                                                                </div>
                                                                            ))}
                                                                            {(!bonus.tiers || bonus.tiers.length === 0) && (
                                                                                <div className="text-xs text-muted-foreground italic">Добавьте ступени, чтобы бонус зависел от перевыполнения.</div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {bonus.type === 'leaderboard_rank' && (
                                                                <div className="space-y-4">
                                                                    <div className="grid grid-cols-3 gap-4">
                                                                        <div className="relative">
                                                                            <NumericInput value={Number(bonus.rank_from ?? 1)} onValueChange={(v) => updateBonus(index, 'rank_from', Math.max(1, Math.trunc(v)))} emptyValue={1} className="h-12 rounded-xl text-center font-black border-amber-200 bg-amber-50" />
                                                                            <span className="absolute left-3 -top-2 bg-white px-1 text-[8px] font-black text-muted-foreground uppercase rounded">С места</span>
                                                                        </div>
                                                                        <div className="relative">
                                                                            <NumericInput value={Number(bonus.rank_to ?? bonus.rank_from ?? 1)} onValueChange={(v) => updateBonus(index, 'rank_to', Math.max(1, Math.trunc(v)))} emptyValue={1} className="h-12 rounded-xl text-center font-black border-amber-200 bg-amber-50" />
                                                                            <span className="absolute left-3 -top-2 bg-white px-1 text-[8px] font-black text-muted-foreground uppercase rounded">По место</span>
                                                                        </div>
                                                                        <div className="relative">
                                                                            <NumericInput value={Number(bonus.amount ?? 0)} onValueChange={(v) => updateBonus(index, 'amount', v)} className="h-12 rounded-xl text-center font-black border-amber-200 bg-white" />
                                                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-amber-500">₽</span>
                                                                            <span className="absolute left-3 -top-2 bg-white px-1 text-[8px] font-black text-muted-foreground uppercase rounded">Награда</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4 text-[11px] font-medium text-amber-800">
                                                                        Сотрудник получит бонус, если его место в рейтинге месяца попадет в выбранный диапазон.
                                                                    </div>
                                                                </div>
                                                            )}
                                                            




                                                            {bonus.type === 'progressive_percent' && (
                                                                <div className="space-y-4">
                                                                    <div className="grid grid-cols-2 gap-4">
                                                                        <div className="space-y-2">
                                                                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Период расчета</Label>
                                                                            <div className="flex p-1 bg-muted/30 rounded-xl">
                                                                                <button 
                                                                                    type="button" 
                                                                                    className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${!bonus.mode || bonus.mode === 'SHIFT' ? 'bg-white shadow-sm text-emerald-600' : 'text-muted-foreground hover:bg-white/50'}`}
                                                                                    onClick={() => toggleBonusPeriod(index, 'daily')}
                                                                                >
                                                                                    За смену
                                                                                </button>
                                                                                <button 
                                                                                    type="button" 
                                                                                    className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${bonus.mode === 'MONTH' ? 'bg-white shadow-sm text-emerald-600' : 'text-muted-foreground hover:bg-white/50'}`}
                                                                                    onClick={() => toggleBonusPeriod(index, 'monthly')}
                                                                                >
                                                                                    За месяц
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                        <div className="space-y-2">
                                                                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Тип награды</Label>
                                                                            <div className="flex p-1 bg-muted/30 rounded-xl">
                                                                                <button 
                                                                                    type="button" 
                                                                                    className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${(!bonus.reward_type || bonus.reward_type === 'PERCENT') ? 'bg-white shadow-sm text-emerald-600' : 'text-muted-foreground hover:bg-white/50'}`}
                                                                                    onClick={() => updateBonus(index, 'reward_type', 'PERCENT')}
                                                                                >
                                                                                    % Процент
                                                                                </button>
                                                                                <button 
                                                                                    type="button" 
                                                                                    className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${bonus.reward_type === 'FIXED' ? 'bg-white shadow-sm text-purple-600' : 'text-muted-foreground hover:bg-white/50'}`}
                                                                                    onClick={() => updateBonus(index, 'reward_type', 'FIXED')}
                                                                                >
                                                                                    ₽ Фикс
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-3 mb-2">
                                                                        <span className="text-xs font-bold text-muted-foreground uppercase">Что отслеживаем?</span>
                                                                        <Select value={bonus.source || 'total'} onValueChange={value => updateBonus(index, 'source', value)}>
                                                                            <SelectTrigger className="h-10 px-3 rounded-xl border border-muted-foreground/10 bg-white font-bold text-xs outline-none focus:ring-0 focus:border-emerald-500">
                                                                                <SelectValue placeholder="Выберите показатель" />
                                                                            </SelectTrigger>
                                                                            <SelectContent>{reportMetrics.map(m => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}</SelectContent>
                                                                        </Select>
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <Label className="text-[10px] font-black uppercase text-emerald-600">Настройка порогов</Label>
                                                                        {bonus.thresholds?.map((thresh, tIdx) => (
                                                                            <div key={tIdx} className="flex items-center gap-2 animate-in slide-in-from-left-2 duration-300">
                                                                                <div className="flex-1 bg-muted/20 p-2 rounded-xl">
                                                                                    <div className="relative">
                                                                                        <NumericInput value={Number(thresh.from || 0)} onValueChange={(v) => { const newT = [...bonus.thresholds!]; newT[tIdx] = { ...thresh, from: v }; updateBonus(index, 'thresholds', newT); }} className="h-9 rounded-lg border-none text-xs font-bold" />
                                                                                        <span className="absolute left-2 -top-2 bg-white px-1 text-[8px] font-black text-muted-foreground uppercase rounded">{bonus.mode === 'MONTH' ? 'От ₽ за месяц' : 'Порог (от ₽)'}</span>
                                                                                    </div>
                                                                                </div>
                                                                                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-30" />
                                                                                <div className="relative w-24">
                                                                                    {(!bonus.reward_type || bonus.reward_type === 'PERCENT') ? (
                                                                                        <>
                                                                                            <NumericInput value={Number(thresh.percent || 0)} onValueChange={(v) => { const newT = [...bonus.thresholds!]; newT[tIdx] = { ...thresh, percent: v }; updateBonus(index, 'thresholds', newT); }} className="h-9 rounded-xl border-emerald-200 bg-emerald-50 text-emerald-700 font-black text-xs text-center" />
                                                                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-emerald-400">%</span>
                                                                                        </>
                                                                                    ) : (
                                                                                        <>
                                                                                            <NumericInput value={Number(thresh.amount || 0)} onValueChange={(v) => { const newT = [...bonus.thresholds!]; newT[tIdx] = { ...thresh, amount: v }; updateBonus(index, 'thresholds', newT); }} className="h-9 rounded-xl border-purple-200 bg-purple-50 text-purple-700 font-black text-xs text-center" />
                                                                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-purple-400">₽</span>
                                                                                        </>
                                                                                    )}
                                                                                </div>
                                                                                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-red-50 text-red-400" onClick={() => {
                                                                                    updateBonus(index, 'thresholds', bonus.thresholds?.filter((_, i) => i !== tIdx));
                                                                                }}><Trash2 className="h-3 w-3" /></Button>
                                                                            </div>
                                                                        ))}
                                                                        <Button type="button" variant="ghost" size="sm" className="w-full h-10 border-dashed border-emerald-200 text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:bg-emerald-50" onClick={() => {
                                                                            updateBonus(index, 'thresholds', [...(bonus.thresholds || []), { from: 0, percent: 5, amount: 500 }]);
                                                                        }}>+ Добавить порог</Button>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {bonus.type === 'checklist' && (
                                                                <div className="space-y-4">
                                                                    <div className="grid grid-cols-2 gap-4">
                                                                        <div className="space-y-2">
                                                                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Шаблон</Label>
                                                                            <Select value={bonus.checklist_template_id?.toString() || ""} onValueChange={value => updateBonus(index, 'checklist_template_id', value ? parseInt(value) : null)}>
                                                                                <SelectTrigger className="w-full h-10 px-3 rounded-xl border border-muted-foreground/10 bg-white font-bold text-xs outline-none focus:ring-0 focus:border-purple-500"><SelectValue placeholder="Все чек-листы" /></SelectTrigger>
                                                                                <SelectContent><SelectItem value="none">Все чек-листы</SelectItem>{checklistTemplates.map(t => <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>)}</SelectContent>
                                                                            </Select>
                                                                        </div>
                                                                        <div className="space-y-2">
                                                                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Период</Label>
                                                                            <div className="flex p-1 bg-muted/30 rounded-xl"><button type="button" className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase ${bonus.mode === 'SHIFT' ? 'bg-white shadow-sm' : 'text-muted-foreground'}`} onClick={() => updateBonus(index, 'mode', 'SHIFT')}>Смена</button><button type="button" className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase ${bonus.mode === 'MONTH' ? 'bg-white shadow-sm' : 'text-muted-foreground'}`} onClick={() => updateBonus(index, 'mode', 'MONTH')}>Месяц</button></div>
                                                                        </div>
                                                                    </div>

                                                                    <div className="space-y-3 p-4 bg-purple-50/50 rounded-2xl border border-purple-100/50">
                                                                        <Label className="text-[10px] font-black uppercase text-purple-600">Настройка порогов</Label>
                                                                        <div className="space-y-2">
                                                                            {(bonus.checklist_thresholds || [{ min_score: 90, amount: 500 }]).map((thresh, thIdx) => (
                                                                                <div key={thIdx} className="flex items-center gap-2 animate-in slide-in-from-left-2 duration-300">
                                                                                    <div className="flex-1 bg-muted/20 p-2 rounded-xl">
                                                                                        <div className="relative">
                                                                                            <NumericInput value={Number(thresh.min_score || 0)} onValueChange={(v) => { const newT = [...(bonus.checklist_thresholds || [])]; newT[thIdx] = { ...thresh, min_score: v }; updateBonus(index, 'checklist_thresholds', newT); }} className="h-9 rounded-lg border-none text-xs font-bold" />
                                                                                            <span className="absolute left-2 -top-2 bg-white px-1 text-[8px] font-black text-muted-foreground uppercase rounded">Оценка выше %</span>
                                                                                        </div>
                                                                                    </div>
                                                                                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-30" />
                                                                                    <div className="relative w-24">
                                                                                        <NumericInput value={Number(thresh.amount || 0)} onValueChange={(v) => { const newT = [...(bonus.checklist_thresholds || [])]; newT[thIdx] = { ...thresh, amount: v }; updateBonus(index, 'checklist_thresholds', newT); }} className="h-9 rounded-xl border-purple-200 bg-white font-black text-xs text-center" />
                                                                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-purple-400">₽</span>
                                                                                    </div>
                                                                                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-400" onClick={() => { const newT = (bonus.checklist_thresholds || []).filter((_, i) => i !== thIdx); updateBonus(index, 'checklist_thresholds', newT); }}><Trash2 className="h-3 w-3" /></Button>
                                                                                </div>
                                                                            ))}
                                                                            <Button type="button" variant="ghost" size="sm" className="w-full h-10 border-dashed border-purple-200 text-[10px] font-black uppercase tracking-widest text-purple-600 hover:bg-purple-100/50" onClick={() => updateBonus(index, 'checklist_thresholds', [...(bonus.checklist_thresholds || []), { min_score: 90, amount: 300 }])}>+ Добавить порог</Button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}

                                                        {/* Maintenance KPI Settings */}
                                                        {bonus.type === 'maintenance_kpi' && (
                                                            <div className="space-y-4">
                                                                <div className="space-y-2">
                                                                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Режим оплаты</Label>
                                                                    <div className="flex p-1 bg-muted/30 rounded-xl w-fit">
                                                                        <button 
                                                                            type="button" 
                                                                            className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${bonus.calculation_mode === 'PER_TASK' ? 'bg-white shadow-sm text-indigo-600' : 'text-muted-foreground hover:bg-white/50'}`} 
                                                                            onClick={() => updateBonus(index, 'calculation_mode', 'PER_TASK')}
                                                                        >
                                                                            За задачу
                                                                        </button>
                                                                        <button 
                                                                            type="button" 
                                                                            className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${bonus.calculation_mode === 'MONTHLY' ? 'bg-white shadow-sm text-indigo-600' : 'text-muted-foreground hover:bg-white/50'}`} 
                                                                            onClick={() => updateBonus(index, 'calculation_mode', 'MONTHLY')}
                                                                        >
                                                                            Бонус за месяц
                                                                        </button>
                                                                    </div>
                                                                </div>

                                                                {bonus.calculation_mode === 'PER_TASK' ? (
                                                                    <div className="space-y-3 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/50 animate-in slide-in-from-top-2 duration-300">
                                                                        <Label className="text-[10px] font-black uppercase text-indigo-600">Настройка оплаты</Label>
                                                                        <div className="flex items-center gap-3">
                                                                            <span className="text-xs font-bold">Выплачивать</span>
                                                                            <div className="relative w-32">
                                                                                <NumericInput value={Number(bonus.amount ?? 0)} onValueChange={(v) => updateBonus(index, 'amount', v)} className="h-10 rounded-xl pl-4 pr-10 font-black text-indigo-700 border-indigo-200 bg-white" />
                                                                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black text-indigo-400">₽</span>
                                                                            </div>
                                                                            <span className="text-xs font-bold">за каждую задачу</span>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                                                                        <div className="space-y-3">
                                                                            <Label className="text-[10px] font-black uppercase text-indigo-600">Настройка порогов</Label>
                                                                            <div className="space-y-2">
                                                                                {bonus.efficiency_thresholds?.map((thresh, thIdx) => (
                                                                                    <div key={thIdx} className="flex items-center gap-2 animate-in slide-in-from-left-2 duration-300">
                                                                                        <div className="flex-1 bg-muted/20 p-2 rounded-xl">
                                                                                            <div className="relative">
                                                                                                <NumericInput value={Number(thresh.from_percent || 0)} onValueChange={(v) => {
                                                                                                    const newT = [...bonus.efficiency_thresholds!]
                                                                                                    newT[thIdx] = { ...thresh, from_percent: v }
                                                                                                    updateBonus(index, 'efficiency_thresholds', newT)
                                                                                                }} className="h-9 rounded-lg border-none text-xs font-bold" />
                                                                                                <span className="absolute left-2 -top-2 bg-white px-1 text-[8px] font-black text-muted-foreground uppercase rounded">Выполнено {'>'} %</span>
                                                                                            </div>
                                                                                        </div>
                                                                                        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-30" />
                                                                                        <div className="relative w-28">
                                                                                            <NumericInput value={Number(thresh.amount || 0)} onValueChange={(v) => {
                                                                                                const newT = [...bonus.efficiency_thresholds!]
                                                                                                newT[thIdx] = { ...thresh, amount: v }
                                                                                                updateBonus(index, 'efficiency_thresholds', newT)
                                                                                            }} className="h-9 rounded-xl border-indigo-200 bg-indigo-50 text-indigo-700 font-black text-xs text-center" />
                                                                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-indigo-400">₽</span>
                                                                                        </div>
                                                                                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-400" onClick={() => updateBonus(index, 'efficiency_thresholds', bonus.efficiency_thresholds?.filter((_, i) => i !== thIdx))}><Trash2 className="h-3 w-3" /></Button>
                                                                                    </div>
                                                                                ))}
                                                                                <Button type="button" variant="ghost" size="sm" className="w-full h-10 border-dashed border-indigo-200 text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:bg-indigo-50" onClick={() => updateBonus(index, 'efficiency_thresholds', [...(bonus.efficiency_thresholds || []), { from_percent: 0, amount: 1000 }])}>+ Добавить уровень премии</Button>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50/50 p-4">
                                                                    <div className="text-[10px] font-black uppercase tracking-widest text-rose-600 mb-3">Штраф за просрочку обслуживания</div>
                                                                    <div className="grid gap-3 md:grid-cols-3">
                                                                        <div className="relative">
                                                                            <NumericInput value={Number(bonus.overdue_tolerance_days ?? 0)} onValueChange={(v) => updateBonus(index, 'overdue_tolerance_days', Math.max(0, Math.trunc(v)))} className="h-10 rounded-xl" />
                                                                            <span className="absolute left-3 -top-2 bg-white px-1 text-[8px] font-black uppercase text-muted-foreground rounded">Льготные дни</span>
                                                                        </div>

                                                                        <div className="relative">
                                                                            <Select
                                                                                value={bonus.overdue_penalty_mode || 'NONE'}
                                                                                onValueChange={value => updateBonus(index, 'overdue_penalty_mode', value)}
                                                                            >
                                                                                <SelectTrigger className="h-10 rounded-xl">
                                                                                    <SelectValue />
                                                                                </SelectTrigger>
                                                                                <SelectContent>
                                                                                    <SelectItem value="NONE">Без штрафа</SelectItem>
                                                                                    <SelectItem value="FIXED_PER_TASK">Фикс за задачу</SelectItem>
                                                                                    <SelectItem value="FIXED_PER_DAY">Фикс за день</SelectItem>
                                                                                    <SelectItem value="PERCENT_OF_REWARD">% от награды</SelectItem>
                                                                                </SelectContent>
                                                                            </Select>
                                                                            <span className="absolute left-3 -top-2 bg-white px-1 text-[8px] font-black uppercase text-muted-foreground rounded">Тип штрафа</span>
                                                                        </div>

                                                                        <div className="relative">
                                                                            <NumericInput value={Number(bonus.overdue_penalty_amount ?? 0)} onValueChange={(v) => updateBonus(index, 'overdue_penalty_amount', v)} className="h-10 rounded-xl" />
                                                                            <span className="absolute left-3 -top-2 bg-white px-1 text-[8px] font-black uppercase text-muted-foreground rounded">Размер штрафа</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                            
                                                        </div>
                                                        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 h-fit opacity-0 pointer-events-none"></div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="example" className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="p-6 md:p-8 space-y-8">
                            <div className="flex items-center justify-between gap-4 flex-wrap">
                                <div className="space-y-1">
                                    <h2 className="text-xl font-semibold">Пример расчёта</h2>
                                    <p className="text-sm text-muted-foreground">Введите цифры и посмотрите детальный разбор: база, бонусы, удержания, выплаты</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="flex p-1 bg-slate-100/50 rounded-xl h-11 items-center">
                                        <button
                                            type="button"
                                            onClick={() => setExamplePreviewMode('shift')}
                                            className={`px-4 h-9 rounded-lg text-sm font-medium transition-all ${examplePreviewMode === 'shift' ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                        >
                                            Смена
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setExamplePreviewMode('month')}
                                            className={`px-4 h-9 rounded-lg text-sm font-medium transition-all ${examplePreviewMode === 'month' ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                        >
                                            Месяц
                                        </button>
                                    </div>
                                    <Button onClick={() => examplePreviewMode === 'month' ? handleCalculateMonthPreview() : handleCalculatePreview()} disabled={isPreviewLoading} className="h-11 rounded-xl px-6 gap-2 bg-slate-900 text-white hover:bg-slate-800">
                                        {isPreviewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
                                        Рассчитать
                                    </Button>
                                </div>
                            </div>

                            <div className="grid lg:grid-cols-2 gap-6">
                                <Card className="rounded-3xl border-slate-200 shadow-sm">
                                    <CardHeader>
                                        <CardTitle className="text-base">Исходные данные</CardTitle>
                                        <CardDescription>Это не сохраняется — только для проверки логики</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        <div className="grid sm:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-sm font-medium">Часы в смене</Label>
                                                <NumericInput value={Number(exampleHours || 0)} onValueChange={setExampleHours} className="h-11 rounded-xl" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-sm font-medium">Бар (в счёт зарплаты)</Label>
                                                <NumericInput value={Number(exampleBarPurchases || 0)} onValueChange={setExampleBarPurchases} className="h-11 rounded-xl" />
                                            </div>
                                        </div>

                                        {hasPersonalOverplan && (
                                            <div className="grid sm:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label className="text-sm font-medium">Тип смены</Label>
                                                    <Select value={exampleShiftType} onValueChange={(v: any) => setExampleShiftType(v)}>
                                                        <SelectTrigger className="h-11 rounded-xl bg-white border-slate-200">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="DAY">День</SelectItem>
                                                            <SelectItem value="NIGHT">Ночь</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-sm font-medium">День недели</Label>
                                                    <Select value={exampleDayOfWeek} onValueChange={(v: any) => setExampleDayOfWeek(v)}>
                                                        <SelectTrigger className="h-11 rounded-xl bg-white border-slate-200">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="MON">Пн</SelectItem>
                                                            <SelectItem value="TUE">Вт</SelectItem>
                                                            <SelectItem value="WED">Ср</SelectItem>
                                                            <SelectItem value="THU">Чт</SelectItem>
                                                            <SelectItem value="FRI">Пт</SelectItem>
                                                            <SelectItem value="SAT">Сб</SelectItem>
                                                            <SelectItem value="SUN">Вс</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                        )}

                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-sm font-medium">Выручка смены</Label>
                                                {needsCashCardSplit && (
                                                    <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
                                                        Итого: {Number(exampleRevenueCash || 0) + Number(exampleRevenueCard || 0)} ₽
                                                    </Badge>
                                                )}
                                            </div>
                                            {needsCashCardSplit ? (
                                                <div className="grid sm:grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label className="text-sm font-medium">Наличные</Label>
                                                        <NumericInput value={Number(exampleRevenueCash || 0)} onValueChange={setExampleRevenueCash} className="h-11 rounded-xl" />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-sm font-medium">Безнал</Label>
                                                        <NumericInput value={Number(exampleRevenueCard || 0)} onValueChange={setExampleRevenueCard} className="h-11 rounded-xl" />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    <NumericInput value={Number(exampleShiftRevenue || 0)} onValueChange={setExampleShiftRevenue} className="h-11 rounded-xl" />
                                                </div>
                                            )}

                                            {formula.base.type === 'hourly' && (
                                                <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-1">
                                                    <div className="flex items-center justify-between">
                                                        <div className="text-sm font-medium">Эффективная ставка (₽/ч)</div>
                                                        <div className="text-sm font-bold">{effectiveHourlyRateForExample ?? 0}</div>
                                                    </div>
                                                    {baseTierExplanation && (
                                                        <div className="text-[11px] text-muted-foreground truncate">{baseTierExplanation}</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {(examplePreviewMode === 'month' || monthlyBonuses.length > 0) && (
                                            <div className="space-y-4 pt-4 border-t border-slate-100">
                                                <div className="flex items-center justify-between gap-3 flex-wrap">
                                                    <div>
                                                        <p className="text-sm font-medium">Контекст месяца</p>
                                                        <p className="text-xs text-muted-foreground">{examplePreviewMode === 'month' ? 'Используется для расчёта зарплаты за месяц и KPI “за месяц”' : 'Нужен для KPI “за месяц” (ступени масштабируются по отработанным сменам)'}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
                                                            Норма: {standardMonthlyShifts} смен
                                                        </Badge>
                                                        {examplePreviewMode === 'month' && (
                                                            <Button type="button" variant="outline" className="h-11 rounded-xl px-4 border-slate-200" onClick={addMonthSpecialShift}>
                                                                <Plus className="mr-2 h-4 w-4" />
                                                                Особая смена
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="grid sm:grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label className="text-sm font-medium">{examplePreviewMode === 'month' ? 'Смен в месяце (всего)' : 'Смен отработано за месяц'}</Label>
                                                        <NumericInput value={Number(exampleMonthShiftsWorked || 0)} onValueChange={setExampleMonthShiftsWorked} className="h-11 rounded-xl" />
                                                    </div>
                                                    {examplePreviewMode === 'month' ? (
                                                        <div className="space-y-2">
                                                            <Label className="text-sm font-medium">Смен по шаблону</Label>
                                                            <Input type="number" value={Math.max(0, Number(exampleMonthShiftsWorked || 0) - monthSpecialShifts.length)} disabled className="h-11 rounded-xl" />
                                                        </div>
                                                    ) : (
                                                        monthlyBonuses.some(b => b.type === 'leaderboard_rank') && (
                                                            <div className="space-y-2">
                                                                <Label className="text-sm font-medium">Рейтинг сотрудника (место)</Label>
                                                                <NumericInput value={Number(exampleMonthRank || 0)} onValueChange={setExampleMonthRank} className="h-11 rounded-xl" />
                                                            </div>
                                                        )
                                                    )}
                                                </div>

                                                {examplePreviewMode === 'month' && monthlyBonuses.some(b => b.type === 'leaderboard_rank') && (
                                                    <div className="space-y-2">
                                                        <Label className="text-sm font-medium">Рейтинг сотрудника (место)</Label>
                                                        <NumericInput value={Number(exampleMonthRank || 0)} onValueChange={setExampleMonthRank} className="h-11 rounded-xl" />
                                                    </div>
                                                )}

                                                {examplePreviewMode === 'month' && monthSpecialShifts.length > 0 && (
                                                    <div className="space-y-3">
                                                        <Label className="text-sm font-medium">Особые смены</Label>
                                                        <div className="space-y-3">
                                                            {monthSpecialShifts.map((s, idx) => (
                                                                <div key={s.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                                                                    <div className="flex items-center justify-between gap-3">
                                                                        <div className="text-sm font-medium">Особая смена #{idx + 1}</div>
                                                                        <Button type="button" variant="outline" size="icon" className="h-10 w-10 rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => removeMonthSpecialShift(s.id)}>
                                                                            <Trash2 className="h-4 w-4" />
                                                                        </Button>
                                                                    </div>
                                                                    {hasPersonalOverplan && (
                                                                        <div className="grid sm:grid-cols-2 gap-4 mt-4">
                                                                            <div className="space-y-2">
                                                                                <Label className="text-sm font-medium">Тип смены</Label>
                                                                                <Select value={s.shift_type} onValueChange={(v: any) => updateMonthSpecialShift(s.id, { shift_type: v })}>
                                                                                    <SelectTrigger className="h-11 rounded-xl bg-white border-slate-200">
                                                                                        <SelectValue />
                                                                                    </SelectTrigger>
                                                                                    <SelectContent>
                                                                                        <SelectItem value="DAY">День</SelectItem>
                                                                                        <SelectItem value="NIGHT">Ночь</SelectItem>
                                                                                    </SelectContent>
                                                                                </Select>
                                                                            </div>
                                                                            <div className="space-y-2">
                                                                                <Label className="text-sm font-medium">День недели</Label>
                                                                                <Select value={s.day_of_week} onValueChange={(v: any) => updateMonthSpecialShift(s.id, { day_of_week: v })}>
                                                                                    <SelectTrigger className="h-11 rounded-xl bg-white border-slate-200">
                                                                                        <SelectValue />
                                                                                    </SelectTrigger>
                                                                                    <SelectContent>
                                                                                        <SelectItem value="MON">Пн</SelectItem>
                                                                                        <SelectItem value="TUE">Вт</SelectItem>
                                                                                        <SelectItem value="WED">Ср</SelectItem>
                                                                                        <SelectItem value="THU">Чт</SelectItem>
                                                                                        <SelectItem value="FRI">Пт</SelectItem>
                                                                                        <SelectItem value="SAT">Сб</SelectItem>
                                                                                        <SelectItem value="SUN">Вс</SelectItem>
                                                                                    </SelectContent>
                                                                                </Select>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    <div className="grid sm:grid-cols-2 gap-4 mt-4">
                                                                        <div className="space-y-2">
                                                                            <Label className="text-sm font-medium">Часы</Label>
                                                                            <NumericInput value={Number(s.hours || 0)} onValueChange={(v) => updateMonthSpecialShift(s.id, { hours: v })} className="h-11 rounded-xl" />
                                                                        </div>
                                                                        <div className="space-y-2">
                                                                            <Label className="text-sm font-medium">Бар</Label>
                                                                            <NumericInput value={Number(s.bar_purchases || 0)} onValueChange={(v) => updateMonthSpecialShift(s.id, { bar_purchases: v })} className="h-11 rounded-xl" />
                                                                        </div>
                                                                    </div>
                                                                    <div className="mt-4 space-y-3">
                                                                        <div className="flex items-center justify-between">
                                                                            <Label className="text-sm font-medium">Выручка смены</Label>
                                                                            {needsCashCardSplit && (
                                                                                <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
                                                                                    Итого: {Number(s.revenue_cash || 0) + Number(s.revenue_card || 0)} ₽
                                                                                </Badge>
                                                                            )}
                                                                        </div>
                                                                        {needsCashCardSplit ? (
                                                                            <div className="grid sm:grid-cols-2 gap-4">
                                                                                <div className="space-y-2">
                                                                                    <Label className="text-sm font-medium">Наличные</Label>
                                                                                    <NumericInput value={Number(s.revenue_cash ?? 0)} onValueChange={(v) => updateMonthSpecialShift(s.id, { revenue_cash: v })} className="h-11 rounded-xl" />
                                                                                </div>
                                                                                <div className="space-y-2">
                                                                                    <Label className="text-sm font-medium">Безнал</Label>
                                                                                    <NumericInput value={Number(s.revenue_card ?? 0)} onValueChange={(v) => updateMonthSpecialShift(s.id, { revenue_card: v })} className="h-11 rounded-xl" />
                                                                                </div>
                                                                            </div>
                                                                        ) : (
                                                                            <div className="space-y-2">
                                                                                <NumericInput value={Number(s.revenue || 0)} onValueChange={(v) => updateMonthSpecialShift(s.id, { revenue: v })} className="h-11 rounded-xl" />
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    {shiftChecklistTemplateIds.length > 0 && (
                                                                        <div className="mt-4 space-y-3">
                                                                            <Label className="text-sm font-medium">Чек-листы смены (оценка, %)</Label>
                                                                            <div className="grid sm:grid-cols-2 gap-4">
                                                                                {shiftChecklistTemplateIds.map(tid => (
                                                                                    <div key={tid} className="space-y-2">
                                                                                        <Label className="text-sm font-medium">{checklistTemplateLabel(tid)}</Label>
                                                                                        <NumericInput value={Number((s.checklistScores || {})[String(tid)] ?? exampleChecklistScores[String(tid)] ?? 100)} onValueChange={(v) => updateMonthSpecialShiftChecklistScore(s.id, tid, v)} className="h-11 rounded-xl" />
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {(() => {
                                                    const keys = monthlyMetricKeys.filter(k => !['maintenance_raw_sum', 'maintenance_tasks_completed', 'maintenance_tasks_assigned'].includes(k))
                                                    if (keys.length === 0) return null

                                                    return (
                                                        <div className="space-y-3">
                                                            <Label className="text-sm font-medium">Показатели за месяц</Label>
                                                            <div className="grid sm:grid-cols-2 gap-4">
                                                                {keys.map(k => {
                                                                    const label =
                                                                        k === 'total_revenue'
                                                                            ? 'Выручка за месяц'
                                                                            : k === 'revenue_cash'
                                                                                ? 'Выручка за месяц (наличные)'
                                                                                : k === 'revenue_card'
                                                                                    ? 'Выручка за месяц (безнал)'
                                                                                    : reportMetrics.find(m => m.key === k)?.label || k
                                                                    return (
                                                                        <div key={k} className="space-y-2">
                                                                            <Label className="text-sm font-medium">{label}</Label>
                                                                            <NumericInput value={Number(exampleMonthMetricOverrides[k] ?? 0)} onValueChange={(v) => setExampleMonthMetricOverrides(prev => ({ ...prev, [k]: v }))} className="h-11 rounded-xl" />
                                                                        </div>
                                                                    )
                                                                })}
                                                            </div>
                                                        </div>
                                                    )
                                                })()}

                                                {monthlyBonuses.some(b => b.type === 'maintenance_kpi') && (
                                                    <div className="space-y-3">
                                                        <Label className="text-sm font-medium">Обслуживание за месяц</Label>
                                                        <div className="grid sm:grid-cols-2 gap-4">
                                                            <div className="space-y-2">
                                                                <Label className="text-sm font-medium">Сумма по задачам</Label>
                                                                <NumericInput value={Number(exampleMaintenanceRawSum || 0)} onValueChange={setExampleMaintenanceRawSum} className="h-11 rounded-xl" />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label className="text-sm font-medium">Задач выполнено</Label>
                                                                <NumericInput value={Number(exampleMaintenanceTasksCompleted || 0)} onValueChange={setExampleMaintenanceTasksCompleted} className="h-11 rounded-xl" />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label className="text-sm font-medium">Задач назначено</Label>
                                                                <NumericInput value={Number(exampleMaintenanceTasksAssigned || 0)} onValueChange={setExampleMaintenanceTasksAssigned} className="h-11 rounded-xl" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {(() => {
                                                    const templateIds = Array.from(
                                                        new Set(
                                                            monthlyBonuses
                                                                .filter(b => b.type === 'checklist')
                                                                .map(b => Number(b.checklist_template_id))
                                                                .filter(Boolean)
                                                        )
                                                    )
                                                    if (templateIds.length === 0) return null

                                                    return (
                                                        <div className="space-y-3">
                                                            <Label className="text-sm font-medium">Чек-листы за месяц (средняя оценка, %)</Label>
                                                            <div className="grid sm:grid-cols-2 gap-4">
                                                                {templateIds.map(id => (
                                                                    <div key={id} className="space-y-2">
                                                                        <Label className="text-sm font-medium">{checklistTemplateLabel(id)}</Label>
                                                                        <NumericInput value={Number(exampleMonthChecklistScores[String(id)] ?? 100)} onValueChange={(v) => setExampleMonthChecklistScores(prev => ({ ...prev, [String(id)]: v }))} className="h-11 rounded-xl" />
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )
                                                })()}
                                            </div>
                                        )}

                                        {hasMaintenanceKpi && (
                                            <div className="space-y-3">
                                                <Label className="text-sm font-medium">Обслуживание (KPI)</Label>
                                                <div className="grid sm:grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label className="text-sm font-medium">Сумма по задачам</Label>
                                                        <NumericInput value={Number(exampleMaintenanceRawSum || 0)} onValueChange={setExampleMaintenanceRawSum} className="h-11 rounded-xl" />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-sm font-medium">Задач выполнено</Label>
                                                        <NumericInput value={Number(exampleMaintenanceTasksCompleted || 0)} onValueChange={setExampleMaintenanceTasksCompleted} className="h-11 rounded-xl" />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-sm font-medium">Задач назначено</Label>
                                                        <NumericInput value={Number(exampleMaintenanceTasksAssigned || 0)} onValueChange={setExampleMaintenanceTasksAssigned} className="h-11 rounded-xl" />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-sm font-medium">Штраф за просрочку</Label>
                                                        <NumericInput value={Number(exampleMaintenancePenalty || 0)} onValueChange={setExampleMaintenancePenalty} className="h-11 rounded-xl" />
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {(() => {
                                            const excluded = new Set([
                                                'total_revenue',
                                                'revenue_cash',
                                                'revenue_card',
                                                'maintenance_raw_sum',
                                                'maintenance_tasks_completed',
                                                'maintenance_tasks_assigned',
                                                'maintenance_overdue_penalty_applied'
                                            ])
                                            const keys = requiredMetricKeys.filter(k => !excluded.has(k))
                                            if (keys.length === 0) return null

                                            return (
                                                <div className="space-y-3">
                                                    <Label className="text-sm font-medium">Показатели для KPI/бонусов</Label>
                                                    <div className="grid sm:grid-cols-2 gap-4">
                                                        {keys.map(k => {
                                                            const label = reportMetrics.find(m => m.key === k)?.label || k
                                                            return (
                                                                <div key={k} className="space-y-2">
                                                                    <Label className="text-sm font-medium">{label}</Label>
                                                                    <NumericInput value={Number(exampleMetricOverrides[k] ?? 0)} onValueChange={(v) => setExampleMetricOverrides(prev => ({ ...prev, [k]: v }))} className="h-11 rounded-xl" />
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            )
                                        })()}

                                        {(() => {
                                            const templateIds = Array.from(
                                                new Set(
                                                    formula.bonuses
                                                        .filter(b => b.type === 'checklist')
                                                        .map(b => Number(b.checklist_template_id))
                                                        .filter(Boolean)
                                                )
                                            )
                                            if (templateIds.length === 0) return null

                                            return (
                                                <div className="space-y-3">
                                                    <Label className="text-sm font-medium">Чек-листы</Label>
                                                    <div className="grid sm:grid-cols-2 gap-4">
                                                        {templateIds.map(id => (
                                                            <div key={id} className="space-y-2">
                                                                <Label className="text-sm font-medium">{checklistTemplateLabel(id)}</Label>
                                                                <NumericInput value={Number(exampleChecklistScores[String(id)] ?? 100)} onValueChange={(v) => setExampleChecklistScores(prev => ({ ...prev, [String(id)]: v }))} className="h-11 rounded-xl" />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )
                                        })()}
                                    </CardContent>
                                </Card>

                                <Card className="rounded-3xl border-slate-200 shadow-sm">
                                    <CardHeader>
                                        <CardTitle className="text-base">Результат</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        {examplePreviewMode === 'shift' ? (
                                            !previewResult ? (
                                                <div className="text-sm text-muted-foreground">Нажмите “Рассчитать”, чтобы увидеть разбор.</div>
                                            ) : (
                                                <div className="space-y-6">
                                                    <div className="grid sm:grid-cols-2 gap-4">
                                                        <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                                                            <div className="text-xs text-muted-foreground">Итого зарплата</div>
                                                            <div className="text-xl font-bold">{formatRub(Number(previewResult?.breakdown?.total || 0) + Number(personalOverplanAdjustment?.total || 0))} ₽</div>
                                                        </div>
                                                        <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                                                            <div className="text-xs text-muted-foreground">Итого виртуальный баланс</div>
                                                            <div className="text-xl font-bold">{formatRub(Number(previewResult?.breakdown?.virtual_balance_total || 0) + Number(personalOverplanAdjustment?.virtual || 0))} ₽</div>
                                                        </div>
                                                        <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                                                            <div className="text-xs text-muted-foreground">К выдаче в конце смены</div>
                                                            <div className="text-xl font-bold">{formatRub(Number(previewResult?.breakdown?.instant_payout || 0) + Number(personalOverplanAdjustment?.instant || 0))} ₽</div>
                                                        </div>
                                                        <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                                                            <div className="text-xs text-muted-foreground">В накопление (зарплата)</div>
                                                            <div className="text-xl font-bold">{formatRub(Number(previewResult?.breakdown?.accrued_payout || 0) + Number(personalOverplanAdjustment?.accrued || 0))} ₽</div>
                                                        </div>
                                                    </div>

                                                    <div className="rounded-2xl border border-slate-200 p-4">
                                                        <div className="flex items-center justify-between">
                                                            <div className="text-sm font-medium">База</div>
                                                            <div className="text-sm font-bold">{formatRub(previewResult?.breakdown?.base ?? 0)} ₽</div>
                                                        </div>
                                                    </div>

                                                    {Array.isArray(previewResult?.breakdown?.bonuses) && previewResult.breakdown.bonuses.length > 0 && (
                                                        <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
                                                            <div className="text-sm font-medium">KPI и бонусы</div>
                                                            <div className="space-y-2">
                                                                {previewResult.breakdown.bonuses.map((b: any, idx: number) => (
                                                                    <div key={idx} className="flex items-center justify-between gap-3 text-sm">
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="truncate font-medium text-slate-800">{b.name}</div>
                                                                            {(() => {
                                                                                const line = explainBonusLine(b)
                                                                                if (!line) return null
                                                                                return <div className="text-[11px] text-muted-foreground whitespace-normal break-words leading-snug">{line}</div>
                                                                            })()}
                                                                        </div>
                                                                        <div className="font-bold whitespace-nowrap">{formatRub(b.amount)} ₽</div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {Array.isArray(previewResult?.breakdown?.deductions) && previewResult.breakdown.deductions.length > 0 && (
                                                        <div className="rounded-2xl border border-rose-200 bg-rose-50/30 p-4 space-y-3">
                                                            <div className="text-sm font-medium text-rose-700">Удержания</div>
                                                            <div className="space-y-2">
                                                                {previewResult.breakdown.deductions.map((d: any, idx: number) => (
                                                                    <div key={idx} className="flex items-center justify-between text-sm">
                                                                        <div className="text-rose-700 truncate pr-3">{d.name}</div>
                                                                        <div className="font-bold whitespace-nowrap text-rose-700">-{formatRub(d.amount)} ₽</div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {monthlyBonuses.length > 0 && (
                                                        <div className="rounded-2xl border border-slate-200 p-4 space-y-4">
                                                            <div className="flex items-center justify-between gap-3 flex-wrap">
                                                                <div className="text-sm font-medium">KPI и бонусы за месяц</div>
                                                                <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
                                                                    Масштаб: {monthlyKpiPreview.shiftsWorked}/{monthlyKpiPreview.standard} смен (×{monthlyKpiPreview.scale?.toFixed(2)})
                                                                </Badge>
                                                            </div>

                                                            <div className="grid sm:grid-cols-2 gap-4">
                                                                <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                                                                    <div className="text-xs text-muted-foreground">Итого за месяц (деньги)</div>
                                                                <div className="text-lg font-bold">{formatRub(monthlyKpiPreview.totalReal ?? 0)} ₽</div>
                                                                </div>
                                                                <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                                                                    <div className="text-xs text-muted-foreground">Итого за месяц (депозит)</div>
                                                                <div className="text-lg font-bold">{formatRub(monthlyKpiPreview.totalVirtual ?? 0)} ₽</div>
                                                                </div>
                                                            </div>

                                                            <div className="space-y-2">
                                                                {monthlyKpiPreview.items.map((it: any, idx: number) => (
                                                                    <div key={idx} className="flex items-center justify-between gap-3 text-sm">
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className={cn("truncate font-medium", it.isActive ? "text-slate-800" : "text-slate-500")}>{it.name}</div>
                                                                        {it.logic && <div className="text-[11px] text-muted-foreground whitespace-normal break-words leading-snug">{it.logic}</div>}
                                                                        </div>
                                                                        <div className={cn("font-bold whitespace-nowrap", it.isActive ? "text-slate-900" : "text-slate-400")}>
                                                                        {formatRub(it.amount)} ₽
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        ) : (
                                            !monthPreview ? (
                                                <div className="text-sm text-muted-foreground">Нажмите “Рассчитать”, чтобы увидеть зарплату за месяц.</div>
                                            ) : (
                                                <div className="space-y-6">
                                                    <div className="grid sm:grid-cols-2 gap-4">
                                                        <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                                                            <div className="text-xs text-muted-foreground">Итого зарплата за месяц</div>
                                                            <div className="text-xl font-bold">{formatRub(monthPreview?.totals?.real ?? 0)} ₽</div>
                                                        </div>
                                                        <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                                                            <div className="text-xs text-muted-foreground">Итого депозит за месяц</div>
                                                            <div className="text-xl font-bold">{formatRub(monthPreview?.totals?.virtual ?? 0)} ₽</div>
                                                        </div>
                                                        <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                                                            <div className="text-xs text-muted-foreground">Выплачено в течение месяца</div>
                                                            <div className="text-xl font-bold">{formatRub(monthPreview?.totals?.instant ?? 0)} ₽</div>
                                                        </div>
                                                        <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                                                            <div className="text-xs text-muted-foreground">К выплате в конце месяца</div>
                                                            <div className="text-xl font-bold">{formatRub(monthPreview?.totals?.accrued ?? 0)} ₽</div>
                                                        </div>
                                                    </div>

                                                    <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
                                                        <div className="flex items-center justify-between gap-3 flex-wrap">
                                                            <div className="text-sm font-medium">Смены</div>
                                                            <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
                                                                {monthPreview?.templateCount ?? 0} по шаблону + {monthPreview?.specialCount ?? 0} особых = {monthPreview?.totalCount ?? 0}
                                                            </Badge>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <div className="flex items-center justify-between text-sm">
                                                                <div className="text-muted-foreground truncate pr-3">Шаблонные смены</div>
                                                                <div className="font-bold whitespace-nowrap">{formatRub(Number(monthPreview?.typical?.result?.breakdown?.total || 0) * Number(monthPreview?.templateCount || 0))} ₽</div>
                                                            </div>
                                                            {Array.isArray(monthPreview?.special) && monthPreview.special.length > 0 && monthPreview.special.map((s: any, idx: number) => (
                                                                <div key={s.id} className="flex items-center justify-between text-sm">
                                                                    <div className="text-muted-foreground truncate pr-3">Особая смена #{idx + 1}</div>
                                                                    <div className="font-bold whitespace-nowrap">{formatRub(s?.result?.breakdown?.total ?? 0)} ₽</div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-sm">
                                                            <div className="font-medium">Итого по сменам</div>
                                                            <div className="font-bold">{formatRub(monthPreview?.shifts?.real ?? 0)} ₽</div>
                                                        </div>
                                                    </div>

                                                    {monthShiftBreakdown && (
                                                        <>
                                                            <div className="rounded-2xl border border-slate-200 p-4">
                                                                <div className="flex items-center justify-between">
                                                                    <div className="text-sm font-medium">База (по сменам)</div>
                                                                    <div className="text-sm font-bold">{formatRub(monthShiftBreakdown.base)} ₽</div>
                                                                </div>
                                                            </div>

                                                            {monthShiftBreakdown.bonuses.length > 0 && (
                                                                <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
                                                                    <div className="text-sm font-medium">KPI и бонусы (по сменам)</div>
                                                                    <div className="space-y-2">
                                                                        {monthShiftBreakdown.bonuses.map((b: any, idx: number) => (
                                                                            <div key={idx} className="flex items-center justify-between gap-3 text-sm">
                                                                                <div className="flex-1 min-w-0">
                                                                                    <div className="truncate font-medium text-slate-800">{b.name}</div>
                                                                                    {(() => {
                                                                                        const line = b.sample ? explainBonusLine(b.sample) : null
                                                                                        if (!line) return null
                                                                                        return <div className="text-[11px] text-muted-foreground whitespace-normal break-words leading-snug">{line}</div>
                                                                                    })()}
                                                                                </div>
                                                                                <div className="font-bold whitespace-nowrap">{formatRub(b.amount)} ₽</div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {monthShiftBreakdown.deductions.length > 0 && (
                                                                <div className="rounded-2xl border border-rose-200 bg-rose-50/30 p-4 space-y-3">
                                                                    <div className="text-sm font-medium text-rose-700">Удержания (по сменам)</div>
                                                                    <div className="space-y-2">
                                                                        {monthShiftBreakdown.deductions.map((d: any, idx: number) => (
                                                                            <div key={idx} className="flex items-center justify-between text-sm">
                                                                                <div className="text-rose-700 truncate pr-3">{d.name}</div>
                                                                                <div className="font-bold whitespace-nowrap text-rose-700">-{formatRub(d.amount)} ₽</div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </>
                                                    )}

                                                    {monthlyBonuses.length > 0 && (
                                                        <div className="rounded-2xl border border-slate-200 p-4 space-y-4">
                                                            <div className="flex items-center justify-between gap-3 flex-wrap">
                                                                <div className="text-sm font-medium">KPI и бонусы за месяц</div>
                                                                <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
                                                                    Масштаб: {monthPreview?.monthly?.shiftsWorked}/{monthPreview?.monthly?.standard} смен (×{monthPreview?.monthly?.scale?.toFixed(2)})
                                                                </Badge>
                                                            </div>

                                                            <div className="grid sm:grid-cols-2 gap-4">
                                                                <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                                                                    <div className="text-xs text-muted-foreground">Итого за месяц (деньги)</div>
                                                                    <div className="text-lg font-bold">{formatRub(monthPreview?.monthly?.totalReal ?? 0)} ₽</div>
                                                                </div>
                                                                <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                                                                    <div className="text-xs text-muted-foreground">Итого за месяц (депозит)</div>
                                                                    <div className="text-lg font-bold">{formatRub(monthPreview?.monthly?.totalVirtual ?? 0)} ₽</div>
                                                                </div>
                                                            </div>

                                                            <div className="space-y-2">
                                                                {monthPreview?.monthly?.items?.map((it: any, idx: number) => (
                                                                    <div key={idx} className="flex items-center justify-between gap-3 text-sm">
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className={cn("truncate font-medium", it.isActive ? "text-slate-800" : "text-slate-500")}>{it.name}</div>
                                                                            {it.logic && <div className="text-[11px] text-muted-foreground whitespace-normal break-words leading-snug">{it.logic}</div>}
                                                                        </div>
                                                                        <div className={cn("font-bold whitespace-nowrap", it.isActive ? "text-slate-900" : "text-slate-400")}>
                                                                            {formatRub(it.amount)} ₽
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}
