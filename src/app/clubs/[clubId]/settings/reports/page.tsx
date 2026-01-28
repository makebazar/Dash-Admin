"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Loader2, Plus, GripVertical, Save, Trash2, ArrowLeft } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

interface SystemMetric {
    id: number
    key: string
    label: string
    type: string
    category: string
    description: string
    is_required: boolean
}

interface TemplateField {
    metric_key: string
    custom_label: string // Владелец может переименовать "Cash" в "Касса Бар"
    is_required: boolean
    field_type: 'INCOME' | 'EXPENSE' | 'OTHER'
    show_in_stats: boolean
    show_for_employee?: boolean
    id?: string // for frontend dnd
}

export default function ReportBuilderPage({ params }: { params: Promise<{ clubId: string }> }) {
    const router = useRouter()
    const [clubId, setClubId] = useState('')
    const [systemMetrics, setSystemMetrics] = useState<SystemMetric[]>([])
    const [selectedFields, setSelectedFields] = useState<TemplateField[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        params.then(p => {
            setClubId(p.clubId)
            fetchData(p.clubId)
        })
    }, [params])

    const fetchData = async (id: string) => {
        try {
            const res = await fetch(`/api/clubs/${id}/settings/reports`)
            const data = await res.json()

            if (res.ok && Array.isArray(data.systemMetrics)) {
                setSystemMetrics(data.systemMetrics)

                if (data.currentTemplate && Array.isArray(data.currentTemplate.schema)) {
                    setSelectedFields(data.currentTemplate.schema)
                } else {
                    // Default fields if no template exists
                    const defaults = data.systemMetrics
                        .filter((m: SystemMetric) => m.is_required)
                        .map((m: SystemMetric) => ({
                            metric_key: m.key,
                            custom_label: m.label,
                            is_required: true,
                            field_type: 'OTHER',
                            show_in_stats: true
                        }))
                    setSelectedFields(defaults)
                }
            }
        } catch (error) {
            console.error(error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleAddField = (metric: SystemMetric) => {
        if (selectedFields.find(f => f.metric_key === metric.key)) return

        setSelectedFields([
            ...selectedFields,
            {
                metric_key: metric.key,
                custom_label: metric.label,
                is_required: metric.is_required,
                field_type: 'OTHER',
                show_in_stats: true
            }
        ])
    }

    const handleRemoveField = (index: number) => {
        const newFields = [...selectedFields]
        newFields.splice(index, 1)
        setSelectedFields(newFields)
    }

    const handleUpdateField = (index: number, key: keyof TemplateField, value: any) => {
        const newFields = [...selectedFields]
        newFields[index] = { ...newFields[index], [key]: value }
        setSelectedFields(newFields)
    }

    const handleSave = async () => {
        setIsSaving(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/settings/reports`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ schema: selectedFields }),
            })

            if (res.ok) {
                alert('Шаблон отчета сохранен!')
            } else {
                alert('Ошибка сохранения')
            }
        } catch (error) {
            console.error(error)
            alert('Ошибка сохранения')
        } finally {
            setIsSaving(false)
        }
    }

    const getMetricInfo = (key: string) => systemMetrics.find(m => m.key === key)

    if (isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>

    return (
        <div className="min-h-screen bg-background p-8">
            <div className="mx-auto max-w-5xl">
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <Link href={`/dashboard`} className="mb-2 flex items-center text-sm text-muted-foreground hover:text-foreground">
                            <ArrowLeft className="mr-1 h-4 w-4" /> Назад в дашборд
                        </Link>
                        <h1 className="text-3xl font-bold">Конструктор отчета смены</h1>
                        <p className="text-muted-foreground">Настройте, какие данные сотрудники должны заполнять при закрытии смены</p>
                    </div>
                    <Button onClick={handleSave} disabled={isSaving} className="bg-purple-600 hover:bg-purple-700">
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Сохранить шаблон
                    </Button>
                </div>

                <div className="grid gap-8 md:grid-cols-12">

                    {/* Left: Current Template */}
                    <div className="md:col-span-7">
                        <Card>
                            <CardHeader>
                                <CardTitle>Структура вашего отчета</CardTitle>
                                <CardDescription>Сотрудник увидит эти поля в таком порядке</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {selectedFields.length === 0 && (
                                    <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
                                        Перетащите или добавьте метрики из списка справа
                                    </div>
                                )}

                                {selectedFields.map((field, index) => {
                                    const metric = getMetricInfo(field.metric_key)
                                    if (!metric) return null

                                    return (
                                        <div key={index} className="flex items-start gap-3 rounded-lg border bg-card p-4 transition-all hover:border-sidebar-primary/50 shadow-sm">
                                            <div className="mt-3 cursor-move text-muted-foreground">
                                                <GripVertical className="h-5 w-5" />
                                            </div>

                                            <div className="flex-1 space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <Badge variant="outline" className="text-xs">{metric.category}</Badge>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 w-6 p-0 text-muted-foreground hover:text-red-500"
                                                        onClick={() => handleRemoveField(index)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>

                                                <div>
                                                    <Label className="text-xs text-muted-foreground mb-1 block">Название для сотрудника</Label>
                                                    <Input
                                                        value={field.custom_label}
                                                        onChange={(e) => handleUpdateField(index, 'custom_label', e.target.value)}
                                                        className="font-medium bg-background"
                                                    />
                                                </div>

                                                <div className="space-y-4">
                                                    <div className="flex flex-col gap-1.5">
                                                        <Label className="text-[10px] uppercase text-muted-foreground">Категория для расчётов</Label>
                                                        <div className="flex bg-muted rounded-md p-1 scale-90 origin-left w-fit">
                                                            <button
                                                                onClick={() => handleUpdateField(index, 'field_type', 'INCOME')}
                                                                className={`px-3 py-1 text-[10px] font-medium rounded-sm transition-all ${field.field_type === 'INCOME'
                                                                    ? 'bg-green-500 text-white shadow-sm'
                                                                    : 'hover:bg-background/50 text-muted-foreground'
                                                                    }`}
                                                            >
                                                                Доход
                                                            </button>
                                                            <button
                                                                onClick={() => handleUpdateField(index, 'field_type', 'EXPENSE')}
                                                                className={`px-3 py-1 text-[10px] font-medium rounded-sm transition-all ${field.field_type === 'EXPENSE'
                                                                    ? 'bg-orange-500 text-white shadow-sm'
                                                                    : 'hover:bg-background/50 text-muted-foreground'
                                                                    }`}
                                                            >
                                                                Расход
                                                            </button>
                                                            <button
                                                                onClick={() => handleUpdateField(index, 'field_type', 'OTHER')}
                                                                className={`px-3 py-1 text-[10px] font-medium rounded-sm transition-all ${field.field_type === 'OTHER' || !field.field_type
                                                                    ? 'bg-background text-foreground shadow-sm'
                                                                    : 'hover:bg-background/50 text-muted-foreground'
                                                                    }`}
                                                            >
                                                                Другое
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-4 border-foreground/5">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <div className="flex flex-col">
                                                                <Label htmlFor={`emp-${index}`} className="text-sm">Сотруднику</Label>
                                                                <span className="text-[10px] text-muted-foreground">Показывать в истории</span>
                                                            </div>
                                                            <Switch
                                                                id={`emp-${index}`}
                                                                checked={field.show_for_employee !== false}
                                                                onCheckedChange={(checked) => handleUpdateField(index, 'show_for_employee', checked)}
                                                            />
                                                        </div>

                                                        <div className="flex items-center justify-between gap-2">
                                                            <div className="flex flex-col">
                                                                <Label htmlFor={`stats-${index}`} className="text-sm">В сводке</Label>
                                                                <span className="text-[10px] text-muted-foreground">Показывать в админке</span>
                                                            </div>
                                                            <Switch
                                                                id={`stats-${index}`}
                                                                checked={field.show_in_stats}
                                                                onCheckedChange={(checked) => handleUpdateField(index, 'show_in_stats', checked)}
                                                            />
                                                        </div>

                                                        <div className="flex items-center justify-between gap-2 sm:col-span-2">
                                                            <Label htmlFor={`req-${index}`} className="text-sm">Обязательное поле</Label>
                                                            <Switch
                                                                id={`req-${index}`}
                                                                checked={field.is_required}
                                                                onCheckedChange={(checked) => handleUpdateField(index, 'is_required', checked)}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right: Available Metrics */}
                    <div className="md:col-span-5">
                        <Card className="sticky top-8">
                            <CardHeader>
                                <CardTitle>Библиотека метрик</CardTitle>
                                <CardDescription>Нажмите +, чтобы добавить в отчет</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-6">
                                    {['FINANCE', 'OPERATIONS', 'MARKETING'].map(category => {
                                        const metrics = systemMetrics.filter(m => m.category === category)
                                        if (metrics.length === 0) return null

                                        return (
                                            <div key={category}>
                                                <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{category}</h4>
                                                <div className="space-y-2">
                                                    {metrics.map(metric => {
                                                        const isAdded = selectedFields.some(f => f.metric_key === metric.key)
                                                        return (
                                                            <button
                                                                key={metric.id}
                                                                onClick={() => handleAddField(metric)}
                                                                disabled={isAdded}
                                                                className={`w-full flex items-center justify-between rounded-md border p-3 text-left transition-all ${isAdded
                                                                    ? 'bg-muted opacity-50 cursor-not-allowed'
                                                                    : 'bg-card hover:bg-accent hover:text-accent-foreground'
                                                                    }`}
                                                            >
                                                                <div>
                                                                    <div className="font-medium text-sm">{metric.label}</div>
                                                                    <div className="text-xs text-muted-foreground">{metric.description}</div>
                                                                </div>
                                                                {!isAdded && <Plus className="h-4 w-4 text-primary" />}
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    )
}
