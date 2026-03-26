"use client"

import { useEffect, useState, useMemo } from "react"
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
    }
    bonuses: Bonus[]
    conditions: {
        shift_type: 'day' | 'night' | 'any'
        min_hours?: number
    }
}

export interface Bonus {
    type: 'percent_revenue' | 'fixed' | 'progressive_percent' | 'checklist' | 'maintenance_kpi' | 'leaderboard_rank'
    name?: string
    source?: 'cash' | 'card' | 'total'
    percent?: number
    amount?: number

    thresholds?: { from: number; percent?: number; amount?: number; label?: string }[]
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

                setFormula({ ...loadedFormula, bonuses })
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

    if (isLoading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-purple-600" /></div>

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft className="h-5 w-5" /></Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">{isNew ? 'Создание схемы оплаты' : `Редактирование: ${schemeName}`}</h1>
                        <p className="text-muted-foreground text-sm">{isNew ? 'Настройте новую формулу расчёта зарплаты' : 'Измените параметры схемы. Это создаст новую версию.'}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => router.back()}>Отмена</Button>
                    <Button onClick={handleSave} disabled={isSaving} className="gap-2">{isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Сохранить</Button>
                </div>
            </div>

            <Tabs defaultValue="base" className="space-y-6">
                <TabsList className="grid w-full max-w-xl grid-cols-2 bg-muted/50 p-1 rounded-2xl h-14">
                    <TabsTrigger value="base" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm font-bold text-xs uppercase tracking-widest">1. База и Условия</TabsTrigger>
                    <TabsTrigger value="motivation" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm font-bold text-xs uppercase tracking-widest">2. Мотивация</TabsTrigger>
                </TabsList>

                <TabsContent value="base" className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
                    <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden">
                        <CardHeader className="bg-slate-50/50 pb-6">
                            <CardTitle className="text-xl font-black tracking-tight flex items-center gap-2">
                                <div className="h-8 w-8 rounded-xl bg-purple-100 flex items-center justify-center"><Edit className="h-4 w-4 text-purple-600" /></div>
                                Базовые настройки
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-6">
                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Название схемы *</Label>
                                    <Input value={schemeName} onChange={e => setSchemeName(e.target.value)} placeholder="Например: Старший администратор (Ночь)" className="h-12 rounded-xl border-muted-foreground/10 focus:border-purple-500/50 bg-muted/5" />
                                    <p className="text-[10px] text-muted-foreground ml-1">Укажите понятное название, чтобы не запутаться при назначении сотрудникам.</p>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Эталон смен</Label>
                                    <div className="flex items-center gap-3">
                                        <Input type="number" value={standardMonthlyShifts} onChange={e => setStandardMonthlyShifts(parseInt(e.target.value) || 15)} className="h-12 w-24 rounded-xl border-muted-foreground/10 focus:border-purple-500/50 bg-muted/5 text-center font-bold" />
                                        <span className="text-xs text-muted-foreground font-medium">смен в месяц (норма)</span>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground ml-1">Используется для расчета KPI. Если сотрудник работает больше нормы — план растет.</p>
                                </div>
                            </div>

                            <div className="space-y-4 pt-4 border-t border-dashed">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="h-8 w-8 rounded-xl bg-emerald-100 flex items-center justify-center"><DollarSign className="h-4 w-4 text-emerald-600" /></div>
                                        <div>
                                            <h3 className="font-bold text-sm">Базовая ставка</h3>
                                            <p className="text-[10px] text-muted-foreground">Фиксированная оплата за выход или часы</p>
                                        </div>
                                    </div>
                                    <div className="flex p-1 bg-muted/30 rounded-xl">
                                        <button type="button" onClick={() => handleUpdateBaseType('hourly')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${formula.base.type === 'hourly' ? 'bg-white shadow-sm text-purple-600' : 'text-muted-foreground hover:bg-white/50'}`}>Почасовая</button>
                                        <button type="button" onClick={() => handleUpdateBaseType('per_shift')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${formula.base.type === 'per_shift' ? 'bg-white shadow-sm text-purple-600' : 'text-muted-foreground hover:bg-white/50'}`}>За смену</button>
                                    </div>
                                </div>

                                {formula.base.type !== 'none' && (
                                    <div className="bg-slate-50/50 rounded-2xl p-6 space-y-6 animate-in zoom-in-95 duration-300 border border-slate-100">
                                        <div className="flex items-start justify-between gap-6">
                                            <div className="space-y-4 flex-1">
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Размер ставки</Label>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-bold text-muted-foreground uppercase">Ночной тариф</span>
                                                        <Switch checked={!!(formula.base.day_rate || formula.base.night_rate)} onCheckedChange={checked => { if (checked) { updateBaseAmount('day_rate', formula.base.amount || 500); updateBaseAmount('night_rate', (formula.base.amount || 500) * 1.2) } else { setFormula(prev => ({ ...prev, base: { type: prev.base.type, amount: prev.base.day_rate || prev.base.amount || 500 } })) } }} className="scale-75 data-[state=checked]:bg-purple-600" />
                                                    </div>
                                                </div>
                                                
                                                {formula.base.day_rate !== undefined ? (
                                                    <div className="space-y-3">
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div className="relative group">
                                                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-500"><Sun className="h-4 w-4" /></div>
                                                                <Input type="number" value={formula.base.day_rate} onChange={e => updateBaseAmount('day_rate', parseFloat(e.target.value) || 0)} className="h-10 rounded-xl border-muted-foreground/10 bg-white pl-10 pr-8 text-sm font-black text-slate-700" />
                                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase text-muted-foreground">₽</span>
                                                            </div>
                                                            <div className="relative group">
                                                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-500"><Moon className="h-4 w-4" /></div>
                                                                <Input type="number" value={formula.base.night_rate} onChange={e => updateBaseAmount('night_rate', parseFloat(e.target.value) || 0)} className="h-10 rounded-xl border-muted-foreground/10 bg-white pl-10 pr-8 text-sm font-black text-slate-700" />
                                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase text-muted-foreground">₽</span>
                                                            </div>
                                                        </div>
                                                        <p className="text-[10px] text-muted-foreground leading-snug">
                                                            Ночной тариф применяется автоматически для смен, которые начинаются или заканчиваются в ночное время (обычно с 22:00 до 08:00).
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        <div className="relative group max-w-[120px]">
                                                            <Input type="number" value={formula.base.amount} onChange={e => updateBaseAmount('amount', parseFloat(e.target.value) || 0)} className="h-10 rounded-xl border-muted-foreground/10 bg-white pl-4 pr-8 text-sm font-black text-slate-700" />
                                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase text-muted-foreground">₽</span>
                                                        </div>
                                                        <p className="text-[10px] text-muted-foreground leading-snug">
                                                            {formula.base.type === 'hourly' 
                                                                ? "Оплата за один час работы. Умножается на количество отработанных часов."
                                                                : "Фиксированная сумма за одну смену. Выплачивается при выполнении нормы часов."}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="w-px bg-slate-200 self-stretch mx-2" />

                                            <div className="space-y-4 flex-1">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Условия выплаты</Label>
                                                <div className="space-y-3">
                                                    <div className="flex flex-col gap-2">
                                                        <span className="text-[10px] font-bold text-slate-500">Когда выплачивать?</span>
                                                        <div className="flex p-1 bg-white rounded-xl border border-slate-200 w-fit">
                                                            <button 
                                                                type="button" 
                                                                onClick={() => setFormula(prev => ({ ...prev, base: { ...prev.base, payout_timing: 'MONTH' } }))}
                                                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${(!formula.base.payout_timing || formula.base.payout_timing === 'MONTH') ? 'bg-emerald-50 text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                                            >
                                                                В конце месяца
                                                            </button>
                                                            <button 
                                                                type="button" 
                                                                onClick={() => setFormula(prev => ({ ...prev, base: { ...prev.base, payout_timing: 'SHIFT' } }))}
                                                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${formula.base.payout_timing === 'SHIFT' ? 'bg-emerald-50 text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                                            >
                                                                В конце смены
                                                            </button>
                                                        </div>
                                                        <p className="text-[10px] text-muted-foreground leading-snug">
                                                            {(!formula.base.payout_timing || formula.base.payout_timing === 'MONTH') 
                                                                ? "Сумма будет копиться на балансе и выплачиваться в расчетный день." 
                                                                : "Система предложит выдать деньги из кассы сразу после закрытия смены."}
                                                        </p>
                                                    </div>
                                                    
                                                    {formula.base.type === 'per_shift' && (
                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-2 text-xs">
                                                                <span className="text-slate-500 font-medium">Полная смена от:</span>
                                                                <div className="relative w-16">
                                                                    <Input type="number" value={formula.base.full_shift_hours || 12} onChange={e => updateBaseAmount('full_shift_hours', parseFloat(e.target.value) || 12)} className="h-8 rounded-lg border-slate-200 text-center font-bold text-slate-700 pr-6" />
                                                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">ч</span>
                                                                </div>
                                                            </div>
                                                            <p className="text-[10px] text-muted-foreground leading-snug">Если отработано меньше — оплата снизится пропорционально.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="motivation" className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-500">
                    {/* Daily Bonuses Section */}
                    <div className="space-y-6">
                        <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden">
                            <CardHeader className="bg-slate-50/50 pb-8">
                                <div className="flex flex-col gap-2">
                                    <CardTitle className="text-xl font-black tracking-tight flex items-center gap-2">
                                        Мотивация
                                    </CardTitle>
                                    <p className="text-xs font-medium text-muted-foreground leading-relaxed">
                                        Настройте систему поощрений, чтобы сотрудники зарабатывали больше, принося пользу клубу. 
                                        Комбинируйте бонусы за выручку, выполнение задач и качество работы (чек-листы). 
                                        Прозрачная система мотивации повышает эффективность персонала.
                                    </p>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
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
                            </CardHeader>
                            <CardContent className="pt-8">
                                {formula.bonuses.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border-2 border-dashed rounded-[2rem] bg-slate-50/50 border-slate-200/50"><div className="h-16 w-16 rounded-full bg-white flex items-center justify-center shadow-sm mb-4"><Percent className="h-8 w-8 opacity-20" /></div><p className="text-sm font-bold uppercase tracking-widest opacity-40">Список бонусов пуст</p><p className="text-xs mt-2 font-medium opacity-40">Выберите тип выше, чтобы добавить его в схему</p></div>
                                ) : (
                                    <div className="grid gap-6">
                                        {formula.bonuses.map((bonus, index) => (
                                            <div id={`bonus-${index}`} key={index} className={`group relative rounded-[2rem] p-8 border shadow-sm transition-all duration-300 ${'bg-white hover:shadow-xl hover:border-purple-200'}`}>
                                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                                                    <div className="flex items-center gap-4 flex-1">
                                                        <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shadow-sm ${bonus.type === 'progressive_percent' ? 'bg-emerald-600 text-white' : bonus.type === 'leaderboard_rank' ? 'bg-amber-500 text-white' : 'bg-purple-600 text-white'}`}>{bonus.type === 'percent_revenue' && <Percent className="h-6 w-6" />}{bonus.type === 'fixed' && <Coins className="h-6 w-6" />}{bonus.type === 'progressive_percent' && <TrendingUp className="h-6 w-6" />}{bonus.type === 'checklist' && <ClipboardCheck className="h-6 w-6" />}{bonus.type === 'maintenance_kpi' && <Wrench className="h-6 w-6" />}{bonus.type === 'leaderboard_rank' && <Trophy className="h-6 w-6" />}</div>
                                                        <div className="space-y-1"><Badge variant="secondary" className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg ${bonus.type === 'progressive_percent' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : bonus.type === 'leaderboard_rank' ? 'bg-amber-50 text-amber-700 border-amber-100' : ''}`}>{bonus.type === 'percent_revenue' && 'Процент от выручки'}{bonus.type === 'fixed' && 'Фиксированный бонус'}{bonus.type === 'progressive_percent' && 'Бонус за выполнение плана'}{bonus.type === 'checklist' && 'Бонус за чек-лист'}{bonus.type === 'maintenance_kpi' && 'Бонус за обслуживание'}{bonus.type === 'leaderboard_rank' && 'Бонус за место'}</Badge><Input value={bonus.name || ''} onChange={(e) => updateBonus(index, 'name', e.target.value)} className="h-10 text-xl font-black bg-transparent border-none p-0 focus-visible:ring-0 focus-visible:outline-none placeholder:opacity-20" placeholder="Название бонуса..." /></div>
                                                    </div>
                                                    <Button type="button" variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-red-500 hover:text-white transition-all shrink-0" onClick={() => removeBonus(index)}><Trash2 className="h-5 w-5" /></Button>
                                                </div>
                                                <div className="space-y-8">
                                                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6">
                                                        <div className="flex items-start gap-3">
                                                            <HelpCircle className="h-5 w-5 text-purple-400 shrink-0 mt-0.5" />
                                                            <div className="space-y-2">
                                                                <h5 className="text-xs font-black uppercase tracking-tight text-slate-700">Как это работает?</h5>
                                                                <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                                                                    {bonus.type === 'percent_revenue' && "Сотрудник получает указанный % от каждой заработанной суммы. Если выручка 50,000₽, а бонус 5%, то к зарплате добавится 2,500₽."}
                                                                    {bonus.type === 'fixed' && "Просто фиксированная сумма за выход в смену. Добавляется к базовой ставке независимо от выручки."}

                                                                    {bonus.type === 'progressive_percent' && "Мотивирует зарабатывать сверх плана. Чем больше выручка, тем выше процент от суммы превышения порога."}
                                                                    
                                                                    {bonus.type === 'checklist' && "Премия за дисциплину. Начисляется только если средний балл по чеклистам за смену (или месяц) выше порога."}
                                                                    {bonus.type === 'maintenance_kpi' && "Оплата за техническую работу. Можно платить за каждую выполненную задачу по обслуживанию ПК."}
                                                                    {bonus.type === 'leaderboard_rank' && "Система сравнивает сотрудников клуба по общему рейтингу за месяц и выдает премию за выбранное место в таблице."}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-col sm:flex-row gap-6">
                                                        <div className="flex flex-col gap-3">
                                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Куда зачислять бонус?</Label>
                                                            <div className="flex p-1.5 bg-muted/30 rounded-2xl w-fit">
                                                                <button type="button" className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold transition-all ${bonus.payout_type === 'REAL_MONEY' || !bonus.payout_type ? 'bg-white shadow-md scale-[1.02] text-emerald-600' : 'text-muted-foreground hover:bg-white/50'}`} onClick={() => updateBonus(index, 'payout_type', 'REAL_MONEY')}><Coins className="h-4 w-4" /> Деньги</button>
                                                                <button type="button" className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold transition-all ${bonus.payout_type === 'VIRTUAL_BALANCE' ? 'bg-white shadow-md scale-[1.02] text-purple-600' : 'text-muted-foreground hover:bg-white/50'}`} onClick={() => updateBonus(index, 'payout_type', 'VIRTUAL_BALANCE')}><Wallet className="h-4 w-4" /> На депозит</button>
                                                            </div>
                                                        </div>

                                                        {bonus.payout_type !== 'VIRTUAL_BALANCE' && bonus.type !== 'leaderboard_rank' && (
                                                            <div className="flex flex-col gap-3">
                                                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Когда выплачивать?</Label>
                                                                <div className="flex p-1.5 bg-emerald-50/50 rounded-2xl w-fit border border-emerald-100/50">
                                                                    <button type="button" className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold transition-all ${(!bonus.payout_timing || bonus.payout_timing === 'MONTH') ? 'bg-white shadow-md scale-[1.02] text-emerald-600' : 'text-emerald-700/50 hover:bg-white/50'}`} onClick={() => updateBonus(index, 'payout_timing', 'MONTH')}>В конце месяца</button>
                                                                    <button type="button" className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold transition-all ${bonus.payout_timing === 'SHIFT' ? 'bg-white shadow-md scale-[1.02] text-emerald-600' : 'text-emerald-700/50 hover:bg-white/50'}`} onClick={() => updateBonus(index, 'payout_timing', 'SHIFT')}>Выдавать в конце смены</button>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {bonus.type === 'leaderboard_rank' && (
                                                            <div className="flex flex-col gap-3">
                                                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Когда выплачивать?</Label>
                                                                <div className="flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-bold bg-amber-50 text-amber-700 border border-amber-100 w-fit">
                                                                    <Trophy className="h-4 w-4" />
                                                                    Только в конце месяца
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="grid md:grid-cols-2 gap-8 items-end">
                                                        <div className="space-y-4"><Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Настройки расчета</Label>
                                                            {bonus.type === 'percent_revenue' && (
                                                                <div className="flex items-center gap-4 bg-muted/20 p-4 rounded-[1.5rem] border border-muted-foreground/5">
                                                                    <div className="relative w-24">
                                                                        <Input type="number" value={bonus.percent} onChange={e => updateBonus(index, 'percent', parseFloat(e.target.value) || 0)} className="h-12 rounded-xl text-center font-black text-lg border-muted-foreground/10" />
                                                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 font-black text-muted-foreground">%</span>
                                                                    </div>
                                                                    <span className="text-xs font-bold text-muted-foreground uppercase">от</span>
                                                                    <Select value={bonus.source || 'total'} onValueChange={value => updateBonus(index, 'source', value as any)}>
                                                                        <SelectTrigger className="flex-1 h-12 rounded-xl border-muted-foreground/10 bg-white font-bold text-sm outline-none focus:ring-0 focus:border-purple-500">
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
                                                            {bonus.type === 'fixed' && <div className="relative max-w-xs group"><Input type="number" value={bonus.amount} onChange={e => updateBonus(index, 'amount', parseFloat(e.target.value) || 0)} className="h-14 rounded-2xl border-muted-foreground/10 bg-muted/5 pl-6 pr-12 text-xl font-black text-slate-700" /><span className="absolute right-6 top-1/2 -translate-y-1/2 text-sm font-black text-muted-foreground">₽</span></div>}

                                                            {bonus.type === 'leaderboard_rank' && (
                                                                <div className="space-y-4">
                                                                    <div className="grid grid-cols-3 gap-4">
                                                                        <div className="relative">
                                                                            <Input
                                                                                type="number"
                                                                                value={bonus.rank_from ?? 1}
                                                                                onChange={e => updateBonus(index, 'rank_from', Math.max(1, parseInt(e.target.value || '1', 10)))}
                                                                                className="h-12 rounded-xl text-center font-black border-amber-200 bg-amber-50"
                                                                            />
                                                                            <span className="absolute left-3 -top-2 bg-white px-1 text-[8px] font-black text-muted-foreground uppercase rounded">С места</span>
                                                                        </div>
                                                                        <div className="relative">
                                                                            <Input
                                                                                type="number"
                                                                                value={bonus.rank_to ?? bonus.rank_from ?? 1}
                                                                                onChange={e => updateBonus(index, 'rank_to', Math.max(1, parseInt(e.target.value || '1', 10)))}
                                                                                className="h-12 rounded-xl text-center font-black border-amber-200 bg-amber-50"
                                                                            />
                                                                            <span className="absolute left-3 -top-2 bg-white px-1 text-[8px] font-black text-muted-foreground uppercase rounded">По место</span>
                                                                        </div>
                                                                        <div className="relative">
                                                                            <Input
                                                                                type="number"
                                                                                value={bonus.amount ?? 0}
                                                                                onChange={e => updateBonus(index, 'amount', parseFloat(e.target.value) || 0)}
                                                                                className="h-12 rounded-xl text-center font-black border-amber-200 bg-white"
                                                                            />
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
                                                                                        <Input type="number" value={thresh.from} onChange={e => { const newT = [...bonus.thresholds!]; newT[tIdx] = { ...thresh, from: parseFloat(e.target.value) }; updateBonus(index, 'thresholds', newT); }} className="h-9 rounded-lg border-none text-xs font-bold" />
                                                                                        <span className="absolute left-2 -top-2 bg-white px-1 text-[8px] font-black text-muted-foreground uppercase rounded">{bonus.mode === 'MONTH' ? 'От ₽ за месяц' : 'Порог (от ₽)'}</span>
                                                                                    </div>
                                                                                </div>
                                                                                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-30" />
                                                                                <div className="relative w-24">
                                                                                    {(!bonus.reward_type || bonus.reward_type === 'PERCENT') ? (
                                                                                        <>
                                                                                            <Input type="number" value={thresh.percent} onChange={e => { const newT = [...bonus.thresholds!]; newT[tIdx] = { ...thresh, percent: parseFloat(e.target.value) }; updateBonus(index, 'thresholds', newT); }} className="h-9 rounded-xl border-emerald-200 bg-emerald-50 text-emerald-700 font-black text-xs text-center" />
                                                                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-emerald-400">%</span>
                                                                                        </>
                                                                                    ) : (
                                                                                        <>
                                                                                            <Input type="number" value={thresh.amount} onChange={e => { const newT = [...bonus.thresholds!]; newT[tIdx] = { ...thresh, amount: parseFloat(e.target.value) }; updateBonus(index, 'thresholds', newT); }} className="h-9 rounded-xl border-purple-200 bg-purple-50 text-purple-700 font-black text-xs text-center" />
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
                                                                                            <Input type="number" value={thresh.min_score} onChange={e => { const newT = [...(bonus.checklist_thresholds || [])]; newT[thIdx] = { ...thresh, min_score: parseFloat(e.target.value) || 0 }; updateBonus(index, 'checklist_thresholds', newT); }} className="h-9 rounded-lg border-none text-xs font-bold" />
                                                                                            <span className="absolute left-2 -top-2 bg-white px-1 text-[8px] font-black text-muted-foreground uppercase rounded">Оценка выше %</span>
                                                                                        </div>
                                                                                    </div>
                                                                                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-30" />
                                                                                    <div className="relative w-24">
                                                                                        <Input type="number" value={thresh.amount} onChange={e => { const newT = [...(bonus.checklist_thresholds || [])]; newT[thIdx] = { ...thresh, amount: parseFloat(e.target.value) || 0 }; updateBonus(index, 'checklist_thresholds', newT); }} className="h-9 rounded-xl border-purple-200 bg-white font-black text-xs text-center" />
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
                                                                                <Input 
                                                                                    type="number" 
                                                                                    value={bonus.amount} 
                                                                                    onChange={e => updateBonus(index, 'amount', parseFloat(e.target.value) || 0)} 
                                                                                    className="h-10 rounded-xl pl-4 pr-10 font-black text-indigo-700 border-indigo-200 bg-white" 
                                                                                />
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
                                                                                                <Input type="number" value={thresh.from_percent} onChange={e => {
                                                                                                    const newT = [...bonus.efficiency_thresholds!];
                                                                                                    newT[thIdx] = { ...thresh, from_percent: parseFloat(e.target.value) };
                                                                                                    updateBonus(index, 'efficiency_thresholds', newT);
                                                                                                }} className="h-9 rounded-lg border-none text-xs font-bold" />
                                                                                                <span className="absolute left-2 -top-2 bg-white px-1 text-[8px] font-black text-muted-foreground uppercase rounded">Выполнено {'>'} %</span>
                                                                                            </div>
                                                                                        </div>
                                                                                        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-30" />
                                                                                        <div className="relative w-28">
                                                                                            <Input 
                                                                                                type="number" 
                                                                                                value={thresh.amount} 
                                                                                                onChange={e => {
                                                                                                    const newT = [...bonus.efficiency_thresholds!];
                                                                                                    newT[thIdx] = { ...thresh, amount: parseFloat(e.target.value) };
                                                                                                    updateBonus(index, 'efficiency_thresholds', newT);
                                                                                                }} 
                                                                                                className="h-9 rounded-xl border-indigo-200 bg-indigo-50 text-indigo-700 font-black text-xs text-center" 
                                                                                            />
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
                                                                            <Input
                                                                                type="number"
                                                                                value={bonus.overdue_tolerance_days ?? 0}
                                                                                onChange={e => updateBonus(index, 'overdue_tolerance_days', parseInt(e.target.value || '0', 10))}
                                                                                className="h-10 rounded-xl"
                                                                            />
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
                                                                            <Input
                                                                                type="number"
                                                                                value={bonus.overdue_penalty_amount ?? 0}
                                                                                onChange={e => updateBonus(index, 'overdue_penalty_amount', parseFloat(e.target.value || '0'))}
                                                                                className="h-10 rounded-xl"
                                                                            />
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
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}
