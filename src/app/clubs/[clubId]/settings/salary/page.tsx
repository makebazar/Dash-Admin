"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, Plus, Wallet, Edit, Trash2, Users, Coins, Calculator, TrendingUp, Info, ArrowRight, Clock, ShieldAlert, ClipboardCheck, Wrench, Trophy } from "lucide-react"
import { SalaryScheme, Formula, PeriodBonus } from "@/components/salary/SalarySchemeForm"
import { PageShell, PageHeader } from "@/components/layout/PageShell"

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
            <PageHeader
                title="Схемы оплаты"
                description="Настройте правила расчёта зарплаты для различных должностей"
            >
                <Link href={`/clubs/${clubId}/settings/salary/scheme/new`}>
                    <Button className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-6 h-12 rounded-xl shadow-lg shadow-purple-200 gap-2 transition-all hover:scale-[1.02]">
                        <Plus className="h-5 w-5" />
                        Создать схему
                    </Button>
                </Link>
            </PageHeader>

            {/* Empty State */}
            {schemes.length === 0 ? (
                <Card className="border-2 border-dashed border-muted-foreground/10 bg-muted/5 rounded-[2rem]">
                    <CardContent className="flex flex-col items-center justify-center py-24">
                        <div className="h-24 w-24 rounded-[2rem] bg-purple-50 flex items-center justify-center mb-6">
                            <Wallet className="h-12 w-12 text-purple-600 opacity-40" />
                        </div>
                        <h3 className="text-2xl font-black tracking-tight mb-2">Схемы пока не созданы</h3>
                        <p className="text-muted-foreground text-sm max-w-[300px] text-center mb-8 font-medium">
                            Создайте первую схему оплаты, чтобы система могла автоматически рассчитывать зарплаты ваших сотрудников.
                        </p>
                        <Link href={`/clubs/${clubId}/settings/salary/scheme/new`}>
                            <Button variant="outline" className="h-12 px-8 rounded-xl font-bold border-purple-200 text-purple-600 hover:bg-purple-50 gap-2">
                                <Plus className="h-4 w-4" />
                                Добавить схему
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
                    {schemes.map(scheme => {
                        const formulaParts = formatFormulaSummary(scheme.formula)
                        return (
                            <Card key={scheme.id} className={`group border-none shadow-sm hover:shadow-xl transition-all duration-300 rounded-[2rem] overflow-hidden ${!scheme.is_active ? 'opacity-60 grayscale' : ''}`}>
                                <CardHeader className="pb-4 bg-gradient-to-br from-white to-slate-50/50">
                                    <div className="flex items-start justify-between">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <div className="h-10 w-10 rounded-2xl bg-purple-50 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-colors duration-300">
                                                    <Wallet className="h-5 w-5 text-purple-600 group-hover:text-white transition-colors duration-300" />
                                                </div>
                                                <CardTitle className="text-lg font-black tracking-tight">{scheme.name}</CardTitle>
                                            </div>
                                            {scheme.description && (
                                                <CardDescription className="text-[11px] font-medium pl-12 line-clamp-1">{scheme.description}</CardDescription>
                                            )}
                                        </div>
                                        <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest bg-white border-muted-foreground/10 px-2 rounded-lg">
                                            v{scheme.version || 1}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-6 pt-2">
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
                                    <div className="flex gap-2 pt-2">
                                        <Link href={`/clubs/${clubId}/settings/salary/scheme/${scheme.id}`} className="flex-1">
                                            <Button
                                                variant="outline"
                                                className="w-full h-11 rounded-xl font-bold text-xs uppercase tracking-widest border-muted-foreground/10 hover:bg-purple-50 hover:text-purple-600 hover:border-purple-200 gap-2 transition-all"
                                            >
                                                <Edit className="h-3.5 w-3.5" />
                                                Настроить
                                            </Button>
                                        </Link>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-11 w-11 rounded-xl hover:bg-red-50 hover:text-red-500 transition-colors shrink-0 border border-transparent hover:border-red-100"
                                            onClick={() => handleDelete(scheme)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}
        </PageShell>
    )
}
