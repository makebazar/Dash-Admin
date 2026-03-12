"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Loader2, Plus, GripVertical, Save, Trash2, ArrowLeft, Minus, List } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core"
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

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
    field_type: 'INCOME' | 'EXPENSE' | 'EXPENSE_LIST' | 'OTHER'
    show_in_stats: boolean
    show_for_employee?: boolean
    account_id?: number // For INCOME fields - which account to credit
    id: string // for frontend dnd (required for sortable)
}

interface Account {
    id: number
    name: string
    icon: string
    color: string
    account_type: string
}

function SortableField({ 
    field, 
    index, 
    metric, 
    accounts, 
    onUpdate, 
    onRemove 
}: { 
    field: TemplateField
    index: number
    metric: SystemMetric | undefined
    accounts: Account[]
    onUpdate: (index: number, key: keyof TemplateField, value: any) => void
    onRemove: (index: number) => void
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: field.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 0,
        opacity: isDragging ? 0.5 : 1,
    };

    if (!metric) return null;

    return (
        <div 
            ref={setNodeRef} 
            style={style} 
            className={`group relative flex flex-col gap-4 rounded-xl border bg-card p-5 transition-all shadow-sm ${
                isDragging ? 'border-purple-500 shadow-lg' : 'hover:border-purple-200 hover:shadow-md'
            }`}
        >
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div 
                        {...attributes} 
                        {...listeners} 
                        className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-purple-500 transition-colors p-1 -ml-2"
                    >
                        <GripVertical className="h-5 w-5" />
                    </div>
                    <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-purple-600/70">{metric.category}</span>
                            {field.is_required && (
                                <Badge variant="secondary" className="bg-red-50 text-red-600 border-red-100 text-[10px] h-4 px-1.5">
                                    Обязательно
                                </Badge>
                            )}
                        </div>
                        <h3 className="font-semibold text-foreground tracking-tight">{metric.label}</h3>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-full"
                    onClick={() => onRemove(index)}
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                            Название в отчете (как видит сотрудник)
                        </Label>
                        <Input
                            value={field.custom_label}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate(index, 'custom_label', e.target.value)}
                            className="bg-muted/30 border-muted-foreground/10 focus:border-purple-500/50 transition-colors"
                            placeholder="Напр: Касса бар"
                        />
                    </div>

                    <div className="space-y-3">
                        <Label className="text-xs font-medium text-muted-foreground">Тип операции</Label>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 bg-muted/50 p-1 rounded-lg">
                            <button
                                onClick={() => onUpdate(index, 'field_type', 'INCOME')}
                                className={`flex items-center justify-center gap-1.5 py-1.5 text-[10px] lg:text-xs font-medium rounded-md transition-all ${
                                    field.field_type === 'INCOME'
                                        ? 'bg-emerald-500 text-white shadow-sm'
                                        : 'text-muted-foreground hover:bg-background/50'
                                }`}
                            >
                                <Plus className="h-3 w-3" /> Доход
                            </button>
                            <button
                                onClick={() => onUpdate(index, 'field_type', 'EXPENSE')}
                                className={`flex items-center justify-center gap-1.5 py-1.5 text-[10px] lg:text-xs font-medium rounded-md transition-all ${
                                    field.field_type === 'EXPENSE'
                                        ? 'bg-orange-500 text-white shadow-sm'
                                        : 'text-muted-foreground hover:bg-background/50'
                                }`}
                            >
                                <Minus className="h-3 w-3" /> Расход
                            </button>
                            <button
                                onClick={() => onUpdate(index, 'field_type', 'EXPENSE_LIST')}
                                className={`flex items-center justify-center gap-1.5 py-1.5 text-[10px] lg:text-xs font-medium rounded-md transition-all ${
                                    field.field_type === 'EXPENSE_LIST'
                                        ? 'bg-purple-500 text-white shadow-sm'
                                        : 'text-muted-foreground hover:bg-background/50'
                                }`}
                            >
                                <List className="h-3 w-3" /> Список
                            </button>
                            <button
                                onClick={() => onUpdate(index, 'field_type', 'OTHER')}
                                className={`flex items-center justify-center gap-1.5 py-1.5 text-[10px] lg:text-xs font-medium rounded-md transition-all ${
                                    field.field_type === 'OTHER' || !field.field_type
                                        ? 'bg-background text-foreground shadow-sm'
                                        : 'text-muted-foreground hover:bg-background/50'
                                }`}
                            >
                                Другое
                            </button>
                        </div>
                    </div>

                    {(field.field_type === 'INCOME' || field.field_type === 'EXPENSE' || field.field_type === 'EXPENSE_LIST') && (
                        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className={cn(
                                "p-4 rounded-xl border space-y-3",
                                field.field_type === 'INCOME' ? "bg-emerald-50/50 border-emerald-100/50" : "bg-orange-50/50 border-orange-100/50"
                            )}>
                                <div className={cn(
                                    "flex items-center gap-2",
                                    field.field_type === 'INCOME' ? "text-emerald-700" : "text-orange-700"
                                )}>
                                    <Label className="text-[11px] font-bold uppercase tracking-wider">
                                        {field.field_type === 'INCOME' ? "Куда зачислять деньги?" : "Откуда списывать деньги?"}
                                    </Label>
                                </div>
                                <Select
                                    value={field.account_id?.toString()}
                                    onValueChange={(value: string) => onUpdate(index, 'account_id', parseInt(value))}
                                >
                                    <SelectTrigger className={cn(
                                        "bg-background h-10 font-medium hover:border-emerald-300 transition-colors shadow-none",
                                        field.field_type === 'INCOME' ? "border-emerald-200/50" : "border-orange-200/50"
                                    )}>
                                        <SelectValue placeholder="Выберите счёт" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {accounts.map(acc => (
                                            <SelectItem key={acc.id} value={acc.id.toString()}>
                                                <span className="flex items-center gap-2">
                                                    <span className="text-base leading-none">{acc.icon}</span>
                                                    <span>{acc.name}</span>
                                                </span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className={cn(
                                    "text-[10px] leading-relaxed",
                                    field.field_type === 'INCOME' ? "text-emerald-600/70" : "text-orange-600/70"
                                )}>
                                    {field.field_type === 'INCOME' 
                                        ? "Сумма из этого поля будет автоматически добавлена на выбранный баланс."
                                        : "Суммы расходов будут автоматически вычитаться с выбранного баланса."}
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="space-y-4 flex flex-col justify-center">
                    <div className="space-y-3 rounded-xl bg-muted/20 p-4 border border-muted-foreground/5">
                        <div className="flex items-center justify-between group/switch">
                            <div className="space-y-0.5">
                                <Label className="text-sm font-medium cursor-pointer" htmlFor={`emp-${field.id}`}>
                                    Видно сотруднику
                                </Label>
                                <p className="text-[11px] text-muted-foreground">Показывать в истории смен</p>
                            </div>
                            <Switch
                                id={`emp-${field.id}`}
                                checked={field.show_for_employee !== false}
                                onCheckedChange={(checked) => onUpdate(index, 'show_for_employee', checked)}
                                className="data-[state=checked]:bg-purple-600"
                            />
                        </div>

                        <div className="h-px bg-muted-foreground/5" />

                        <div className="flex items-center justify-between group/switch">
                            <div className="space-y-0.5">
                                <Label className="text-sm font-medium cursor-pointer" htmlFor={`stats-${field.id}`}>
                                    В общую статистику
                                </Label>
                                <p className="text-[11px] text-muted-foreground">Использовать в дашборде</p>
                            </div>
                            <Switch
                                id={`stats-${field.id}`}
                                checked={field.show_in_stats}
                                onCheckedChange={(checked) => onUpdate(index, 'show_in_stats', checked)}
                                className="data-[state=checked]:bg-purple-600"
                            />
                        </div>

                        <div className="h-px bg-muted-foreground/5" />

                        <div className="flex items-center justify-between group/switch">
                            <div className="space-y-0.5">
                                <Label className="text-sm font-medium cursor-pointer" htmlFor={`req-${field.id}`}>
                                    Обязательное поле
                                </Label>
                                <p className="text-[11px] text-muted-foreground">Нельзя закрыть смену без заполнения</p>
                            </div>
                            <Switch
                                id={`req-${field.id}`}
                                checked={field.is_required}
                                onCheckedChange={(checked) => onUpdate(index, 'is_required', checked)}
                                className="data-[state=checked]:bg-purple-600"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function ReportBuilderPage({ params }: { params: Promise<{ clubId: string }> }) {
    const router = useRouter()
    const [clubId, setClubId] = useState('')
    const [systemMetrics, setSystemMetrics] = useState<SystemMetric[]>([])
    const [selectedFields, setSelectedFields] = useState<TemplateField[]>([])
    const [accounts, setAccounts] = useState<Account[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

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
                setAccounts(data.accounts || [])

                if (data.currentTemplate && Array.isArray(data.currentTemplate.schema)) {
                    // Ensure all fields have an id for dnd-kit
                    const schema = data.currentTemplate.schema.map((f: any) => ({
                        ...f,
                        id: f.id || `${f.metric_key}-${Math.random().toString(36).substr(2, 9)}`
                    }))
                    setSelectedFields(schema)
                } else {
                    // Default fields if no template exists
                    const defaults = data.systemMetrics
                        .filter((m: SystemMetric) => m.is_required)
                        .map((m: SystemMetric) => ({
                            metric_key: m.key,
                            custom_label: m.label,
                            is_required: true,
                            field_type: 'OTHER',
                            show_in_stats: true,
                            id: `${m.key}-${Math.random().toString(36).substr(2, 9)}`
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
                show_in_stats: true,
                id: `${metric.key}-${Math.random().toString(36).substr(2, 9)}`
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

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setSelectedFields((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);

                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const handleSave = async () => {
        setIsSaving(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/settings/reports`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ schema: selectedFields }),
            })

            if (res.ok) {
                // We could use a toast here, but since the project doesn't have one, 
                // we'll use a more professional message.
                alert('✅ Шаблон отчета успешно обновлен! Все изменения вступят в силу немедленно.')
            } else {
                alert('❌ Ошибка при сохранении. Пожалуйста, попробуйте еще раз или обратитесь в поддержку.')
            }
        } catch (error) {
            console.error(error)
            alert('Ошибка сохранения')
        } finally {
            setIsSaving(false)
        }
    }

    const getMetricInfo = (key: string) => systemMetrics.find(m => m.key === key)

    if (isLoading) return <div className="flex h-screen items-center justify-center bg-background"><Loader2 className="animate-spin text-purple-600" /></div>

    return (
        <div className="min-h-screen bg-[#F9FAFB] dark:bg-background">
            <div className="sticky top-0 z-30 w-full border-b bg-background/80 backdrop-blur-md">
                <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" asChild className="rounded-full">
                            <Link href={`/clubs/${clubId}/settings/general`}>
                                <ArrowLeft className="h-5 w-5" />
                            </Link>
                        </Button>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight">Настройка отчета</h1>
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Конструктор смены</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button onClick={handleSave} disabled={isSaving} className="bg-purple-600 hover:bg-purple-700 text-white px-6 shadow-md shadow-purple-200 transition-all active:scale-95">
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Сохранить изменения
                        </Button>
                    </div>
                </div>
            </div>

            <div className="mx-auto max-w-6xl p-6 lg:p-10">
                <div className="grid gap-10 lg:grid-cols-12">

                    {/* Left: Current Template */}
                    <div className="lg:col-span-7 space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-100 text-purple-600 text-xs font-bold">1</span>
                                Структура отчета
                            </h2>
                            <Badge variant="outline" className="bg-white/50 text-muted-foreground">
                                {selectedFields.length} полей добавлено
                            </Badge>
                        </div>

                        <DndContext 
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext 
                                items={selectedFields.map(f => f.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                <div className="space-y-4">
                                    {selectedFields.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-muted-foreground/10 bg-white/30 py-20 text-center animate-in fade-in zoom-in-95 duration-500">
                                            <div className="h-12 w-12 rounded-full bg-purple-50 flex items-center justify-center mb-4">
                                                <Plus className="h-6 w-6 text-purple-400" />
                                            </div>
                                            <h3 className="text-sm font-semibold text-foreground">Отчет пока пуст</h3>
                                            <p className="mt-1 text-xs text-muted-foreground max-w-[200px]">
                                                Добавьте метрики из библиотеки справа, чтобы начать
                                            </p>
                                        </div>
                                    ) : (
                                        selectedFields.map((field, index) => (
                                            <SortableField 
                                                key={field.id}
                                                field={field}
                                                index={index}
                                                metric={getMetricInfo(field.metric_key)}
                                                accounts={accounts}
                                                onUpdate={handleUpdateField}
                                                onRemove={handleRemoveField}
                                            />
                                        ))
                                    )}
                                </div>
                            </SortableContext>
                        </DndContext>
                    </div>

                    {/* Right: Available Metrics */}
                    <div className="lg:col-span-5 space-y-6">
                        <div className="sticky top-24 space-y-6">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-100 text-purple-600 text-xs font-bold">2</span>
                                Библиотека метрик
                            </h2>

                            <Card className="border-none shadow-xl shadow-purple-900/5 bg-white/80 backdrop-blur-sm overflow-hidden rounded-2xl">
                                <CardHeader className="pb-3 bg-gradient-to-br from-purple-50/50 to-transparent">
                                    <CardTitle className="text-sm font-bold">Доступные показатели</CardTitle>
                                    <CardDescription className="text-xs">Нажмите на метрику, чтобы добавить её в отчет</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6 max-h-[calc(100vh-250px)] overflow-y-auto custom-scrollbar pt-4">
                                    {['FINANCE', 'OPERATIONS', 'MARKETING'].map(category => {
                                        const metrics = systemMetrics.filter(m => m.category === category)
                                        if (metrics.length === 0) return null

                                        const categoryIcons: Record<string, string> = {
                                            'FINANCE': '💰',
                                            'OPERATIONS': '⚙️',
                                            'MARKETING': '📣'
                                        }

                                        const categoryNames: Record<string, string> = {
                                            'FINANCE': 'Финансы',
                                            'OPERATIONS': 'Операционка',
                                            'MARKETING': 'Маркетинг'
                                        }

                                        return (
                                            <div key={category} className="space-y-3">
                                                <h4 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60 px-1">
                                                    <span>{categoryIcons[category]}</span>
                                                    {categoryNames[category]}
                                                </h4>
                                                <div className="grid gap-2">
                                                    {metrics.map(metric => {
                                                        const isAdded = selectedFields.some(f => f.metric_key === metric.key)
                                                        return (
                                                            <button
                                                                key={metric.id}
                                                                onClick={() => handleAddField(metric)}
                                                                disabled={isAdded}
                                                                className={`group w-full flex items-center justify-between rounded-xl border p-3 text-left transition-all duration-200 ${isAdded
                                                                    ? 'bg-muted/50 border-muted-foreground/5 opacity-50 cursor-not-allowed scale-[0.98]'
                                                                    : 'bg-white border-muted-foreground/10 hover:border-purple-300 hover:shadow-md hover:shadow-purple-500/5 active:scale-95'
                                                                    }`}
                                                            >
                                                                <div className="space-y-0.5">
                                                                    <div className="font-semibold text-xs text-foreground group-hover:text-purple-700 transition-colors">{metric.label}</div>
                                                                    <div className="text-[10px] text-muted-foreground line-clamp-1 group-hover:text-muted-foreground/80 transition-colors">{metric.description}</div>
                                                                </div>
                                                                <div className={`h-6 w-6 rounded-full flex items-center justify-center transition-all ${
                                                                    isAdded ? 'bg-muted-foreground/10' : 'bg-purple-50 group-hover:bg-purple-600'
                                                                }`}>
                                                                    {isAdded ? (
                                                                        <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                                                                    ) : (
                                                                        <Plus className="h-3 w-3 text-purple-600 group-hover:text-white" />
                                                                    )}
                                                                </div>
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </div>
            
            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #e2e8f0;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #cbd5e1;
                }
            `}</style>
        </div>
    )
}
