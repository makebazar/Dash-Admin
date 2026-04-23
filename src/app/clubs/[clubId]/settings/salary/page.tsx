"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, Plus, Wallet, Edit, Trash2, Users, Coins, Calculator, TrendingUp, Info, ArrowRight, Clock, ShieldAlert, ClipboardCheck, Wrench, Trophy } from "lucide-react"
import { SalaryScheme, Formula, PeriodBonus } from "@/components/salary/SalarySchemeForm"
import { PageShell } from "@/components/layout/PageShell"

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

    const formatFormulaSummary = (f: Formula) => {
        const parts: { label: string, value: string, icon?: any }[] = []

        f.bonuses.forEach(b => {
            const sourceMap: Record<string, string> = { cash: 'нала', card: 'безнала', total: 'выручки' }
            const name = b.name || (b.type === 'percent_revenue' ? `% от ${sourceMap[b.source || 'total']}` : 'Бонус')
            
            if (b.type === 'percent_revenue') {
                parts.push({ label: name, value: `${b.percent}%`, icon: TrendingUp })
            } else if (b.type === 'fixed') {
                parts.push({ label: name, value: `${b.amount}₽`, icon: Coins })

            } else if (b.type === 'progressive_percent') {
                parts.push({ label: name, value: `${b.thresholds?.length || 0} пор.`, icon: TrendingUp })
            } else if (b.type === 'checklist') {
                parts.push({ label: 'Чек-лист', value: `+${b.amount}₽ (> ${b.min_score}%)`, icon: ClipboardCheck })
            } else if (b.type === 'maintenance_kpi') {
                parts.push({ label: 'Обслуживание', value: b.calculation_mode === 'PER_TASK' ? `${b.amount}₽/зад.` : 'Месячный', icon: Wrench })
            } else if (b.type === 'leaderboard_rank') {
                const rankFrom = b.rank_from || 1
                const rankTo = b.rank_to || rankFrom
                parts.push({ label: b.name || 'Рейтинг', value: `${rankFrom}-${rankTo} место`, icon: Trophy })
            } else if (b.type === 'personal_overplan') {
                parts.push({ label: b.name || 'Личный бонус', value: 'план/смена', icon: ShieldAlert })
            }
        })

        return parts
    }

    if (isLoading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
            </div>
        )
    }

    return (
        <PageShell maxWidth="5xl">
            <div className="space-y-8 pb-28 sm:pb-12">
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between mb-8">
                    <div className="min-w-0">
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 truncate">Схемы оплаты</h1>
                        <p className="text-slate-500 text-lg mt-2">Настройте правила расчёта зарплаты для различных должностей</p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:justify-end">
                        <Button asChild className="w-full bg-slate-900 text-white hover:bg-slate-800 sm:w-auto rounded-xl h-11 px-6 font-medium shadow-sm">
                            <Link href={`/clubs/${clubId}/settings/salary/scheme/new`}>
                                <Plus className="mr-2 h-4 w-4" />
                                Создать схему
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>

            {/* Empty State */}
            {schemes.length === 0 ? (
                <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-12 text-center text-slate-500">
                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 mb-6">
                        <Wallet className="h-10 w-10 text-slate-400" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">Схемы пока не созданы</h3>
                    <p className="text-slate-500 text-sm max-w-md mx-auto mb-8">
                        Создайте первую схему оплаты, чтобы система могла автоматически рассчитывать зарплаты ваших сотрудников.
                    </p>
                    <Button asChild className="rounded-xl h-11 px-6 font-medium bg-slate-900 text-white hover:bg-slate-800">
                        <Link href={`/clubs/${clubId}/settings/salary/scheme/new`}>
                            <Plus className="mr-2 h-4 w-4" />
                            Добавить схему
                        </Link>
                    </Button>
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
                    {schemes.map(scheme => {
                        const formulaParts = formatFormulaSummary(scheme.formula)
                        return (
                            <div key={scheme.id} className={`bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 flex flex-col justify-between transition-all hover:shadow-md ${!scheme.is_active ? 'opacity-60 grayscale' : ''}`}>
                                <div>
                                    <div className="flex items-start justify-between mb-6">
                                        <div className="space-y-1 min-w-0 pr-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100">
                                                    <Wallet className="h-6 w-6 text-slate-600" />
                                                </div>
                                                <div className="min-w-0">
                                                    <h3 className="text-xl font-bold text-slate-900 truncate">{scheme.name}</h3>
                                                    {scheme.description && (
                                                        <p className="text-sm text-slate-500 truncate mt-0.5">{scheme.description}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 shrink-0 font-medium px-2.5 py-0.5 rounded-lg">
                                            v{scheme.version || 1}
                                        </Badge>
                                    </div>
                                    {/* Stats Summary */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-muted/20 rounded-2xl p-3 border border-muted-foreground/5">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Ставка</p>
                                            <p className="text-sm font-bold flex items-center gap-1.5">
                                                <Coins className="h-3.5 w-3.5 text-purple-400" />
                                                {scheme.formula.base.type === 'hourly' 
                                                    ? `${scheme.formula.base.amount || scheme.formula.base.day_rate || 0} ₽/ч`
                                                    : `${scheme.formula.base.amount || scheme.formula.base.day_rate || 0} ₽/с`}
                                            </p>
                                        </div>
                                        <div className="bg-muted/20 rounded-2xl p-3 border border-muted-foreground/5">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Сотрудники</p>
                                            <p className="text-sm font-bold flex items-center gap-1.5">
                                                <Users className="h-3.5 w-3.5 text-blue-400" />
                                                {scheme.employee_count || 0} <span className="text-[11px] text-muted-foreground font-medium">чел.</span>
                                            </p>
                                        </div>
                                    </div>

                                    {/* KPI Breakdown */}
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Активные KPI и бонусы</p>
                                        <div className="bg-white rounded-2xl border border-muted-foreground/5 divide-y divide-muted-foreground/5 overflow-hidden">
                                            {formulaParts.map((part, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-3 hover:bg-muted/10 transition-colors">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="p-1.5 rounded-lg bg-slate-50 text-slate-400 group-hover:bg-white group-hover:text-purple-500 transition-colors">
                                                            {part.icon && <part.icon className="h-3.5 w-3.5" />}
                                                        </div>
                                                        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-tight">{part.label}</span>
                                                    </div>
                                                </div>
                                            ))}
                                            {scheme.period_bonuses && scheme.period_bonuses.length > 0 && scheme.period_bonuses.map((pb, idx) => (
                                                <div key={`pb-${idx}`} className="flex items-center justify-between p-3 hover:bg-muted/10 transition-colors">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-400 group-hover:bg-white group-hover:text-emerald-500 transition-colors">
                                                            <TrendingUp className="h-3.5 w-3.5" />
                                                        </div>
                                                        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-tight">{pb.name}</span>
                                                    </div>
                                                </div>
                                            ))}
                                            {(formulaParts.length === 0 && (!scheme.period_bonuses || scheme.period_bonuses.length === 0)) && (
                                                <div className="p-4 text-center text-xs text-muted-foreground italic font-medium">
                                                    KPI не настроены
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    </div>
                                <div className="flex items-center gap-2 pt-6 border-t border-slate-100 mt-auto">
                                    <Button asChild variant="outline" className="flex-1 rounded-xl h-11 font-medium border-slate-200 text-slate-700 hover:bg-slate-50">
                                        <Link href={`/clubs/${clubId}/settings/salary/scheme/${scheme.id}`}>
                                            <Edit className="mr-2 h-4 w-4" />
                                            Настроить
                                        </Link>
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-11 w-11 shrink-0 rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                                        onClick={() => handleDelete(scheme)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
            </div>
        </PageShell>
    )
}
