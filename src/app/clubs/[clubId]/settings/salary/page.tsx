"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Loader2, Plus, Wallet, Sun, Moon, Percent, Clock, DollarSign, Edit, Trash2, Users } from "lucide-react"

interface Formula {
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

interface Bonus {
    type: 'percent_revenue' | 'fixed' | 'tiered' | 'progressive_percent' | 'penalty'
    name?: string
    // For percent_revenue and progressive_percent
    source?: 'cash' | 'card' | 'total'
    percent?: number
    // For fixed and penalty
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
    }[]
    // For penalty
    penalty_reason?: string
}

interface PeriodBonus {
    id: string
    name: string
    metric_key: string

    // Type of KPI
    type: 'TARGET' | 'PROGRESSIVE' // TARGET = fixed target per shift, PROGRESSIVE = thresholds

    // For TARGET
    target_per_shift: number
    reward_type: 'FIXED' | 'PERCENT'
    reward_value: number

    // For PROGRESSIVE
    thresholds?: { from: number; percent: number }[]
}

interface SalaryScheme {
    id: number
    name: string
    description: string
    is_active: boolean
    version: number
    formula: Formula
    period_bonuses?: PeriodBonus[]
    employee_count: number
    created_at: string
}

const defaultFormula: Formula = {
    base: { type: 'hourly', amount: 500 },
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

export default function SalarySettingsPage({ params }: { params: Promise<{ clubId: string }> }) {
    const [clubId, setClubId] = useState('')
    const [schemes, setSchemes] = useState<SalaryScheme[]>([])
    const [reportMetrics, setReportMetrics] = useState<ReportMetric[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingScheme, setEditingScheme] = useState<SalaryScheme | null>(null)
    const [isSaving, setIsSaving] = useState(false)

    // Form state
    const [schemeName, setSchemeName] = useState('')
    const [schemeDescription, setSchemeDescription] = useState('')
    const [formula, setFormula] = useState<Formula>(defaultFormula)
    const [periodBonuses, setPeriodBonuses] = useState<PeriodBonus[]>([])

    useEffect(() => {
        params.then(p => {
            setClubId(p.clubId)
            fetchSchemes(p.clubId)
            fetchReportMetrics(p.clubId)
        })
    }, [params])

    const fetchSchemes = async (id: string) => {
        try {
            const res = await fetch(`/api/clubs/${id}/salary-schemes`)
            const data = await res.json()
            if (res.ok) {
                setSchemes(data.schemes || [])
            }
        } catch (error) {
            console.error('Error:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const fetchReportMetrics = async (id: string) => {
        try {
            const res = await fetch(`/api/clubs/${id}/settings/reports`)
            const data = await res.json()
            if (res.ok && data.systemMetrics) {
                // Filter to numeric-type metrics that can be used for bonuses
                // DB types: MONEY, NUMBER, DECIMAL, TEXT, BOOLEAN
                const numericMetrics = data.systemMetrics.filter(
                    (m: ReportMetric) => ['MONEY', 'NUMBER', 'DECIMAL', 'currency', 'number'].includes(m.type.toUpperCase()) || m.type.toLowerCase() === 'money'
                )
                setReportMetrics(numericMetrics)
            }
        } catch (error) {
            console.error('Error fetching metrics:', error)
        }
    }

    const openCreateModal = () => {
        setEditingScheme(null)
        setSchemeName('')
        setSchemeDescription('')
        setFormula(defaultFormula)
        setPeriodBonuses([])
        setIsModalOpen(true)
    }

    const openEditModal = (scheme: SalaryScheme) => {
        setEditingScheme(scheme)
        setSchemeName(scheme.name)
        setSchemeDescription(scheme.description || '')
        setFormula(scheme.formula || defaultFormula)
        setPeriodBonuses(scheme.period_bonuses || [])
        setIsModalOpen(true)
    }

    const handleSave = async () => {
        if (!schemeName.trim()) {
            alert('Введите название схемы')
            return
        }

        setIsSaving(true)

        try {
            const url = editingScheme
                ? `/api/clubs/${clubId}/salary-schemes/${editingScheme.id}`
                : `/api/clubs/${clubId}/salary-schemes`

            const res = await fetch(url, {
                method: editingScheme ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: schemeName,
                    description: schemeDescription,
                    formula,
                    period_bonuses: periodBonuses
                })
            })

            if (res.ok) {
                setIsModalOpen(false)
                fetchSchemes(clubId)
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

    const handleDelete = async (scheme: SalaryScheme) => {
        if (!confirm(`Удалить схему "${scheme.name}"? Назначения сотрудникам будут сняты.`)) return

        try {
            const res = await fetch(`/api/clubs/${clubId}/salary-schemes/${scheme.id}`, {
                method: 'DELETE'
            })
            if (res.ok) {
                fetchSchemes(clubId)
            }
        } catch (error) {
            console.error('Error:', error)
        }
    }

    const handleUpdateBaseType = (type: 'hourly' | 'per_shift' | 'none') => {
        setFormula(prev => ({
            ...prev,
            base: {
                ...prev.base,
                type,
                amount: type !== 'none' ? (prev.base.amount || (type === 'per_shift' ? 2000 : 500)) : undefined,
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
                newBonus = { type: 'percent_revenue', name: 'Процент от выручки', source: 'total', percent: 5 }
                break
            case 'fixed':
                newBonus = { type: 'fixed', name: 'Фикс бонус', amount: 500 }
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
                    ]
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
                    ]
                }
                break
            case 'penalty':
                newBonus = { type: 'penalty', name: 'Штраф', amount: 500, penalty_reason: 'Опоздание' }
                break
            default:
                newBonus = { type: 'fixed', name: 'Бонус', amount: 500 }
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
            type: type, // Fixed: Added type property
            target_per_shift: 5000,
            reward_type: 'FIXED',
            reward_value: 1000,
            thresholds: type === 'PROGRESSIVE' ? [{ from: 30000, percent: 3 }] : undefined
        }
        setPeriodBonuses([...periodBonuses, newBonus])
    }

    const removePeriodBonus = (index: number) => {
        setPeriodBonuses(prev => prev.filter((_, i) => i !== index))
    }

    const updatePeriodBonus = (index: number, field: keyof PeriodBonus, value: any) => {
        setPeriodBonuses(prev => prev.map((b, i) => i === index ? { ...b, [field]: value } : b))
    }

    const formatPeriodBonusesSummary = (bonuses?: PeriodBonus[]) => {
        if (!bonuses || bonuses.length === 0) return null
        return bonuses.map(b => `${b.name}: цель ${b.target_per_shift}/смена -> ${b.reward_type === 'PERCENT' ? `${b.reward_value}%` : `${b.reward_value}₽`}`).join('; ')
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
        <div className="p-8 space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Схемы оплаты</h1>
                    <p className="text-muted-foreground">Настройте формулы расчёта зарплаты для сотрудников</p>
                </div>
                <Button onClick={openCreateModal} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Новая схема
                </Button>
            </div>

            {/* Schemes Grid */}
            {schemes.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <Wallet className="h-12 w-12 text-muted-foreground/30 mb-4" />
                        <h3 className="text-lg font-medium mb-2">Нет схем оплаты</h3>
                        <p className="text-muted-foreground text-sm mb-4">Создайте первую схему для расчёта зарплат</p>
                        <Button onClick={openCreateModal} variant="outline" className="gap-2">
                            <Plus className="h-4 w-4" />
                            Создать схему
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {schemes.map(scheme => (
                        <Card key={scheme.id} className={`relative ${!scheme.is_active ? 'opacity-50' : ''}`}>
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <CardTitle className="text-lg">{scheme.name}</CardTitle>
                                        {scheme.description && (
                                            <CardDescription className="mt-1">{scheme.description}</CardDescription>
                                        )}
                                    </div>
                                    <Badge variant="outline" className="text-xs">
                                        v{scheme.version || 1}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="bg-muted/50 rounded-lg p-3 text-sm">
                                    {formatFormulaSummary(scheme.formula)}
                                    {scheme.period_bonuses && scheme.period_bonuses.length > 0 && (
                                        <div className="mt-2 pt-2 border-t border-border/10 text-xs text-muted-foreground flex gap-2 items-center">
                                            <Badge variant="secondary" className="text-[10px] h-4 px-1">KPI</Badge>
                                            {formatPeriodBonusesSummary(scheme.period_bonuses)}
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-1 text-muted-foreground">
                                        <Users className="h-4 w-4" />
                                        <span>{scheme.employee_count || 0} сотр.</span>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => openEditModal(scheme)}
                                        >
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 hover:text-red-500"
                                            onClick={() => handleDelete(scheme)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Create/Edit Modal */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {editingScheme ? 'Редактирование схемы' : 'Новая схема оплаты'}
                        </DialogTitle>
                        <DialogDescription>
                            {editingScheme
                                ? 'При изменении формулы создаётся новая версия. Старые расчёты не изменятся.'
                                : 'Настройте формулу расчёта зарплаты'
                            }
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        {/* Basic Info */}
                        <div className="grid grid-cols-2 gap-4">
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
                        </div>

                        {/* Base Rate */}
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <DollarSign className="h-4 w-4" />
                                    Базовая ставка
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

                        {/* Bonuses */}
                        <Card>
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Percent className="h-4 w-4" />
                                        Бонусы и штрафы
                                    </CardTitle>
                                </div>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    <Button type="button" variant="outline" size="sm" onClick={() => addBonus('percent_revenue')}>
                                        + % от выручки
                                    </Button>
                                    <Button type="button" variant="outline" size="sm" onClick={() => addBonus('fixed')}>
                                        + Фикс бонус
                                    </Button>
                                    <Button type="button" variant="outline" size="sm" onClick={() => addBonus('tiered')}>
                                        + KPI-ступени
                                    </Button>
                                    <Button type="button" variant="outline" size="sm" onClick={() => addBonus('progressive_percent')}>
                                        + Прогрессия %
                                    </Button>
                                    <Button type="button" variant="outline" size="sm" onClick={() => addPeriodBonus('TARGET')}>
                                        + KPI (План)
                                    </Button>
                                    <Button type="button" variant="outline" size="sm" onClick={() => addPeriodBonus('PROGRESSIVE')}>
                                        + KPI (Прогрессия)
                                    </Button>
                                    <Button type="button" variant="outline" size="sm" className="text-red-500 hover:text-red-600" onClick={() => addBonus('penalty')}>
                                        + Штраф
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {formula.bonuses.length === 0 && periodBonuses.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-4">
                                        Нет бонусов. Выберите тип выше, чтобы добавить.
                                    </p>
                                ) : (
                                    <div className="space-y-4">
                                        {formula.bonuses.map((bonus, index) => (
                                            <div key={index} className={`rounded-lg p-4 border ${bonus.type === 'penalty' ? 'border-red-500/30 bg-red-500/5' : 'bg-muted/50'}`}>
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className="flex items-center gap-3 flex-1">
                                                        <Badge variant="outline" className="text-xs shrink-0">
                                                            {bonus.type === 'percent_revenue' && '% от выручки'}
                                                            {bonus.type === 'fixed' && 'Фикс бонус'}
                                                            {bonus.type === 'tiered' && 'KPI-ступени'}
                                                            {bonus.type === 'progressive_percent' && 'Прогрессия %'}
                                                            {bonus.type === 'penalty' && 'Штраф'}
                                                        </Badge>
                                                        <Input
                                                            value={bonus.name || ''}
                                                            onChange={(e) => updateBonus(index, 'name', e.target.value)}
                                                            className="h-8 text-sm max-w-[250px] bg-background"
                                                            placeholder="Название (например: Премия за бар)"
                                                        />
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 hover:text-red-500"
                                                        onClick={() => removeBonus(index)}
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
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
                                                            <span className="text-sm">Источник:</span>
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
                                                            <span className="text-sm">Источник:</span>
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
                                                        <p className="text-xs text-muted-foreground mb-2">
                                                            Процент начисляется от суммы сверх порога
                                                        </p>
                                                        {bonus.thresholds.map((threshold, tIndex) => (
                                                            <div key={tIndex} className="flex items-center gap-2 text-sm">
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
                                            </div>
                                        ))}
                                        {periodBonuses.map((bonus, index) => (
                                            <div key={bonus.id} className="rounded-lg p-4 border bg-muted/50">
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className="flex items-center gap-3 flex-1">
                                                        <Badge variant="secondary" className="text-xs shrink-0">
                                                            {bonus.type === 'PROGRESSIVE' ? 'KPI (Прогрессия)' : 'KPI (План)'}
                                                        </Badge>
                                                        <Input
                                                            value={bonus.name}
                                                            onChange={e => updatePeriodBonus(index, 'name', e.target.value)}
                                                            className="h-8 text-sm max-w-[250px] bg-background"
                                                            placeholder="Название (например: План по бару)"
                                                        />
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 hover:text-red-500"
                                                        onClick={() => removePeriodBonus(index)}
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>

                                                <div className="mb-4">
                                                    <Label className="text-xs text-muted-foreground">Показатель</Label>
                                                    <select
                                                        value={bonus.metric_key}
                                                        onChange={e => updatePeriodBonus(index, 'metric_key', e.target.value)}
                                                        className="w-full h-8 mt-1 px-2 rounded-md border border-input bg-background text-sm"
                                                    >
                                                        <option value="total_revenue">Общая выручка</option>
                                                        <option value="cash_income">Выручка (Нал)</option>
                                                        <option value="card_income">Выручка (Карта)</option>
                                                        <option value="total_hours">Часы работы</option>
                                                        {reportMetrics.map(m => (
                                                            <option key={m.key} value={m.key}>{m.label}</option>
                                                        ))}
                                                    </select>
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
                                                                    className="h-8 pr-12"
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
                                                                        className="h-8 pr-8"
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



                        {/* Preview */}
                        <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-lg p-4">
                            <h4 className="font-medium mb-2">Предпросмотр формулы</h4>
                            <p className="text-sm text-muted-foreground">
                                {formatFormulaSummary(formula)}
                            </p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                            Отмена
                        </Button>
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {editingScheme ? 'Сохранить (новая версия)' : 'Создать схему'}
                        </Button>
                    </DialogFooter>
                </DialogContent >
            </Dialog >
        </div >
    )
}
