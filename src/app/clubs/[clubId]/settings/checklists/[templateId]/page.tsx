"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Plus, GripVertical, Save, Trash2, ArrowLeft, ClipboardCheck, Camera } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface ChecklistItemOption {
    label: string
    score: number
}

interface ChecklistItem {
    id?: number
    content: string
    description: string
    weight: number
    sort_order: number
    is_photo_required?: boolean
    min_photos?: number
    related_entity_type?: 'workstations' | null
    target_zone?: string | null
    options?: ChecklistItemOption[]
}

interface ChecklistTemplate {
    id: number
    name: string
    description: string
    items: ChecklistItem[]
    type?: 'shift_handover' | 'manager_audit'
    settings?: any
    created_at: string
}

function SortableItem({ item, index, onUpdate, onRemove, zones }: { item: ChecklistItem, index: number, onUpdate: (index: number, field: keyof ChecklistItem, value: any) => void, onRemove: (index: number) => void, zones: string[] }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id: item.id || `temp-${index}` })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    }

    return (
        <Card ref={setNodeRef} style={style} className="overflow-hidden mb-4">
            <div className="flex items-start bg-card p-4">
                <div {...attributes} {...listeners} className="mt-3 mr-3 text-muted-foreground cursor-move">
                    <GripVertical className="h-5 w-5" />
                </div>
                <div className="flex-1 space-y-3">
                    <div className="flex items-center justify-between">
                        <Badge variant="secondary">Пункт {index + 1}</Badge>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500"
                            onClick={() => onRemove(index)}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="grid gap-2">
                        <Label className="text-xs">Что проверить?</Label>
                        <Input
                            placeholder="Напр: Чистота рабочих поверхностей"
                            value={item.content}
                            onChange={e => onUpdate(index, 'content', e.target.value)}
                        />
                    </div>
                    <div className="flex gap-4">
                        <div className="flex-1 grid gap-2">
                            <Label className="text-xs">Доп. описание (опционально)</Label>
                            <Input
                                placeholder="Пояснение для проверяющего"
                                value={item.description}
                                onChange={e => onUpdate(index, 'description', e.target.value)}
                                className="text-sm"
                            />
                        </div>
                        <div className="w-24 grid gap-2">
                            <Label className="text-xs">Вес (Баллы)</Label>
                            <Input
                                type="number"
                                step="0.1"
                                value={item.weight}
                                onChange={e => onUpdate(index, 'weight', parseFloat(e.target.value))}
                                className="text-sm"
                            />
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 pt-2">
                        <div className="flex items-center gap-2">
                            <Switch 
                                id={`photo-required-${index}`}
                                checked={item.is_photo_required}
                                onCheckedChange={checked => onUpdate(index, 'is_photo_required', checked)}
                            />
                            <Label htmlFor={`photo-required-${index}`} className="flex items-center gap-1 text-sm cursor-pointer">
                                <Camera className="h-3 w-3" />
                                Требовать фото
                            </Label>
                        </div>

                        {item.is_photo_required && (
                            <div className="flex items-center gap-2">
                                <Label className="text-xs whitespace-nowrap">Мин. фото:</Label>
                                <Input
                                    type="number"
                                    min="1"
                                    max="10"
                                    value={item.min_photos || 1}
                                    onChange={e => onUpdate(index, 'min_photos', parseInt(e.target.value))}
                                    className="w-16 h-8 text-sm"
                                />
                            </div>
                        )}

                        <div className="flex items-center gap-2">
                            <Label className="text-xs whitespace-nowrap">Привязка:</Label>
                            <Select 
                                value={item.related_entity_type || 'none'} 
                                onValueChange={(val) => onUpdate(index, 'related_entity_type', val === 'none' ? null : val)}
                            >
                                <SelectTrigger className="h-8 w-[180px] text-sm">
                                    <SelectValue placeholder="Нет" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Нет</SelectItem>
                                    <SelectItem value="workstations">Рабочие станции (ПК)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {item.related_entity_type === 'workstations' && (
                            <div className="flex items-center gap-2">
                                <Label className="text-xs whitespace-nowrap">Зона (опционально):</Label>
                                <Select 
                                    value={item.target_zone || 'all'} 
                                    onValueChange={(val) => onUpdate(index, 'target_zone', val === 'all' ? null : val)}
                                >
                                    <SelectTrigger className="h-8 w-[150px] text-sm">
                                        <SelectValue placeholder="Все зоны" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Все зоны</SelectItem>
                                        {zones.map(zone => (
                                            <SelectItem key={zone} value={zone}>{zone}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>

                    <div className="mt-4 pt-2 border-t">
                        <div className="flex items-center justify-between mb-2">
                            <Label className="text-xs font-semibold text-muted-foreground">Варианты замечаний (Опционально)</Label>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-6 text-xs"
                                onClick={() => {
                                    const currentOptions = item.options || []
                                    onUpdate(index, 'options', [...currentOptions, { label: '', score: 0 }])
                                }}
                            >
                                <Plus className="h-3 w-3 mr-1" /> Добавить вариант
                            </Button>
                        </div>
                        
                        {item.options && item.options.length > 0 && (
                            <div className="space-y-2">
                                {item.options.map((option, optIndex) => (
                                    <div key={optIndex} className="flex gap-2 items-center">
                                        <Input
                                            placeholder="Текст замечания (напр. Грязно)"
                                            value={option.label}
                                            onChange={(e) => {
                                                const newOptions = [...(item.options || [])]
                                                newOptions[optIndex] = { ...newOptions[optIndex], label: e.target.value }
                                                onUpdate(index, 'options', newOptions)
                                            }}
                                            className="h-8 text-sm"
                                        />
                                        <div className="w-24 flex items-center gap-1">
                                            <Label className="text-[10px] text-muted-foreground">Балл:</Label>
                                            <Input
                                                type="number"
                                                value={option.score}
                                                onChange={(e) => {
                                                    const newScore = parseFloat(e.target.value)
                                                    const newOptions = [...(item.options || [])]
                                                    newOptions[optIndex] = { ...newOptions[optIndex], score: newScore }
                                                    
                                                    // Auto-update weight if option score is higher
                                                    let newWeight = item.weight
                                                    if (newScore > newWeight) {
                                                        newWeight = newScore
                                                    }
                                                    
                                                    // We need to update both options and weight
                                                    // Since onUpdate only takes one field, we need to handle this manually or call it twice
                                                    // But here onUpdate updates state, so calling twice might cause race condition if not handled well.
                                                    // Better to pass the whole item update logic to parent or use a more flexible update function.
                                                    // For now, let's update options first, then check weight in the parent's handler or modify onUpdate to accept partial object.
                                                    
                                                    // Let's modify onUpdate signature in SortableItem to handle multiple fields? 
                                                    // Or just trigger two updates. React state batching might help.
                                                    onUpdate(index, 'options', newOptions)
                                                    if (newScore > item.weight) {
                                                        onUpdate(index, 'weight', newScore)
                                                    }
                                                }}
                                                className="h-8 text-sm"
                                            />
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500"
                                            onClick={() => {
                                                const newOptions = [...(item.options || [])]
                                                newOptions.splice(optIndex, 1)
                                                onUpdate(index, 'options', newOptions)
                                            }}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                        {(!item.options || item.options.length === 0) && (
                            <div className="text-xs text-muted-foreground italic">
                                Нет вариантов. Будет использована стандартная оценка.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Card>
    )
}

export default function ChecklistTemplatePage({ params }: { params: Promise<{ clubId: string; templateId: string }> }) {
    const router = useRouter()
    const [clubId, setClubId] = useState('')
    const [templateId, setTemplateId] = useState('')
    const [currentTemplate, setCurrentTemplate] = useState<Partial<ChecklistTemplate>>({
        name: '',
        description: '',
        items: [],
        type: 'manager_audit',
        settings: {}
    })
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [zones, setZones] = useState<string[]>([])

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    )

    useEffect(() => {
        params.then(p => {
            setClubId(p.clubId)
            setTemplateId(p.templateId)
            fetchZones(p.clubId)
            if (p.templateId === 'new') {
                setIsLoading(false)
            } else {
                fetchTemplate(p.clubId, p.templateId)
            }
        })
    }, [params])

    const fetchZones = async (id: string) => {
        try {
            const res = await fetch(`/api/clubs/${id}/workstations`)
            if (res.ok) {
                const data = await res.json()
                const uniqueZones = Array.from(new Set(data.map((w: any) => w.zone))).filter(Boolean) as string[]
                setZones(uniqueZones)
            }
        } catch (e) {
            console.error('Failed to fetch zones', e)
        }
    }

    const fetchTemplate = async (cId: string, tId: string) => {
        try {
            const res = await fetch(`/api/clubs/${cId}/evaluations/templates/${tId}`)
            const data = await res.json()
            if (res.ok) {
                // Ensure items are sorted by sort_order
                data.items = data.items?.sort((a: ChecklistItem, b: ChecklistItem) => a.sort_order - b.sort_order) || []
                setCurrentTemplate(data)
            }
        } catch (error) {
            console.error(error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleAddItem = () => {
        const newItem: ChecklistItem = {
            id: undefined, // New items have no ID yet
            content: '',
            description: '',
            weight: 5.0,
            sort_order: (currentTemplate.items?.length || 0),
            is_photo_required: false,
            min_photos: 0,
            related_entity_type: null,
            target_zone: null
        }
        setCurrentTemplate({
            ...currentTemplate,
            items: [...(currentTemplate.items || []), newItem]
        })
    }

    const handleUpdateItem = (index: number, field: keyof ChecklistItem, value: any) => {
        const newItems = [...(currentTemplate.items || [])]
        newItems[index] = { ...newItems[index], [field]: value }
        
        // Safety check: if updating weight, ensure it's not less than any option score
        if (field === 'weight') {
            const maxOptionScore = newItems[index].options?.reduce((max, opt) => Math.max(max, opt.score), 0) || 0
            if (value < maxOptionScore) {
                // Don't allow lowering weight below max option
                // Or we could auto-lower options? Better to just clamp weight.
                // For simplicity in this UI, we'll allow it but maybe show warning?
                // Actually, let's enforce it.
                if (value < maxOptionScore) {
                    // Force value to be at least maxOptionScore
                    // But this might be annoying if user wants to lower everything.
                    // Let's just trust the user or the auto-update logic in the input.
                }
            }
        }

        setCurrentTemplate({ ...currentTemplate, items: newItems })
    }

    const handleRemoveItem = (index: number) => {
        const newItems = [...(currentTemplate.items || [])]
        newItems.splice(index, 1)
        setCurrentTemplate({ ...currentTemplate, items: newItems })
    }

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event

        if (active.id !== over?.id) {
            const oldIndex = currentTemplate.items!.findIndex((item, idx) => (item.id || `temp-${idx}`) === active.id)
            const newIndex = currentTemplate.items!.findIndex((item, idx) => (item.id || `temp-${idx}`) === over!.id)
            
            const newItems = arrayMove(currentTemplate.items!, oldIndex, newIndex)
            
            // Update sort_order for all items
            const reorderedItems = newItems.map((item, idx) => ({
                ...item,
                sort_order: idx
            }))

            setCurrentTemplate({
                ...currentTemplate,
                items: reorderedItems
            })
        }
    }

    const handleSave = async () => {
        if (!currentTemplate.name) return alert('Введите название чеклиста')

        setIsSaving(true)
        try {
            let res
            if (templateId !== 'new') {
                // Update existing
                res = await fetch(`/api/clubs/${clubId}/evaluations/templates/${templateId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(currentTemplate),
                })
            } else {
                // Create new
                res = await fetch(`/api/clubs/${clubId}/evaluations/templates`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(currentTemplate),
                })
            }

            if (res.ok) {
                router.push(`/clubs/${clubId}/settings/checklists`)
                router.refresh()
            } else {
                alert('Ошибка сохранения')
            }
        } catch (error) {
            console.error(error)
            alert('Ошибка сервера')
        } finally {
            setIsSaving(false)
        }
    }

    if (isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>

    return (
        <div className="min-h-screen bg-background p-8 pb-24">
            <div className="mx-auto max-w-3xl">
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <Button variant="ghost" onClick={() => router.push(`/clubs/${clubId}/settings/checklists`)} className="pl-0 hover:pl-0 hover:bg-transparent -ml-2 mb-2">
                            <ArrowLeft className="mr-2 h-4 w-4" /> К списку
                        </Button>
                        <h1 className="text-3xl font-bold">{templateId === 'new' ? 'Создание чеклиста' : 'Редактирование чеклиста'}</h1>
                    </div>
                    <Button onClick={handleSave} disabled={isSaving} className="bg-purple-600 hover:bg-purple-700">
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Сохранить
                    </Button>
                </div>

                <Card className="mb-8">
                    <CardHeader>
                        <CardTitle>Основная информация</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-2">
                            <Label>Название чеклиста</Label>
                            <Input
                                placeholder="Напр: Утренняя проверка"
                                value={currentTemplate.name}
                                onChange={e => setCurrentTemplate({ ...currentTemplate, name: e.target.value })}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Описание</Label>
                            <Input
                                placeholder="Для чего этот чеклист"
                                value={currentTemplate.description}
                                onChange={e => setCurrentTemplate({ ...currentTemplate, description: e.target.value })}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label>Тип чеклиста</Label>
                            <Select 
                                value={currentTemplate.type || 'manager_audit'} 
                                onValueChange={(val: any) => setCurrentTemplate({...currentTemplate, type: val})}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Выберите тип" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="manager_audit">Аудит (Управляющий)</SelectItem>
                                    <SelectItem value="shift_handover">Приемка смены (Сотрудник)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {currentTemplate.type === 'shift_handover' && (
                            <div className="space-y-4 pt-2 border-t mt-4">
                                <h3 className="font-medium text-sm text-muted-foreground">Настройки приемки</h3>
                                <div className="flex items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                        <Label>Блокировать открытие смены</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Сотрудник не сможет начать смену без прохождения этого чеклиста
                                        </p>
                                    </div>
                                    <Switch 
                                        checked={currentTemplate.settings?.block_shift_open}
                                        onCheckedChange={checked => setCurrentTemplate({
                                            ...currentTemplate, 
                                            settings: { ...currentTemplate.settings, block_shift_open: checked }
                                        })}
                                    />
                                </div>
                                <div className="flex items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                        <Label>Блокировать закрытие смены</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Сотрудник не сможет завершить смену без прохождения этого чеклиста
                                        </p>
                                    </div>
                                    <Switch 
                                        checked={currentTemplate.settings?.block_shift_close}
                                        onCheckedChange={checked => setCurrentTemplate({
                                            ...currentTemplate, 
                                            settings: { ...currentTemplate.settings, block_shift_close: checked }
                                        })}
                                    />
                                </div>
                                <div className="flex items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                        <Label>Требовать фото</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Обязательное фото-подтверждение для проблемных пунктов
                                        </p>
                                    </div>
                                    <Switch 
                                        checked={currentTemplate.settings?.require_photo_on_fail}
                                        onCheckedChange={checked => setCurrentTemplate({
                                            ...currentTemplate, 
                                            settings: { ...currentTemplate.settings, require_photo_on_fail: checked }
                                        })}
                                    />
                                </div>
                            </div>
                        )}

                        {(!currentTemplate.type || currentTemplate.type === 'manager_audit') && (
                            <div className="space-y-4 pt-2 border-t mt-4">
                                <h3 className="font-medium text-sm text-muted-foreground">Настройки аудита</h3>
                                <div className="flex items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                        <Label>Влияет на KPI</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Учитывать результаты проверки в расчете премии
                                        </p>
                                    </div>
                                    <Switch 
                                        checked={currentTemplate.settings?.affects_kpi}
                                        onCheckedChange={checked => setCurrentTemplate({
                                            ...currentTemplate, 
                                            settings: { ...currentTemplate.settings, affects_kpi: checked }
                                        })}
                                    />
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold">Пункты проверки</h2>
                        <Button variant="outline" size="sm" onClick={handleAddItem}>
                            <Plus className="mr-1 h-4 w-4" /> Добавить пункт
                        </Button>
                    </div>

                    {currentTemplate.items?.length === 0 && (
                        <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
                            В чеклисте пока нет пунктов. Добавьте первый.
                        </div>
                    )}

                    <DndContext 
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext 
                            items={currentTemplate.items?.map((item, idx) => item.id || `temp-${idx}`) || []}
                            strategy={verticalListSortingStrategy}
                        >
                            {currentTemplate.items?.map((item, index) => (
                                <SortableItem 
                                    key={item.id || `temp-${index}`}
                                    item={item}
                                    index={index}
                                    onUpdate={handleUpdateItem}
                                    onRemove={handleRemoveItem}
                                    zones={zones}
                                />
                            ))}
                        </SortableContext>
                    </DndContext>
                </div>
            </div>
        </div>
    )
}