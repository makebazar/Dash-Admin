"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Loader2, Plus, GripVertical, Save, Trash2, Minus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core"
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

interface SystemMetric {
    id: number | string
    key: string
    label: string
    type: string
    category: string
    description: string
    is_required: boolean
    is_custom?: boolean
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

const normalizeTemplateFields = (fields: TemplateField[]) =>
    fields.map((field) => ({
        metric_key: field.metric_key,
        custom_label: field.custom_label,
        is_required: field.is_required,
        field_type: field.field_type === 'EXPENSE_LIST' ? 'EXPENSE' : field.field_type,
        show_in_stats: field.show_in_stats,
        show_for_employee: field.show_for_employee ?? true,
        account_id: field.account_id ?? null,
    }))

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
            className={`group relative flex flex-col gap-4 rounded-xl border bg-card p-4 transition-all shadow-sm md:p-5 ${
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
                        <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/50 p-1">
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
                                    field.field_type === 'EXPENSE' || field.field_type === 'EXPENSE_LIST'
                                        ? 'bg-orange-500 text-white shadow-sm'
                                        : 'text-muted-foreground hover:bg-background/50'
                                }`}
                            >
                                <Minus className="h-3 w-3" /> Расход
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
    const [clubId, setClubId] = useState('')
    const [systemMetrics, setSystemMetrics] = useState<SystemMetric[]>([])
    const [selectedFields, setSelectedFields] = useState<TemplateField[]>([])
    const [savedFieldsSnapshot, setSavedFieldsSnapshot] = useState("[]")
    const [accounts, setAccounts] = useState<Account[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [isCreatingMetric, setIsCreatingMetric] = useState(false)
    const [isCustomMetricFormOpen, setIsCustomMetricFormOpen] = useState(false)
    const [customMetricLabel, setCustomMetricLabel] = useState('')
    const [customMetricType, setCustomMetricType] = useState('MONEY')
    const [customMetricCategory, setCustomMetricCategory] = useState('OPERATIONS')
    const [customMetricDescription, setCustomMetricDescription] = useState('')

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
                        id: f.id || `${f.metric_key}-${Math.random().toString(36).slice(2, 11)}`,
                        field_type: f.field_type === 'EXPENSE_LIST' ? 'EXPENSE' : f.field_type
                    }))
                    setSelectedFields(schema)
                    setSavedFieldsSnapshot(JSON.stringify(normalizeTemplateFields(schema)))
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
                            id: `${m.key}-${Math.random().toString(36).slice(2, 11)}`
                        }))
                    setSelectedFields(defaults)
                    setSavedFieldsSnapshot(JSON.stringify(normalizeTemplateFields(defaults)))
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
                id: `${metric.key}-${Math.random().toString(36).slice(2, 11)}`
            }
        ])
    }

    const handleCreateCustomMetric = async () => {
        if (!customMetricLabel.trim()) {
            alert('Введите название метрики')
            return
        }

        setIsCreatingMetric(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/settings/reports/metrics`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    label: customMetricLabel,
                    type: customMetricType,
                    category: customMetricCategory,
                    description: customMetricDescription,
                }),
            })

            const data = await res.json()
            if (!res.ok) {
                alert(data.error || 'Ошибка создания метрики')
                return
            }

            const createdMetric: SystemMetric = data.metric
            setSystemMetrics((prev) =>
                [...prev, createdMetric].sort((a, b) =>
                    a.category.localeCompare(b.category, 'ru') || a.label.localeCompare(b.label, 'ru')
                )
            )
            handleAddField(createdMetric)
            setCustomMetricLabel('')
            setCustomMetricType('MONEY')
            setCustomMetricCategory('OPERATIONS')
            setCustomMetricDescription('')
            setIsCustomMetricFormOpen(false)
        } catch (error) {
            console.error(error)
            alert('Ошибка создания метрики')
        } finally {
            setIsCreatingMetric(false)
        }
    }

    const handleDeleteCustomMetric = async (metric: SystemMetric) => {
        if (!metric.is_custom) return

        if (!confirm(`Удалить метрику "${metric.label}"?`)) {
            return
        }

        try {
            const res = await fetch(`/api/clubs/${clubId}/settings/reports/metrics`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ metricId: metric.id }),
            })

            const data = await res.json()
            if (!res.ok) {
                alert(data.error || 'Ошибка удаления метрики')
                return
            }

            setSystemMetrics((prev) => prev.filter((item) => String(item.id) !== String(metric.id)))
        } catch (error) {
            console.error(error)
            alert('Ошибка удаления метрики')
        }
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
                setSavedFieldsSnapshot(JSON.stringify(normalizeTemplateFields(selectedFields)))
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
    const hasUnsavedChanges = useMemo(
        () => JSON.stringify(normalizeTemplateFields(selectedFields)) !== savedFieldsSnapshot,
        [selectedFields, savedFieldsSnapshot]
    )

    if (isLoading) return <div className="flex h-screen items-center justify-center bg-background"><Loader2 className="animate-spin text-purple-600" /></div>

    return (
        <div className="min-h-screen bg-background pb-24 md:pb-0">
            <div className="border-b bg-background">
                <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 md:flex-row md:items-start md:justify-between md:px-6 md:py-6">
                    <div className="min-w-0">
                        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Настройка отчета</h1>
                        <p className="mt-1 text-sm text-muted-foreground">Конструктор полей для открытия и закрытия смены</p>
                    </div>
                    <div className="hidden items-center gap-3 md:flex">
                        <Button onClick={handleSave} disabled={isSaving || !hasUnsavedChanges} className="bg-black px-6 text-white hover:bg-black/90">
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Сохранить
                        </Button>
                    </div>
                </div>
            </div>

            <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8 lg:py-10">
                <div className="grid gap-6 md:gap-8 lg:grid-cols-12 lg:gap-10">

                    {/* Left: Current Template */}
                    <div className="space-y-4 lg:col-span-7 lg:space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="flex items-center gap-2 text-base font-bold md:text-lg">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-100 text-purple-600 text-xs font-bold">1</span>
                                Структура отчета
                            </h2>
                            <Badge variant="outline" className="bg-white/50 text-[10px] text-muted-foreground sm:text-xs">
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
                                <div className="space-y-3 md:space-y-4">
                                    {selectedFields.length === 0 ? (
                                        <div className="animate-in zoom-in-95 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-muted-foreground/10 bg-white/50 py-14 text-center fade-in duration-500 md:py-20">
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
                    <div className="space-y-4 lg:col-span-5 lg:space-y-6">
                        <div className="space-y-4 lg:sticky lg:top-24 lg:space-y-6">
                            <h2 className="flex items-center gap-2 text-base font-bold md:text-lg">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-100 text-purple-600 text-xs font-bold">2</span>
                                Библиотека метрик
                            </h2>

                            <div className="space-y-3">
                                <Button
                                    variant={isCustomMetricFormOpen ? "outline" : "default"}
                                    onClick={() => setIsCustomMetricFormOpen((prev) => !prev)}
                                    className={cn(
                                        "w-full",
                                        !isCustomMetricFormOpen && "bg-black text-white hover:bg-black/90"
                                    )}
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    {isCustomMetricFormOpen ? "Скрыть форму своей метрики" : "Добавить свою метрику"}
                                </Button>

                                {isCustomMetricFormOpen && (
                                    <Card className="rounded-2xl border bg-white">
                                        <CardHeader className="pb-3">
                                            <CardTitle className="text-sm font-bold">Своя метрика клуба</CardTitle>
                                            <CardDescription className="text-xs">Создайте свою метрику и сразу добавьте её в текущий отчет</CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                            <div className="space-y-2">
                                                <Label htmlFor="custom-metric-label">Название</Label>
                                                <Input
                                                    id="custom-metric-label"
                                                    value={customMetricLabel}
                                                    onChange={(e) => setCustomMetricLabel(e.target.value)}
                                                    placeholder="Например, Выручка кальяны"
                                                />
                                            </div>
                                            <div className="grid gap-3 sm:grid-cols-2">
                                                <div className="space-y-2">
                                                    <Label>Категория</Label>
                                                    <Select value={customMetricCategory} onValueChange={setCustomMetricCategory}>
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="FINANCE">Финансы</SelectItem>
                                                            <SelectItem value="OPERATIONS">Операционка</SelectItem>
                                                            <SelectItem value="MARKETING">Маркетинг</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Тип данных</Label>
                                                    <Select value={customMetricType} onValueChange={setCustomMetricType}>
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="MONEY">Деньги</SelectItem>
                                                            <SelectItem value="NUMBER">Число</SelectItem>
                                                            <SelectItem value="TEXT">Текст</SelectItem>
                                                            <SelectItem value="BOOLEAN">Да / Нет</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="custom-metric-description">Описание</Label>
                                                <Input
                                                    id="custom-metric-description"
                                                    value={customMetricDescription}
                                                    onChange={(e) => setCustomMetricDescription(e.target.value)}
                                                    placeholder="Необязательно"
                                                />
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="outline"
                                                    className="flex-1"
                                                    onClick={() => setIsCustomMetricFormOpen(false)}
                                                >
                                                    Отмена
                                                </Button>
                                                <Button
                                                    onClick={handleCreateCustomMetric}
                                                    disabled={isCreatingMetric || !customMetricLabel.trim()}
                                                    className="flex-1 bg-black text-white hover:bg-black/90"
                                                >
                                                    {isCreatingMetric ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                                                    Создать
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}
                            </div>

                            <Card className="overflow-hidden rounded-2xl border-none bg-white/90 shadow-lg shadow-purple-900/5 backdrop-blur-sm md:shadow-xl">
                                <CardHeader className="pb-3 bg-gradient-to-br from-purple-50/50 to-transparent">
                                    <CardTitle className="text-sm font-bold">Доступные показатели</CardTitle>
                                    <CardDescription className="text-xs">Нажмите на метрику, чтобы добавить её в отчет</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-5 pt-4 lg:max-h-[calc(100vh-250px)] lg:overflow-y-auto custom-scrollbar">
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
                                                <h4 className="flex items-center gap-2 px-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">
                                                    <span>{categoryIcons[category]}</span>
                                                    {categoryNames[category]}
                                                </h4>
                                                <div className="grid gap-2">
                                                    {metrics.map(metric => {
                                                        const isAdded = selectedFields.some(f => f.metric_key === metric.key)
                                                        return (
                                                            <div
                                                                key={metric.id}
                                                                className={`group flex items-center gap-2 rounded-xl border p-3 transition-all duration-200 ${isAdded
                                                                    ? 'bg-muted/50 border-muted-foreground/5 opacity-50'
                                                                    : 'bg-white border-muted-foreground/10 hover:border-purple-300 hover:shadow-md hover:shadow-purple-500/5'
                                                                    }`}
                                                            >
                                                                <button
                                                                    onClick={() => handleAddField(metric)}
                                                                    disabled={isAdded}
                                                                    className="flex min-w-0 flex-1 items-center justify-between text-left"
                                                                >
                                                                    <div className="space-y-0.5">
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="font-semibold text-xs text-foreground group-hover:text-purple-700 transition-colors">{metric.label}</div>
                                                                            {metric.is_custom && (
                                                                                <Badge variant="outline" className="h-4 px-1 text-[9px]">
                                                                                    Своя
                                                                                </Badge>
                                                                            )}
                                                                        </div>
                                                                        <div className="text-[10px] text-muted-foreground line-clamp-1 group-hover:text-muted-foreground/80 transition-colors">{metric.description}</div>
                                                                    </div>
                                                                    <div className={`ml-3 h-6 w-6 shrink-0 rounded-full flex items-center justify-center transition-all ${
                                                                        isAdded ? 'bg-muted-foreground/10' : 'bg-purple-50 group-hover:bg-purple-600'
                                                                    }`}>
                                                                        {isAdded ? (
                                                                            <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                                                                        ) : (
                                                                            <Plus className="h-3 w-3 text-purple-600 group-hover:text-white" />
                                                                        )}
                                                                    </div>
                                                                </button>
                                                                {metric.is_custom && (
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-red-500"
                                                                        onClick={() => handleDeleteCustomMetric(metric)}
                                                                        title="Удалить метрику"
                                                                    >
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                )}
                                                            </div>
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

            <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
                <div className="mx-auto flex max-w-6xl gap-2">
                    <Button onClick={handleSave} disabled={isSaving || !hasUnsavedChanges} className="h-11 flex-1 bg-purple-600 text-white hover:bg-purple-700">
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Сохранить
                    </Button>
                </div>
            </div>
        </div>
    )
}
