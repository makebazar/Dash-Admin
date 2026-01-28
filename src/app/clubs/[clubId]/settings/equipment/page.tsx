"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import {
    Settings,
    ChevronLeft,
    Save,
    Loader2,
    ShieldCheck,
    Coins,
    Target,
    Zap,
    Scale,
    CheckCircle2,
    ToggleLeft,
    Monitor
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface KPIConfig {
    enabled: boolean
    assignment_mode: 'FIXED' | 'FREE' | 'BOTH'
    points_per_cleaning: number
    points_per_issue_resolved: number
    bonus_per_point: number
    on_time_multiplier: number
    late_penalty_multiplier: number
    include_in_salary: boolean
}

export default function EquipmentSettings() {
    const { clubId } = useParams()
    const [config, setConfig] = useState<KPIConfig | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)

    const fetchConfig = useCallback(async () => {
        setIsLoading(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/settings/equipment-kpi`)
            const data = await res.json()
            if (res.ok) setConfig(data)
        } catch (error) {
            console.error("Error fetching KPI config:", error)
        } finally {
            setIsLoading(false)
        }
    }, [clubId])

    useEffect(() => {
        fetchConfig()
    }, [fetchConfig])

    const handleSave = async () => {
        if (!config) return
        setIsSaving(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/settings/equipment-kpi`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(config)
            })
            if (res.ok) {
                // Show success or toast
            }
        } catch (error) {
            console.error("Error saving KPI config:", error)
        } finally {
            setIsSaving(false)
        }
    }

    if (isLoading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="p-8 space-y-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex flex-col gap-4">
                <Link href={`/clubs/${clubId}/equipment`} className="flex items-center text-sm text-muted-foreground hover:text-foreground">
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    К оборудованию
                </Link>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">⚙️ Настройки обслуживания</h1>
                        <p className="text-muted-foreground mt-1">Параметры KPI, бонусов и логика назначения задач</p>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                {/* Main Enable Switch */}
                <Card className={cn(
                    "border-2 transition-all duration-300",
                    config?.enabled ? "border-primary/20 bg-primary/5" : "border-slate-100 bg-slate-50 opacity-80"
                )}>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className={cn(
                                    "p-3 rounded-2xl flex items-center justify-center transition-colors",
                                    config?.enabled ? "bg-primary text-white" : "bg-slate-200 text-slate-500"
                                )}>
                                    <Target className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold">Оценка качества обслуживания</h3>
                                    <p className="text-sm text-muted-foreground">Включите систему KPI для учета выполненных чисток в зарплате</p>
                                </div>
                            </div>
                            <Switch
                                checked={config?.enabled}
                                onCheckedChange={(val) => setConfig(prev => prev ? ({ ...prev, enabled: val }) : null)}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Assignment Logic */}
                <Card className="border-none shadow-sm overflow-hidden">
                    <CardHeader className="bg-slate-50/50">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Zap className="h-4 w-4 text-amber-500" />
                            Логика назначения задач
                        </CardTitle>
                        <CardDescription>Как распределяются задачи между сотрудниками</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {[
                                { id: 'FIXED', title: 'Фиксированное', desc: 'За конкретным ПК закрепляется сотрудник' },
                                { id: 'FREE', title: 'Свободный пул', desc: 'Сотрудники сами разбирают задачи' },
                                { id: 'BOTH', title: 'Гибридное', desc: 'Оба варианта доступны одновременно' }
                            ].map((mode) => (
                                <div
                                    key={mode.id}
                                    onClick={() => setConfig(prev => prev ? ({ ...prev, assignment_mode: mode.id as any }) : null)}
                                    className={cn(
                                        "p-4 rounded-xl border-2 cursor-pointer transition-all hover:border-primary/40",
                                        config?.assignment_mode === mode.id ? "border-primary bg-primary/5 shadow-md" : "border-slate-100 bg-white"
                                    )}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="font-bold text-sm">{mode.title}</h4>
                                        {config?.assignment_mode === mode.id && <CheckCircle2 className="h-4 w-4 text-primary" />}
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-relaxed">{mode.desc}</p>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* KPI Rates */}
                <Card className="border-none shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Coins className="h-4 w-4 text-blue-500" />
                            Стоимость работ
                        </CardTitle>
                        <CardDescription>Баллы и бонусы за выполнение задач</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Баллы за чистку единицы</Label>
                                    <Input
                                        type="number"
                                        value={config?.points_per_cleaning}
                                        onChange={(e) => setConfig(prev => prev ? ({ ...prev, points_per_cleaning: parseFloat(e.target.value) }) : null)}
                                    />
                                    <p className="text-[10px] text-muted-foreground">Кол-во баллов за одну успешно выполненную задачу по чистке.</p>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Баллы за решение проблемы</Label>
                                    <Input
                                        type="number"
                                        value={config?.points_per_issue_resolved}
                                        onChange={(e) => setConfig(prev => prev ? ({ ...prev, points_per_issue_resolved: parseFloat(e.target.value) }) : null)}
                                    />
                                    <p className="text-[10px] text-muted-foreground">За решение тикета/инцидента с оборудованием.</p>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Выплата за 1 балл (₽)</Label>
                                    <div className="relative">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₽</div>
                                        <Input
                                            className="pl-7"
                                            type="number"
                                            value={config?.bonus_per_point}
                                            onChange={(e) => setConfig(prev => prev ? ({ ...prev, bonus_per_point: parseFloat(e.target.value) }) : null)}
                                        />
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">Конвертация баллов в реальные деньги при расчете зп.</p>
                                </div>
                                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                                    <div className="space-y-0.5">
                                        <Label className="text-sm font-bold">Включать в зарплату</Label>
                                        <p className="text-[10px] text-muted-foreground">Автоматически добавлять сумму в расчет</p>
                                    </div>
                                    <Switch
                                        checked={config?.include_in_salary}
                                        onCheckedChange={(val) => setConfig(prev => prev ? ({ ...prev, include_in_salary: val }) : null)}
                                    />
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Deadlines & Penalties */}
                <Card className="border-none shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Scale className="h-4 w-4 text-rose-500" />
                            Дисциплина и сроки
                        </CardTitle>
                        <CardDescription>Множители для поощрения своевременного выполнения</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-2">
                                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Множитель вовремя</Label>
                                <Input
                                    type="number"
                                    step="0.1"
                                    value={config?.on_time_multiplier}
                                    onChange={(e) => setConfig(prev => prev ? ({ ...prev, on_time_multiplier: parseFloat(e.target.value) }) : null)}
                                />
                                <p className="text-[10px] text-muted-foreground">Коэффициент если задача выполнена до дедлайна (обычно 1.0).</p>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Множитель за задержку</Label>
                                <Input
                                    type="number"
                                    step="0.1"
                                    value={config?.late_penalty_multiplier}
                                    onChange={(e) => setConfig(prev => prev ? ({ ...prev, late_penalty_multiplier: parseFloat(e.target.value) }) : null)}
                                />
                                <p className="text-[10px] text-muted-foreground">Коэффициент если задача выполнена позже срока (например, 0.5).</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Footer Actions */}
                <div className="flex items-center justify-end pt-4">
                    <Button
                        size="lg"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 min-w-[200px] h-12 shadow-lg shadow-blue-200"
                    >
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Сохранить настройки
                    </Button>
                </div>
            </div>
        </div>
    )
}
