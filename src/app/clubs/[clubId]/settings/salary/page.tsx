"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, Plus, Wallet, Edit, Trash2, Users } from "lucide-react"
import { SalaryScheme, Formula, PeriodBonus } from "@/components/salary/SalarySchemeForm"

export default function SalarySettingsPage({ params }: { params: Promise<{ clubId: string }> }) {
    const [clubId, setClubId] = useState('')
    const [schemes, setSchemes] = useState<SalaryScheme[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        params.then(p => {
            setClubId(p.clubId)
            fetchSchemes(p.clubId)
        })
    }, [params])

    const fetchSchemes = async (id: string) => {
        try {
            const res = await fetch(`/api/clubs/${id}/salary-schemes`)
            const data = await res.json()
            if (res.ok) {
                setSchemes(Array.isArray(data.schemes) ? data.schemes : [])
            }
        } catch (error) {
            console.error('Error:', error)
        } finally {
            setIsLoading(false)
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
        <div className="p-8 space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Схемы оплаты</h1>
                    <p className="text-muted-foreground">Настройте формулы расчёта зарплаты для сотрудников</p>
                </div>
                <Link href={`/clubs/${clubId}/settings/salary/scheme/new`}>
                    <Button className="gap-2">
                        <Plus className="h-4 w-4" />
                        Новая схема
                    </Button>
                </Link>
            </div>

            {/* Schemes Grid */}
            {schemes.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <Wallet className="h-12 w-12 text-muted-foreground/30 mb-4" />
                        <h3 className="text-lg font-medium mb-2">Нет схем оплаты</h3>
                        <p className="text-muted-foreground text-sm mb-4">Создайте первую схему для расчёта зарплат</p>
                        <Link href={`/clubs/${clubId}/settings/salary/scheme/new`}>
                            <Button variant="outline" className="gap-2">
                                <Plus className="h-4 w-4" />
                                Создать схему
                            </Button>
                        </Link>
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
                                    <div className="mb-2 pb-2 border-b border-border/10">
                                        <span className="text-muted-foreground">Эталон:</span> {scheme.standard_monthly_shifts || 15} смен/мес
                                    </div>
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
                                        <Link href={`/clubs/${clubId}/settings/salary/scheme/${scheme.id}`}>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                            >
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                        </Link>
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
        </div>
    )
}
