"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Loader2, Plus, Wallet, Sun, Moon, Percent, Clock, DollarSign, Edit, Trash2, Save, ArrowLeft, HelpCircle } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export interface Formula {
    base: {
        type: 'hourly' | 'per_shift' | 'none'
        amount?: number
        day_rate?: number
        night_rate?: number
        full_shift_hours?: number  // For per_shift: if worked less, calculate proportionally
    }
    bonuses: Bonus[]
    conditions: {
        shift_type: 'day' | 'night' | 'any'
        min_hours?: number
    }
}

export interface Bonus {
    type: 'percent_revenue' | 'fixed' | 'tiered' | 'progressive_percent' | 'penalty' | 'checklist' | 'maintenance_kpi'
    name?: string
    // For percent_revenue and progressive_percent
    source?: 'cash' | 'card' | 'total'
    percent?: number
    // For fixed, penalty, and maintenance_kpi (price per task)
    amount?: number
    // For tiered bonuses (KPI steps)
    tiers?: {
        from: number
        to: number | null  // null = unlimited
        bonus: number
    }[]
    // For progressive_percent
    thresholds?: {
        from: number
        percent: number
        label?: string
    }[]
    // For penalty
    penalty_reason?: string
    // For checklist bonus
    checklist_template_id?: number
    min_score?: number
    mode?: 'SHIFT' | 'MONTH'
    use_thresholds?: boolean
    checklist_thresholds?: {
        min_score: number
        amount: number
    }[]
    // For maintenance_kpi
    calculation_mode?: 'PER_TASK' | 'MONTHLY'
    overdue_tolerance_days?: number
    late_penalty_multiplier?: number
    reward_type?: 'MULTIPLIER' | 'FIXED'
    efficiency_thresholds?: {
        from_percent: number
        multiplier?: number
        amount?: number
    }[]
    // Payout type: real money or virtual balance
    payout_type?: 'REAL_MONEY' | 'VIRTUAL_BALANCE'
}

export interface PeriodBonus {
    id: string
    name: string
    metric_key: string
    type: 'TARGET' | 'PROGRESSIVE'
    target_per_shift: number
    reward_type: 'FIXED' | 'PERCENT'
    reward_value: number
    thresholds?: { from: number; percent: number; label?: string }[]
    bonus_mode?: 'MONTH' | 'SHIFT'
    // Payout type: real money or virtual balance
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

interface ReportMetric {
    key: string
    label: string
    type: string
    category: string
}

const generateId = () => {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

interface SalarySchemeFormProps {
    clubId: string
    schemeId?: string // 'new' or numeric ID
}

export default function SalarySchemeForm({ clubId, schemeId }: SalarySchemeFormProps) {
    const router = useRouter()
    const isNew = !schemeId || schemeId === 'new'
    
    const [isLoading, setIsLoading] = useState(!isNew)
    const [isSaving, setIsSaving] = useState(false)
    const [reportMetrics, setReportMetrics] = useState<ReportMetric[]>([])
    const [checklistTemplates, setChecklistTemplates] = useState<any[]>([])

    // Form state
    const [schemeName, setSchemeName] = useState('')
    const [schemeDescription, setSchemeDescription] = useState('')
    const [formula, setFormula] = useState<Formula>(defaultFormula)
    const [periodBonuses, setPeriodBonuses] = useState<PeriodBonus[]>([])
    const [standardMonthlyShifts, setStandardMonthlyShifts] = useState(15)

    useEffect(() => {
        fetchReportMetrics()
        fetchChecklistTemplates()
        
        if (!isNew && schemeId) {
            fetchScheme(schemeId)
        }
    }, [clubId, schemeId])

    const fetchScheme = async (id: string) => {
        try {
            const res = await fetch(`/api/clubs/${clubId}/salary-schemes/${id}`)
            if (res.ok) {
                const data = await res.json()
                const scheme = data.scheme || data
                setSchemeName(scheme.name)
                setSchemeDescription(scheme.description || '')
                setFormula(scheme.formula || defaultFormula)
                setPeriodBonuses(scheme.period_bonuses || [])
                setStandardMonthlyShifts(scheme.standard_monthly_shifts || 15)
            } else {
                console.error('Failed to fetch scheme')
                // Optionally redirect or show error
            }
        } catch (error) {
            console.error('Error fetching scheme:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const fetchReportMetrics = async () => {
        try {
            const res = await fetch(`/api/clubs/${clubId}/settings/reports`)
            const data = await res.json()
            if (res.ok && Array.isArray(data.systemMetrics)) {
                const numericMetrics = data.systemMetrics.filter(
                    (m: ReportMetric) => ['MONEY', 'NUMBER', 'DECIMAL', 'currency', 'number'].includes(m.type.toUpperCase()) || m.type.toLowerCase() === 'money'
                )
                numericMetrics.push({
                    key: 'evaluation_score',
                    label: 'Оценка по чеклистам (%)',
                    type: 'NUMBER',
                    category: 'KPI'
                })
                setReportMetrics(numericMetrics)
            }
        } catch (error) {
            console.error('Error fetching metrics:', error)
        }
    }

    const fetchChecklistTemplates = async () => {
        try {
            const res = await fetch(`/api/clubs/${clubId}/evaluations/templates`)
            const data = await res.json()
            if (res.ok && Array.isArray(data)) {
                setChecklistTemplates(data)
            }
        } catch (error) {
            console.error('Error fetching checklists:', error)
        }
    }

    const handleSave = async () => {
        if (!schemeName.trim()) {
            alert('Введите название схемы')
            return
        }

        setIsSaving(true)

        try {
            const url = isNew
                ? `/api/clubs/${clubId}/salary-schemes`
                : `/api/clubs/${clubId}/salary-schemes/${schemeId}`

            const res = await fetch(url, {
                method: isNew ? 'POST' : 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: schemeName,
                    description: schemeDescription,
                    formula,
                    period_bonuses: periodBonuses,
                    standard_monthly_shifts: standardMonthlyShifts
                })
            })

            if (res.ok) {
                router.push(`/clubs/${clubId}/settings/salary`)
                router.refresh()
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

    // --- Formula Handlers ---

    const handleUpdateBaseType = (type: 'hourly' | 'per_shift' | 'none') => {
        setFormula(prev => ({
            ...prev,
            base: {
                ...prev.base,
                type,
                amount: type !== 'none' ? (prev.base.amount || (type === 'per_shift' ? 2000 : 0)) : undefined,
                full_shift_hours: type === 'per_shift' ? (prev.base.full_shift_hours || 12) : undefined
            }
        }))
    }

    const updateBaseAmount = (field: string, value: number) => {
        setFormula(prev => ({
            ...prev,
            base: { ...prev.base, [field]: value }
        }))
    }

    const addBonus = (type: Bonus['type']) => {
        let newBonus: Bonus
        switch (type) {
            case 'percent_revenue':
                newBonus = { type: 'percent_revenue', name: 'Процент от выручки', source: 'total', percent: 5, payout_type: 'REAL_MONEY' }
                break
            case 'fixed':
                newBonus = { type: 'fixed', name: 'Фикс бонус', amount: 500, payout_type: 'REAL_MONEY' }
                break
            case 'tiered':
                newBonus = {
                    type: 'tiered',
                    name: 'KPI-ступени',
                    source: 'total',
                    tiers: [
                        { from: 0, to: 30000, bonus: 0 },
                        { from: 30001, to: 50000, bonus: 500 },
                        { from: 50001, to: null, bonus: 1000 }
                    ],
                    payout_type: 'REAL_MONEY'
                }
                break
            case 'progressive_percent':
                newBonus = {
                    type: 'progressive_percent',
                    name: 'Прогрессия %',
                    source: 'total',
                    thresholds: [
                        { from: 30000, percent: 3 },
                        { from: 50000, percent: 5 },
                        { from: 80000, percent: 7 }
                    ],
                    payout_type: 'REAL_MONEY'
                }
                break
            case 'penalty':
                newBonus = { type: 'penalty', name: 'Штраф', amount: 500, penalty_reason: 'Опоздание', payout_type: 'REAL_MONEY' }
                break
            case 'checklist':
                newBonus = {
                    type: 'checklist',
                    name: 'Бонус за чек-лист',
                    amount: 500,
                    min_score: 100,
                    checklist_template_id: checklistTemplates.length > 0 ? checklistTemplates[0].id : undefined,
                    mode: 'SHIFT',
                    payout_type: 'VIRTUAL_BALANCE'
                }
                break
            case 'maintenance_kpi':
                newBonus = {
                    type: 'maintenance_kpi',
                    name: 'KPI Обслуживания',
                    amount: 50,
                    calculation_mode: 'PER_TASK',
                    overdue_tolerance_days: 3,
                    late_penalty_multiplier: 0.5,
                    reward_type: 'FIXED',
                    efficiency_thresholds: [
                        { from_percent: 0, multiplier: 0, amount: 0 },
                        { from_percent: 50, multiplier: 0.8, amount: 2000 },
                        { from_percent: 80, multiplier: 1.0, amount: 3000 },
                        { from_percent: 90, multiplier: 1.2, amount: 5000 }
                    ],
                    payout_type: 'REAL_MONEY'
                }
                break
            default:
                newBonus = { type: 'fixed', name: 'Бонус', amount: 500, payout_type: 'REAL_MONEY' }
        }
        setFormula(prev => ({ ...prev, bonuses: [...prev.bonuses, newBonus] }))
    }

    const removeBonus = (index: number) => {
        setFormula(prev => ({
            ...prev,
            bonuses: prev.bonuses.filter((_, i) => i !== index)
        }))
    }

    const updateBonus = (index: number, field: string, value: any) => {
        setFormula(prev => ({
            ...prev,
            bonuses: prev.bonuses.map((b, i) => i === index ? { ...b, [field]: value } : b)
        }))
    }

    const updateTier = (bonusIndex: number, tierIndex: number, field: string, value: any) => {
        setFormula(prev => ({
            ...prev,
            bonuses: prev.bonuses.map((b, i) => {
                if (i !== bonusIndex || !b.tiers) return b
                return {
                    ...b,
                    tiers: b.tiers.map((t, ti) => ti === tierIndex ? { ...t, [field]: value } : t)
                }
            })
        }))
    }

    const addTier = (bonusIndex: number) => {
        setFormula(prev => ({
            ...prev,
            bonuses: prev.bonuses.map((b, i) => {
                if (i !== bonusIndex || !b.tiers) return b
                const lastTier = b.tiers[b.tiers.length - 1]
                return {
                    ...b,
                    tiers: [...b.tiers, { from: (lastTier?.to || 0) + 1, to: null, bonus: (lastTier?.bonus || 0) + 500 }]
                }
            })
        }))
    }

    const removeTier = (bonusIndex: number, tierIndex: number) => {
        setFormula(prev => ({
            ...prev,
            bonuses: prev.bonuses.map((b, i) => {
                if (i !== bonusIndex || !b.tiers) return b
                return { ...b, tiers: b.tiers.filter((_, ti) => ti !== tierIndex) }
            })
        }))
    }

    const addPeriodBonus = (type: PeriodBonus['type'] = 'TARGET') => {
        const newBonus: PeriodBonus = {
            id: generateId(),
            name: type === 'TARGET' ? 'Бонус за план' : 'Прогрессия KPI',
            metric_key: 'total_revenue',
            type: type,
            target_per_shift: 5000,
            reward_type: 'FIXED',
            reward_value: 1000,
            thresholds: type === 'PROGRESSIVE' ? [{ from: 30000, percent: 3 }] : undefined,
            payout_type: 'REAL_MONEY'
        }
        setPeriodBonuses([...periodBonuses, newBonus])
    }

    const removePeriodBonus = (index: number) => {
        setPeriodBonuses(prev => prev.filter((_, i) => i !== index))
    }

    const updatePeriodBonus = (index: number, field: keyof PeriodBonus, value: any) => {
        setPeriodBonuses(prev => prev.map((b, i) => i === index ? { ...b, [field]: value } : b))
    }

    const formatFormulaSummary = (f: Formula) => {
        const parts: string[] = []

        if (f.base.type === 'hourly') {
            if (f.base.day_rate && f.base.night_rate) {
                parts.push(`${f.base.day_rate}₽/час (день), ${f.base.night_rate}₽/час (ночь)`)
            } else {
                parts.push(`${f.base.amount || 0}₽/час`)
            }
        } else if (f.base.type === 'per_shift') {
            if (f.base.day_rate && f.base.night_rate) {
                parts.push(`${f.base.day_rate}₽/смена (день), ${f.base.night_rate}₽/смена (ночь)`)
            } else {
                parts.push(`${f.base.amount || 0}₽/смена`)
            }
            if (f.base.full_shift_hours) {
                parts.push(`за ${f.base.full_shift_hours}ч`)
            }
        }

        f.bonuses.forEach(b => {
            const sourceMap: Record<string, string> = { cash: 'нала', card: 'безнала', total: 'выручки' }
            if (b.type === 'percent_revenue') {
                parts.push(`+${b.percent}% от ${sourceMap[b.source || 'total']}`)
            } else if (b.type === 'fixed') {
                parts.push(`+${b.amount}₽ бонус`)
            } else if (b.type === 'tiered') {
                parts.push(`KPI-ступени (${b.tiers?.length || 0})`)
            } else if (b.type === 'progressive_percent') {
                parts.push(`Прогрессия % (${b.thresholds?.length || 0} порогов)`)
            } else if (b.type === 'penalty') {
                parts.push(`-${b.amount}₽ штраф`)
            } else if (b.type === 'checklist') {
                parts.push(`+${b.amount}₽ за чек-лист ${b.mode === 'MONTH' ? '(мес)' : ''} (> ${b.min_score}%)`)
            } else if (b.type === 'maintenance_kpi') {
                parts.push(`KPI Обслуживания (${b.amount}₽/задача${b.reward_type === 'FIXED' ? ', фикс. бонусы' : ''})`)
            }
        })

        return parts.join(' • ') || 'Не настроено'
    }

    if (isLoading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header / Actions */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">
                            {isNew ? 'Создание схемы оплаты' : `Редактирование: ${schemeName}`}
                        </h1>
                        <p className="text-muted-foreground">
                            {isNew ? 'Настройте новую формулу расчёта зарплаты' : 'Измените параметры схемы. Это создаст новую версию.'}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => router.back()}>
                        Отмена
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Сохранить
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="base" className="space-y-6">
                <TabsList className="grid w-full max-w-2xl grid-cols-3">
                    <TabsTrigger value="base">База и Условия</TabsTrigger>
                    <TabsTrigger value="bonuses">Бонусы и Штрафы</TabsTrigger>
                    <TabsTrigger value="kpi">KPI за Период</TabsTrigger>
                </TabsList>

                <TabsContent value="base" className="space-y-6">
                    {/* Basic Info */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Основные настройки</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-6 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Название схемы *</Label>
                                <Input
                                    value={schemeName}
                                    onChange={e => setSchemeName(e.target.value)}
                                    placeholder="Например: Стандартная"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Описание</Label>
                                <Input
                                    value={schemeDescription}
                                    onChange={e => setSchemeDescription(e.target.value)}
                                    placeholder="Для кого эта схема"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Standard Shifts (Эталон) */}
                    <Card className="border-blue-500/20 bg-blue-500/5 shadow-sm">
                        <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center gap-4">
                            <div className="flex-1">
                                <Label className="text-blue-700 font-bold mb-1 flex items-center gap-2">
                                    🎯 Эталон смен в месяц
                                </Label>
                                <p className="text-xs text-blue-600/80">
                                    Используется для пересчета KPI планов. Если сотрудник отработает больше или меньше этого эталона, его личный план изменится пропорционально.
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Input
                                    type="number"
                                    value={standardMonthlyShifts}
                                    onChange={e => setStandardMonthlyShifts(parseInt(e.target.value) || 15)}
                                    className="w-24 h-10 border-blue-500/30 text-lg font-bold bg-white"
                                />
                                <span className="font-medium text-blue-700">смен</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Base Rate */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <DollarSign className="h-4 w-4" />
                                Базовая ставка
                                <div className="group relative ml-1">
                                    <HelpCircle className="h-4 w-4 text-muted-foreground/50 cursor-help" />
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5 bg-slate-800 text-white text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 leading-relaxed">
                                        <p className="font-semibold mb-1">Как это работает?</p>
                                        <ul className="list-disc pl-3 space-y-1">
                                            <li><b>Почасовая:</b> Ставка * Часы. (500₽ * 10ч = 5000₽)</li>
                                            <li><b>За смену:</b> Фикс за выход. (2000₽ за смену, даже если отработал 12ч)</li>
                                        </ul>
                                    </div>
                                </div>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant={formula.base.type === 'hourly' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => handleUpdateBaseType('hourly')}
                                    className="gap-1"
                                >
                                    <Clock className="h-3 w-3" />
                                    Почасовая
                                </Button>
                                <Button
                                    type="button"
                                    variant={formula.base.type === 'per_shift' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => handleUpdateBaseType('per_shift')}
                                >
                                    За смену
                                </Button>
                                <Button
                                    type="button"
                                    variant={formula.base.type === 'none' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => handleUpdateBaseType('none')}
                                >
                                    Нет
                                </Button>
                            </div>

                            {formula.base.type !== 'none' && (
                                <>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            id="separate-rates"
                                            checked={!!(formula.base.day_rate || formula.base.night_rate)}
                                            onChange={e => {
                                                if (e.target.checked) {
                                                    updateBaseAmount('day_rate', formula.base.amount || 500)
                                                    updateBaseAmount('night_rate', (formula.base.amount || 500) * 1.5)
                                                } else {
                                                    setFormula(prev => ({
                                                        ...prev,
                                                        base: {
                                                            type: prev.base.type,
                                                            amount: prev.base.day_rate || prev.base.amount || 500
                                                        }
                                                    }))
                                                }
                                            }}
                                            className="rounded"
                                        />
                                        <Label htmlFor="separate-rates" className="text-sm">
                                            Разные ставки для дневной и ночной смены
                                        </Label>
                                    </div>

                                    {formula.base.day_rate !== undefined ? (
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="flex items-center gap-1 text-sm">
                                                    <Sun className="h-3 w-3 text-orange-500" />
                                                    Дневная ставка
                                                </Label>
                                                <div className="relative">
                                                    <Input
                                                        type="number"
                                                        value={formula.base.day_rate}
                                                        onChange={e => updateBaseAmount('day_rate', parseFloat(e.target.value) || 0)}
                                                        className="pr-16"
                                                    />
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                                                        ₽/{formula.base.type === 'hourly' ? 'час' : 'смена'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="flex items-center gap-1 text-sm">
                                                    <Moon className="h-3 w-3 text-blue-500" />
                                                    Ночная ставка
                                                </Label>
                                                <div className="relative">
                                                    <Input
                                                        type="number"
                                                        value={formula.base.night_rate}
                                                        onChange={e => updateBaseAmount('night_rate', parseFloat(e.target.value) || 0)}
                                                        className="pr-16"
                                                    />
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                                                        ₽/{formula.base.type === 'hourly' ? 'час' : 'смена'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <Label className="text-sm">Ставка</Label>
                                            <div className="relative max-w-xs">
                                                <Input
                                                    type="number"
                                                    value={formula.base.amount}
                                                    onChange={e => updateBaseAmount('amount', parseFloat(e.target.value) || 0)}
                                                    className="pr-16"
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                                                    ₽/{formula.base.type === 'hourly' ? 'час' : 'смена'}
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Full shift hours - only for per_shift */}
                                    {formula.base.type === 'per_shift' && (
                                        <div className="bg-blue-500/10 rounded-lg p-3 space-y-3">
                                            <div className="flex items-center gap-2">
                                                <Clock className="h-4 w-4 text-blue-500" />
                                                <Label className="text-sm font-medium">Полная смена = </Label>
                                                <Input
                                                    type="number"
                                                    value={formula.base.full_shift_hours || 12}
                                                    onChange={e => updateBaseAmount('full_shift_hours', parseFloat(e.target.value) || 12)}
                                                    className="w-20 h-8"
                                                />
                                                <span className="text-sm">часов</span>
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                Если сотрудник отработал меньше — зарплата будет пропорциональной.
                                                {formula.base.amount && formula.base.full_shift_hours && (
                                                    <> Пример: 8ч = {Math.round((formula.base.amount / formula.base.full_shift_hours) * 8)}₽</>
                                                )}
                                            </p>
                                        </div>
                                    )}
                                </>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="bonuses" className="space-y-6">
                    {/* Bonuses */}
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex flex-col gap-1 mb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Percent className="h-4 w-4" />
                                    Бонусы и штрафы за смену
                                </CardTitle>
                                <p className="text-xs text-muted-foreground">
                                    Начисляются ежедневно. Зависят от показателей конкретной смены (выручка дня, чеклист).
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2 mt-2">
                                <div className="w-full flex flex-wrap gap-2 mb-2 pb-2 border-b border-dashed">
                                    <span className="text-xs font-medium text-muted-foreground w-full uppercase tracking-wider">Рекомендуемые</span>
                                    <Button type="button" variant="outline" size="sm" className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800" onClick={() => addBonus('progressive_percent')}>
                                        + Прогрессия %
                                    </Button>
                                    <Button type="button" variant="outline" size="sm" className="border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800" onClick={() => addBonus('maintenance_kpi')}>
                                        + KPI Обслуживания
                                    </Button>
                                </div>
                                <span className="text-xs font-medium text-muted-foreground w-full uppercase tracking-wider mt-2">Остальные</span>
                                <Button type="button" variant="outline" size="sm" onClick={() => addBonus('percent_revenue')}>
                                    + % от выручки
                                </Button>
                                <Button type="button" variant="outline" size="sm" onClick={() => addBonus('fixed')}>
                                    + Фикс бонус
                                </Button>
                                <Button type="button" variant="outline" size="sm" onClick={() => addBonus('tiered')}>
                                    + KPI-ступени
                                </Button>
                                <Button type="button" variant="outline" size="sm" onClick={() => addBonus('checklist')}>
                                    + Чек-лист
                                </Button>
                                <Button type="button" variant="outline" size="sm" className="text-red-500 hover:text-red-600 border-red-200 hover:bg-red-50" onClick={() => addBonus('penalty')}>
                                    + Штраф
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {formula.bonuses.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground border-2 border-dashed rounded-lg bg-slate-50">
                                    <Percent className="h-10 w-10 mb-2 opacity-20" />
                                    <p className="text-sm">Нет бонусов за смену</p>
                                    <p className="text-xs mt-1">Выберите тип выше, чтобы добавить</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {formula.bonuses.map((bonus, index) => (
                                        <div key={index} className={`rounded-xl p-4 border shadow-sm transition-all ${bonus.type === 'penalty' ? 'border-red-200 bg-red-50/30' : 'bg-white hover:border-blue-300'}`}>
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-3 flex-1">
                                                    <Badge variant={bonus.type === 'penalty' ? 'destructive' : 'outline'} className="text-xs shrink-0">
                                                        {bonus.type === 'percent_revenue' && '% от выручки'}
                                                        {bonus.type === 'fixed' && 'Фикс бонус'}
                                                        {bonus.type === 'tiered' && 'KPI-ступени'}
                                                        {bonus.type === 'progressive_percent' && 'Прогрессия %'}
                                                        {bonus.type === 'penalty' && 'Штраф'}
                                                        {bonus.type === 'checklist' && 'Чек-лист'}
                                                        {bonus.type === 'maintenance_kpi' && 'KPI Обслуживания'}
                                                    </Badge>
                                                    <Input
                                                        value={bonus.name || ''}
                                                        onChange={(e) => updateBonus(index, 'name', e.target.value)}
                                                        className="h-8 text-sm max-w-[250px] bg-transparent border-transparent hover:border-input focus:border-input transition-colors font-medium"
                                                        placeholder="Название бонуса"
                                                    />
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 hover:text-red-500 hover:bg-red-50"
                                                    onClick={() => removeBonus(index)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>

                                            <div className="pl-1">
                                                {/* Payout Type Selector */}
                                                <div className="mb-3 flex items-center gap-2">
                                                    <Label className="text-xs text-muted-foreground">Тип выплаты:</Label>
                                                    <div className="flex rounded-md border border-input overflow-hidden">
                                                        <button
                                                            type="button"
                                                            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                                                                bonus.payout_type === 'REAL_MONEY' || !bonus.payout_type
                                                                    ? 'bg-blue-500 text-white'
                                                                    : 'bg-background text-muted-foreground hover:bg-muted'
                                                            }`}
                                                            onClick={() => updateBonus(index, 'payout_type', 'REAL_MONEY')}
                                                        >
                                                            💵 Реальные деньги
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className={`px-3 py-1.5 text-xs font-medium transition-colors border-l border-input ${
                                                                bonus.payout_type === 'VIRTUAL_BALANCE'
                                                                    ? 'bg-blue-500 text-white'
                                                                    : 'bg-background text-muted-foreground hover:bg-muted'
                                                            }`}
                                                            onClick={() => updateBonus(index, 'payout_type', 'VIRTUAL_BALANCE')}
                                                        >
                                                            🎮 Виртуальный баланс
                                                        </button>
                                                    </div>
                                                    <Badge variant={bonus.payout_type === 'VIRTUAL_BALANCE' ? 'secondary' : 'default'} className="text-xs">
                                                        {bonus.payout_type === 'VIRTUAL_BALANCE' ? 'Баланс' : 'Деньги'}
                                                    </Badge>
                                                </div>

                                                {/* Percent Revenue */}
                                                {bonus.type === 'percent_revenue' && (
                                                    <div className="flex items-center gap-3">
                                                        <Input
                                                            type="number"
                                                            value={bonus.percent}
                                                            onChange={e => updateBonus(index, 'percent', parseFloat(e.target.value) || 0)}
                                                            className="w-20"
                                                        />
                                                        <span className="text-sm">% от</span>
                                                        <select
                                                            value={bonus.source}
                                                            onChange={e => updateBonus(index, 'source', e.target.value)}
                                                            className="h-10 px-3 rounded-md border border-input bg-background text-sm"
                                                        >
                                                            {reportMetrics.length > 0 ? (
                                                                reportMetrics.map(m => (
                                                                    <option key={m.key} value={m.key}>{m.label}</option>
                                                                ))
                                                            ) : (
                                                                <>
                                                                    <option value="total">Всей выручки</option>
                                                                    <option value="cash">Наличных</option>
                                                                    <option value="card">Безналичных</option>
                                                                </>
                                                            )}
                                                        </select>
                                                    </div>
                                                )}

                                                {/* Fixed Bonus */}
                                                {bonus.type === 'fixed' && (
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-sm text-green-500 font-medium">+</span>
                                                        <Input
                                                            type="number"
                                                            value={bonus.amount}
                                                            onChange={e => updateBonus(index, 'amount', parseFloat(e.target.value) || 0)}
                                                            className="w-28"
                                                        />
                                                        <span className="text-sm">₽ за смену</span>
                                                    </div>
                                                )}

                                                {/* Tiered KPI */}
                                                {bonus.type === 'tiered' && bonus.tiers && (
                                                    <div className="space-y-2">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-sm">Источник:</span>
                                                                <div className="group relative">
                                                                    <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                                                        Какой показатель использовать для расчета ступеней (например, Общая выручка)
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <select
                                                                value={bonus.source}
                                                                onChange={e => updateBonus(index, 'source', e.target.value)}
                                                                className="h-8 px-2 rounded-md border border-input bg-background text-sm"
                                                            >
                                                                {reportMetrics.length > 0 ? (
                                                                    reportMetrics.map(m => (
                                                                        <option key={m.key} value={m.key}>{m.label}</option>
                                                                    ))
                                                                ) : (
                                                                    <>
                                                                        <option value="total">Вся выручка</option>
                                                                        <option value="cash">Наличные</option>
                                                                        <option value="card">Безналичные</option>
                                                                    </>
                                                                )}
                                                            </select>
                                                        </div>
                                                        {bonus.tiers.map((tier, tierIndex) => (
                                                            <div key={tierIndex} className="flex items-center gap-2 text-sm">
                                                                <span>От</span>
                                                                <Input
                                                                    type="number"
                                                                    value={tier.from}
                                                                    onChange={e => updateTier(index, tierIndex, 'from', parseFloat(e.target.value) || 0)}
                                                                    className="w-24 h-8"
                                                                />
                                                                <span>до</span>
                                                                <Input
                                                                    type="number"
                                                                    value={tier.to || ''}
                                                                    onChange={e => updateTier(index, tierIndex, 'to', e.target.value ? parseFloat(e.target.value) : null)}
                                                                    placeholder="∞"
                                                                    className="w-24 h-8"
                                                                />
                                                                <span>₽ →</span>
                                                                <Input
                                                                    type="number"
                                                                    value={tier.bonus}
                                                                    onChange={e => updateTier(index, tierIndex, 'bonus', parseFloat(e.target.value) || 0)}
                                                                    className="w-20 h-8"
                                                                />
                                                                <span>₽</span>
                                                                {bonus.tiers!.length > 1 && (
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-6 w-6 hover:text-red-500"
                                                                        onClick={() => removeTier(index, tierIndex)}
                                                                    >
                                                                        <Trash2 className="h-3 w-3" />
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        ))}
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-xs"
                                                            onClick={() => addTier(index)}
                                                        >
                                                            + Добавить ступень
                                                        </Button>
                                                    </div>
                                                )}

                                                {/* Progressive Percent */}
                                                {bonus.type === 'progressive_percent' && bonus.thresholds && (
                                                    <div className="space-y-2">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-sm">Источник:</span>
                                                                <div className="group relative">
                                                                    <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                                                        От какой суммы считать процент (обычно Общая выручка)
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <select
                                                                value={bonus.source}
                                                                onChange={e => updateBonus(index, 'source', e.target.value)}
                                                                className="h-8 px-2 rounded-md border border-input bg-background text-sm"
                                                            >
                                                                {reportMetrics.length > 0 ? (
                                                                    reportMetrics.map(m => (
                                                                        <option key={m.key} value={m.key}>{m.label}</option>
                                                                    ))
                                                                ) : (
                                                                    <>
                                                                        <option value="total">Вся выручка</option>
                                                                        <option value="cash">Наличные</option>
                                                                        <option value="card">Безналичные</option>
                                                                    </>
                                                                )}
                                                            </select>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                                                            Процент начисляется от суммы сверх порога
                                                            <div className="group relative inline-block">
                                                                <HelpCircle className="h-3 w-3 cursor-help" />
                                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2 bg-slate-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                                                    Пример: Порог 30,000₽, Процент 3%.<br/>
                                                                    Если выручка 40,000₽, то (40к - 30к) * 3% = 300₽ бонуса.
                                                                </div>
                                                            </div>
                                                        </p>
                                                        {bonus.thresholds.map((threshold, tIndex) => (
                                                            <div key={tIndex} className="flex items-center gap-2 text-sm">
                                                                <Input
                                                                    value={threshold.label || ''}
                                                                    onChange={e => {
                                                                        const newThresholds = [...bonus.thresholds!]
                                                                        newThresholds[tIndex] = { ...threshold, label: e.target.value }
                                                                        updateBonus(index, 'thresholds', newThresholds)
                                                                    }}
                                                                    placeholder="Напр: База"
                                                                    className="w-20 h-8 text-[10px]"
                                                                />
                                                                <span>От</span>
                                                                <Input
                                                                    type="number"
                                                                    value={threshold.from}
                                                                    onChange={e => {
                                                                        const newThresholds = [...bonus.thresholds!]
                                                                        newThresholds[tIndex] = { ...threshold, from: parseFloat(e.target.value) || 0 }
                                                                        updateBonus(index, 'thresholds', newThresholds)
                                                                    }}
                                                                    className="w-24 h-8"
                                                                />
                                                                <span>₽ →</span>
                                                                <Input
                                                                    type="number"
                                                                    value={threshold.percent}
                                                                    onChange={e => {
                                                                        const newThresholds = [...bonus.thresholds!]
                                                                        newThresholds[tIndex] = { ...threshold, percent: parseFloat(e.target.value) || 0 }
                                                                        updateBonus(index, 'thresholds', newThresholds)
                                                                    }}
                                                                    className="w-16 h-8"
                                                                />
                                                                <span>%</span>
                                                                {bonus.thresholds!.length > 1 && (
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-6 w-6 hover:text-red-500"
                                                                        onClick={() => {
                                                                            const newThresholds = bonus.thresholds!.filter((_, ti) => ti !== tIndex)
                                                                            updateBonus(index, 'thresholds', newThresholds)
                                                                        }}
                                                                    >
                                                                        <Trash2 className="h-3 w-3" />
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        ))}
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-xs"
                                                            onClick={() => {
                                                                const lastThreshold = bonus.thresholds![bonus.thresholds!.length - 1]
                                                                updateBonus(index, 'thresholds', [
                                                                    ...bonus.thresholds!,
                                                                    { from: (lastThreshold?.from || 0) + 30000, percent: (lastThreshold?.percent || 0) + 2 }
                                                                ])
                                                            }}
                                                        >
                                                            + Добавить порог
                                                        </Button>
                                                    </div>
                                                )}

                                                {/* Penalty */}
                                                {bonus.type === 'penalty' && (
                                                    <div className="space-y-3">
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-sm text-red-500 font-medium">−</span>
                                                            <Input
                                                                type="number"
                                                                value={bonus.amount}
                                                                onChange={e => updateBonus(index, 'amount', parseFloat(e.target.value) || 0)}
                                                                className="w-28"
                                                            />
                                                            <span className="text-sm">₽</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm text-muted-foreground">Причина:</span>
                                                            <Input
                                                                value={bonus.penalty_reason || ''}
                                                                onChange={e => updateBonus(index, 'penalty_reason', e.target.value)}
                                                                placeholder="Опоздание, недостача..."
                                                                className="flex-1"
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Checklist Bonus */}
                                                {bonus.type === 'checklist' && (
                                                    <div className="space-y-4">
                                                        <div className="flex bg-muted p-1 rounded-lg w-fit">
                                                            <button
                                                                type="button"
                                                                className={`text-[10px] px-2 py-1 rounded transition-all font-medium ${!bonus.use_thresholds ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:bg-background/50'}`}
                                                                onClick={() => updateBonus(index, 'use_thresholds', false)}
                                                            >
                                                                Фикс. сумма
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className={`text-[10px] px-2 py-1 rounded transition-all font-medium ${bonus.use_thresholds ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:bg-background/50'}`}
                                                                onClick={() => {
                                                                    updateBonus(index, 'use_thresholds', true);
                                                                    updateBonus(index, 'mode', 'MONTH');
                                                                    if (!bonus.checklist_thresholds || bonus.checklist_thresholds.length === 0) {
                                                                        updateBonus(index, 'checklist_thresholds', [
                                                                            { min_score: 80, amount: 300 },
                                                                            { min_score: 95, amount: 500 }
                                                                        ]);
                                                                    }
                                                                }}
                                                            >
                                                                Ступени
                                                            </button>
                                                        </div>

                                                        {!bonus.use_thresholds ? (
                                                            <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                                                <div className="flex items-center gap-3">
                                                                    <span className="text-sm text-green-500 font-medium">+</span>
                                                                    <Input
                                                                        type="number"
                                                                        value={bonus.amount}
                                                                        onChange={e => updateBonus(index, 'amount', parseFloat(e.target.value) || 0)}
                                                                        className="w-28"
                                                                    />
                                                                    <span className="text-sm">₽</span>
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-4">
                                                                    <div className="space-y-1">
                                                                        <Label className="text-xs text-muted-foreground">Чек-лист</Label>
                                                                        <select
                                                                            value={bonus.checklist_template_id}
                                                                            onChange={e => updateBonus(index, 'checklist_template_id', Number(e.target.value))}
                                                                            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                                                                        >
                                                                            <option value="">Выберите шаблон</option>
                                                                            {checklistTemplates.map(t => (
                                                                                <option key={t.id} value={t.id}>{t.name}</option>
                                                                            ))}
                                                                        </select>
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <Label className="text-xs text-muted-foreground">Мин. балл (%)</Label>
                                                                        <div className="relative">
                                                                            <Input
                                                                                type="number"
                                                                                min="0"
                                                                                max="100"
                                                                                value={bonus.min_score}
                                                                                onChange={e => updateBonus(index, 'min_score', parseFloat(e.target.value) || 0)}
                                                                                className="pr-8"
                                                                            />
                                                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                                                <div className="space-y-1">
                                                                    <Label className="text-xs text-muted-foreground">Шаблон чек-листа</Label>
                                                                    <select
                                                                        value={bonus.checklist_template_id}
                                                                        onChange={e => updateBonus(index, 'checklist_template_id', Number(e.target.value))}
                                                                        className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                                                                    >
                                                                        <option value="">Выберите шаблон</option>
                                                                        {checklistTemplates.map(t => (
                                                                            <option key={t.id} value={t.id}>{t.name}</option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                                <div className="space-y-2">
                                                                     <Label className="text-[10px] uppercase font-bold text-muted-foreground">Ступени вознаграждения</Label>
                                                                     <div className="space-y-2">
                                                                         {(bonus.checklist_thresholds || []).map((t: any, ti: number) => (
                                                                             <div key={ti} className="flex items-center gap-2 bg-muted/20 p-2 rounded-lg border border-dashed border-muted-foreground/20">
                                                                                 <div className="flex-1 flex items-center gap-2">
                                                                                     <span className="text-[10px] text-muted-foreground whitespace-nowrap">Балл ≥</span>
                                                                                     <div className="relative w-16">
                                                                                         <Input
                                                                                             type="number"
                                                                                             value={t.min_score}
                                                                                             onChange={e => {
                                                                                                 const newT = [...(bonus.checklist_thresholds || [])];
                                                                                                 newT[ti].min_score = parseFloat(e.target.value) || 0;
                                                                                                 updateBonus(index, 'checklist_thresholds', newT);
                                                                                             }}
                                                                                             className="h-7 text-xs pr-4 px-1"
                                                                                         />
                                                                                         <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">%</span>
                                                                                     </div>
                                                                                 </div>
                                                                                 <div className="flex-1 flex items-center gap-2">
                                                                                     <span className="text-[10px] text-muted-foreground whitespace-nowrap">Бонус:</span>
                                                                                     <div className="relative w-20">
                                                                                         <Input
                                                                                             type="number"
                                                                                             value={t.amount}
                                                                                             onChange={e => {
                                                                                                 const newT = [...(bonus.checklist_thresholds || [])];
                                                                                                 newT[ti].amount = parseFloat(e.target.value) || 0;
                                                                                                 updateBonus(index, 'checklist_thresholds', newT);
                                                                                             }}
                                                                                             className="h-7 text-xs pr-4 px-1"
                                                                                         />
                                                                                         <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">₽</span>
                                                                                     </div>
                                                                                 </div>
                                                                                 <Button
                                                                                     type="button"
                                                                                     variant="ghost"
                                                                                     size="icon"
                                                                                     className="h-6 w-6 text-muted-foreground hover:text-red-500"
                                                                                     onClick={() => {
                                                                                         const newT = (bonus.checklist_thresholds || []).filter((_: any, i: number) => i !== ti);
                                                                                         updateBonus(index, 'checklist_thresholds', newT);
                                                                                     }}
                                                                                 >
                                                                                     <Trash2 className="h-3 w-3" />
                                                                                 </Button>
                                                                             </div>
                                                                         ))}
                                                                         <Button
                                                                             type="button"
                                                                             variant="outline"
                                                                             size="sm"
                                                                             className="w-full h-7 text-[10px] border-dashed"
                                                                             onClick={() => {
                                                                                 const thresholds = bonus.checklist_thresholds || [];
                                                                                 const last = thresholds[thresholds.length - 1];
                                                                                 updateBonus(index, 'checklist_thresholds', [
                                                                                     ...thresholds,
                                                                                     {
                                                                                         min_score: (last?.min_score || 0) + 5,
                                                                                         amount: (last?.amount || 0) + 100
                                                                                     }
                                                                                 ]);
                                                                             }}
                                                                         >
                                                                             + Добавить ступень
                                                                         </Button>
                                                                     </div>
                                                                 </div>
                                                            </div>
                                                        )}

                                                        <p className="text-xs text-muted-foreground">
                                                            Бонус начисляется, если {bonus.mode === 'MONTH' ? 'средняя оценка за месяц' : 'оценка в смену'} соответствует условиям.
                                                        </p>
                                                        {!bonus.use_thresholds && (
                                                            <div className="flex items-center gap-2">
                                                                <Label className="text-xs text-muted-foreground">Режим:</Label>
                                                                <div className="flex gap-1">
                                                                    <Button
                                                                        type="button"
                                                                        variant={bonus.mode !== 'MONTH' ? 'secondary' : 'outline'}
                                                                        size="sm"
                                                                        onClick={() => updateBonus(index, 'mode', 'SHIFT')}
                                                                        className="h-6 text-[10px]"
                                                                    >
                                                                        В смену
                                                                    </Button>
                                                                    <Button
                                                                        type="button"
                                                                        variant={bonus.mode === 'MONTH' ? 'secondary' : 'outline'}
                                                                        size="sm"
                                                                        onClick={() => updateBonus(index, 'mode', 'MONTH')}
                                                                        className="h-6 text-[10px]"
                                                                    >
                                                                        За месяц
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {bonus.use_thresholds && (
                                                            <div className="flex items-center gap-2 p-2 bg-blue-50/50 rounded-lg border border-blue-100/50 dark:bg-blue-900/10 dark:border-blue-900/20">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                                                <span className="text-[10px] font-bold text-blue-700 uppercase">Режим: Только за месяц (для ступеней)</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                {/* Maintenance KPI Bonus */}
                                                {bonus.type === 'maintenance_kpi' && (
                                                    <div className="space-y-4">
                                                        <div className="flex bg-muted p-1 rounded-lg w-fit mb-2">
                                                            <button
                                                                type="button"
                                                                className={`text-xs px-3 py-1.5 rounded-md transition-all font-medium ${!bonus.calculation_mode || bonus.calculation_mode === 'PER_TASK' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:bg-background/50'}`}
                                                                onClick={() => updateBonus(index, 'calculation_mode', 'PER_TASK')}
                                                            >
                                                                За задачу
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className={`text-xs px-3 py-1.5 rounded-md transition-all font-medium ${bonus.calculation_mode === 'MONTHLY' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:bg-background/50'}`}
                                                                onClick={() => {
                                                                    updateBonus(index, 'calculation_mode', 'MONTHLY');
                                                                    updateBonus(index, 'reward_type', 'FIXED');
                                                                }}
                                                            >
                                                                За месяц (Ступени)
                                                            </button>
                                                        </div>

                                                        {(!bonus.calculation_mode || bonus.calculation_mode === 'PER_TASK') && (
                                                            <div className="flex items-center gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                                                <span className="text-sm text-indigo-500 font-medium">+</span>
                                                                <Input
                                                                    type="number"
                                                                    value={bonus.amount}
                                                                    onChange={e => updateBonus(index, 'amount', parseFloat(e.target.value) || 0)}
                                                                    className="w-24"
                                                                />
                                                                <span className="text-sm">₽ за задачу (чистка/ремонт)</span>
                                                            </div>
                                                        )}

                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div className="space-y-1">
                                                                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                                                    Допуск (дни)
                                                                    <div className="group relative">
                                                                        <HelpCircle className="h-3 w-3 cursor-help" />
                                                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                                                            Сколько дней задача может висеть просроченной без штрафа.
                                                                        </div>
                                                                    </div>
                                                                </Label>
                                                                <div className="relative">
                                                                    <Input
                                                                        type="number"
                                                                        value={bonus.overdue_tolerance_days}
                                                                        onChange={e => updateBonus(index, 'overdue_tolerance_days', parseInt(e.target.value) || 0)}
                                                                        className="pr-12"
                                                                    />
                                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">дней</span>
                                                                </div>
                                                            </div>
                                                            <div className="space-y-1">
                                                                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                                                    Штраф за опоздание
                                                                    <div className="group relative">
                                                                        <HelpCircle className="h-3 w-3 cursor-help" />
                                                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                                                            Коэффициент снижения цены. 0.5 = оплата 50% от стоимости задачи.
                                                                        </div>
                                                                    </div>
                                                                </Label>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-xs text-muted-foreground">x</span>
                                                                    <Input
                                                                        type="number"
                                                                        step="0.1"
                                                                        value={bonus.late_penalty_multiplier}
                                                                        onChange={e => updateBonus(index, 'late_penalty_multiplier', parseFloat(e.target.value) || 0)}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {bonus.calculation_mode === 'MONTHLY' && (
                                                            <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200 pt-2 border-t border-dashed">
                                                                <div className="flex items-center justify-between">
                                                                    <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Таблица эффективности (Месяц)</Label>
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-6 text-[10px]"
                                                                        onClick={() => {
                                                                            const thresholds = bonus.efficiency_thresholds || []
                                                                            const last = thresholds[thresholds.length - 1]
                                                                            updateBonus(index, 'efficiency_thresholds', [
                                                                                ...thresholds,
                                                                                {
                                                                                    from_percent: (last?.from_percent || 0) + 10,
                                                                                    multiplier: 1.0,
                                                                                    amount: (last?.amount || 0) + 1000
                                                                                }
                                                                            ])
                                                                        }}
                                                                    >
                                                                        + Порог
                                                                    </Button>
                                                                </div>

                                                                <div className="space-y-2">
                                                                    {(bonus.efficiency_thresholds || []).map((t, ti) => (
                                                                        <div key={ti} className="flex items-center gap-2 text-sm">
                                                                            <span>От</span>
                                                                            <Input
                                                                                type="number"
                                                                                value={t.from_percent}
                                                                                onChange={e => {
                                                                                    const newThresholds = [...(bonus.efficiency_thresholds || [])]
                                                                                    newThresholds[ti] = { ...t, from_percent: parseFloat(e.target.value) || 0 }
                                                                                    updateBonus(index, 'efficiency_thresholds', newThresholds)
                                                                                }}
                                                                                className="w-16 h-8"
                                                                            />
                                                                            <span>% →</span>
                                                                            <Input
                                                                                type="number"
                                                                                value={t.amount}
                                                                                onChange={e => {
                                                                                    const newThresholds = [...(bonus.efficiency_thresholds || [])]
                                                                                    newThresholds[ti] = { ...t, amount: parseFloat(e.target.value) || 0 }
                                                                                    updateBonus(index, 'efficiency_thresholds', newThresholds)
                                                                                }}
                                                                                className="w-24 h-8"
                                                                            />
                                                                            <span>₽</span>

                                                                            {bonus.efficiency_thresholds!.length > 1 && (
                                                                                <Button
                                                                                    type="button"
                                                                                    variant="ghost"
                                                                                    size="icon"
                                                                                    className="h-6 w-6 hover:text-red-500 ml-auto"
                                                                                    onClick={() => {
                                                                                        const newThresholds = bonus.efficiency_thresholds!.filter((_, i) => i !== ti)
                                                                                        updateBonus(index, 'efficiency_thresholds', newThresholds)
                                                                                    }}
                                                                                >
                                                                                    <Trash2 className="h-3 w-3" />
                                                                                </Button>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                                <p className="text-[10px] text-muted-foreground">
                                                                    Пример: От 90% → 5000₽ (Фикс). От 0% → 0₽.
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="kpi" className="space-y-6">
                    {/* Period Bonuses */}
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex flex-col gap-1 mb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Wallet className="h-4 w-4" />
                                    KPI за Период (Месяц)
                                </CardTitle>
                                <p className="text-xs text-muted-foreground">
                                    Начисляются в конце месяца. Зависят от выполнения общего плана или суммарных показателей за весь период.
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2 mt-2">
                                <Button type="button" variant="outline" size="sm" onClick={() => addPeriodBonus('TARGET')}>
                                    + KPI (План)
                                </Button>
                                <Button type="button" variant="outline" size="sm" onClick={() => addPeriodBonus('PROGRESSIVE')}>
                                    + KPI (Прогрессия)
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {periodBonuses.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground border-2 border-dashed rounded-lg bg-slate-50">
                                    <Wallet className="h-10 w-10 mb-2 opacity-20" />
                                    <p className="text-sm">Нет KPI бонусов</p>
                                    <p className="text-xs mt-1">Добавьте бонус за выполнение плана продаж</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {periodBonuses.map((bonus, index) => (
                                        <div key={bonus.id} className="rounded-xl p-4 border bg-white shadow-sm hover:border-blue-300 transition-all">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-3 flex-1">
                                                    <Badge variant="secondary" className="text-xs shrink-0">
                                                        {bonus.type === 'PROGRESSIVE' ? 'KPI (Прогрессия)' : 'KPI (План)'}
                                                    </Badge>
                                                    <Input
                                                        value={bonus.name}
                                                        onChange={e => updatePeriodBonus(index, 'name', e.target.value)}
                                                        className="h-8 text-sm max-w-[250px] bg-transparent border-transparent hover:border-input focus:border-input transition-colors font-medium"
                                                        placeholder="Название (например: План по бару)"
                                                    />
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 hover:text-red-500 hover:bg-red-50"
                                                    onClick={() => removePeriodBonus(index)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>

                                            {/* Payout Type Selector for Period Bonus */}
                                            <div className="mb-3 flex items-center gap-2">
                                                <Label className="text-xs text-muted-foreground">Тип выплаты:</Label>
                                                <div className="flex rounded-md border border-input overflow-hidden">
                                                    <button
                                                        type="button"
                                                        className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                                                            bonus.payout_type === 'REAL_MONEY' || !bonus.payout_type
                                                                ? 'bg-blue-500 text-white'
                                                                : 'bg-background text-muted-foreground hover:bg-muted'
                                                        }`}
                                                        onClick={() => updatePeriodBonus(index, 'payout_type', 'REAL_MONEY')}
                                                    >
                                                        💵 Реальные деньги
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`px-3 py-1.5 text-xs font-medium transition-colors border-l border-input ${
                                                            bonus.payout_type === 'VIRTUAL_BALANCE'
                                                                ? 'bg-blue-500 text-white'
                                                                : 'bg-background text-muted-foreground hover:bg-muted'
                                                        }`}
                                                        onClick={() => updatePeriodBonus(index, 'payout_type', 'VIRTUAL_BALANCE')}
                                                    >
                                                        🎮 Виртуальный баланс
                                                    </button>
                                                </div>
                                                <Badge variant={bonus.payout_type === 'VIRTUAL_BALANCE' ? 'secondary' : 'default'} className="text-xs">
                                                    {bonus.payout_type === 'VIRTUAL_BALANCE' ? 'Баланс' : 'Деньги'}
                                                </Badge>
                                            </div>

                                            <div className="mb-4">
                                                <Label className="text-xs text-muted-foreground">Показатель</Label>
                                                <select
                                                    value={bonus.metric_key}
                                                    onChange={e => updatePeriodBonus(index, 'metric_key', e.target.value)}
                                                    className="w-full h-9 mt-1 px-3 rounded-md border border-input bg-background text-sm"
                                                >
                                                    <option value="total_revenue">Общая выручка</option>
                                                    <option value="cash_income">Выручка (Нал)</option>
                                                    <option value="card_income">Выручка (Карта)</option>
                                                    <option value="total_hours">Часы работы</option>
                                                    {reportMetrics.map(m => (
                                                        <option key={m.key} value={m.key}>{m.label}</option>
                                                    ))}
                                                </select>
                                                <div className="mt-4">
                                                    <Label className="text-[10px] text-muted-foreground mr-3 uppercase font-bold text-blue-600">Режим расчёта:</Label>
                                                    <div className="flex gap-2 mt-1">
                                                        <Button
                                                            type="button"
                                                            variant={(bonus.bonus_mode || 'MONTH') === 'MONTH' ? 'secondary' : 'outline'}
                                                            size="sm"
                                                            onClick={() => updatePeriodBonus(index, 'bonus_mode', 'MONTH')}
                                                            className="h-7 text-[10px] flex-1"
                                                        >
                                                            За Месяц
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant={bonus.bonus_mode === 'SHIFT' ? 'secondary' : 'outline'}
                                                            size="sm"
                                                            onClick={() => updatePeriodBonus(index, 'bonus_mode', 'SHIFT')}
                                                            className="h-7 text-[10px] flex-1"
                                                        >
                                                            За Смену
                                                        </Button>
                                                    </div>
                                                    <p className="text-[10px] text-muted-foreground mt-1 px-1">
                                                        {(bonus.bonus_mode || 'MONTH') === 'MONTH'
                                                            ? `Цель пересчитывается от эталона ${standardMonthlyShifts} смен.`
                                                            : `Цель фиксированная на каждую смену.`}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* TARGET MODE UI */}
                                            {bonus.type !== 'PROGRESSIVE' && (
                                                <>
                                                    <div className="mb-4">
                                                        <Label className="text-xs text-muted-foreground">Цель на смену</Label>
                                                        <div className="relative mt-1">
                                                            <Input
                                                                type="number"
                                                                value={bonus.target_per_shift}
                                                                onChange={e => updatePeriodBonus(index, 'target_per_shift', parseFloat(e.target.value) || 0)}
                                                                className="h-9 pr-12"
                                                            />
                                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">р./см.</span>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4 items-end">
                                                        <div>
                                                            <Label className="text-xs text-muted-foreground">Тип награды</Label>
                                                            <div className="flex gap-1 mt-1">
                                                                <Button
                                                                    type="button"
                                                                    variant={bonus.reward_type === 'FIXED' ? 'default' : 'outline'}
                                                                    size="sm"
                                                                    onClick={() => updatePeriodBonus(index, 'reward_type', 'FIXED')}
                                                                    className="flex-1 h-8 text-xs"
                                                                >
                                                                    Фикс
                                                                </Button>
                                                                <Button
                                                                    type="button"
                                                                    variant={bonus.reward_type === 'PERCENT' ? 'default' : 'outline'}
                                                                    size="sm"
                                                                    onClick={() => updatePeriodBonus(index, 'reward_type', 'PERCENT')}
                                                                    className="flex-1 h-8 text-xs"
                                                                >
                                                                    %
                                                                </Button>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <Label className="text-xs text-muted-foreground">Значение</Label>
                                                            <div className="relative mt-1">
                                                                <Input
                                                                    type="number"
                                                                    value={bonus.reward_value}
                                                                    onChange={e => updatePeriodBonus(index, 'reward_value', parseFloat(e.target.value) || 0)}
                                                                    className="h-9 pr-8"
                                                                />
                                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                                                    {bonus.reward_type === 'PERCENT' ? '%' : '₽'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </>
                                            )}

                                            {/* PROGRESSIVE MODE UI */}
                                            {bonus.type === 'PROGRESSIVE' && bonus.thresholds && (
                                                <div className="space-y-2">
                                                    <p className="text-xs text-muted-foreground mb-2">
                                                        Процент начисляется от показателя за период, если он превышает (Порог * Кол-во смен)
                                                    </p>
                                                    {bonus.thresholds.map((threshold, tIndex) => (
                                                        <div key={tIndex} className="flex items-center gap-2 text-sm">
                                                            <Input
                                                                value={threshold.label || ''}
                                                                onChange={e => {
                                                                    const newThresholds = [...bonus.thresholds!]
                                                                    newThresholds[tIndex] = { ...threshold, label: e.target.value }
                                                                    updatePeriodBonus(index, 'thresholds', newThresholds)
                                                                }}
                                                                placeholder="Напр: База"
                                                                className="w-24 h-8 text-[10px]"
                                                            />
                                                            <span>От</span>
                                                            <Input
                                                                type="number"
                                                                value={threshold.from}
                                                                onChange={e => {
                                                                    const newThresholds = [...bonus.thresholds!]
                                                                    newThresholds[tIndex] = { ...threshold, from: parseFloat(e.target.value) || 0 }
                                                                    updatePeriodBonus(index, 'thresholds', newThresholds)
                                                                }}
                                                                className="w-24 h-8"
                                                            />
                                                            <span className="text-xs text-muted-foreground">р./см.</span>
                                                            <span>→</span>
                                                            <Input
                                                                type="number"
                                                                value={threshold.percent}
                                                                onChange={e => {
                                                                    const newThresholds = [...bonus.thresholds!]
                                                                    newThresholds[tIndex] = { ...threshold, percent: parseFloat(e.target.value) || 0 }
                                                                    updatePeriodBonus(index, 'thresholds', newThresholds)
                                                                }}
                                                                className="w-16 h-8"
                                                            />
                                                            <span>%</span>
                                                            {bonus.thresholds!.length > 1 && (
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-6 w-6 hover:text-red-500"
                                                                    onClick={() => {
                                                                        const newThresholds = bonus.thresholds!.filter((_, ti) => ti !== tIndex)
                                                                        updatePeriodBonus(index, 'thresholds', newThresholds)
                                                                    }}
                                                                >
                                                                    <Trash2 className="h-3 w-3" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    ))}
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-xs"
                                                        onClick={() => {
                                                            const lastThreshold = bonus.thresholds![bonus.thresholds!.length - 1]
                                                            updatePeriodBonus(index, 'thresholds', [
                                                                ...bonus.thresholds!,
                                                                { from: (lastThreshold?.from || 0) + 5000, percent: (lastThreshold?.percent || 0) + 1 }
                                                            ])
                                                        }}
                                                    >
                                                        + Добавить порог
                                                    </Button>

                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}