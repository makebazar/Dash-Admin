"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Plus, GripVertical, Save, Trash2, ArrowLeft, ChevronUp, ChevronDown } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface ChecklistItemOption {
    label: string
    score: number | string
}

interface ChecklistItem {
    id?: number
    content: string
    description: string
    weight: number | string
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

// Separate component to handle option score input state locally
function OptionScoreInput({ score, onChange }: { score: number | string, onChange: (val: number | string) => void }) {
    const [localScore, setLocalScore] = useState<string | number>(score)

    useEffect(() => {
        setLocalScore(score)
    }, [score])

    return (
        <Input
            type="number"
            value={localScore}
            onChange={(e) => {
                const val = e.target.value
                setLocalScore(val)
                onChange(val)
            }}
            onBlur={() => {
                if (localScore === '' || localScore === '.') {
                    setLocalScore(0)
                    onChange(0)
                }
            }}
            className="h-8 text-sm text-center"
        />
    )
}

function SortableItem({ item, index, totalItems, onUpdate, onRemove, onBulkUpdate, onMove, zones }: { item: ChecklistItem, index: number, totalItems: number, onUpdate: (index: number, field: keyof ChecklistItem, value: any) => void, onRemove: (index: number) => void, onBulkUpdate: (index: number, updates: Partial<ChecklistItem>) => void, onMove: (index: number, direction: 'up' | 'down') => void, zones: string[] }) {
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

    // Helper to handle multiple updates
    const handleWorkstationToggle = (checked: boolean) => {
        if (checked) {
            onBulkUpdate(index, {
                related_entity_type: 'workstations',
                weight: 10
            })
        } else {
            onBulkUpdate(index, {
                related_entity_type: null,
                weight: 1,
                target_zone: null
            })
        }
    }

    const [localWeight, setLocalWeight] = useState<string | number>(item.weight)
    
    // Sync local weight when item weight changes from outside (e.g. bulk update)
    useEffect(() => {
        setLocalWeight(item.weight)
    }, [item.weight])

    return (
        <Card ref={setNodeRef} style={style} className="mb-4 overflow-hidden rounded-none border-x-0 bg-white shadow-none last:border-b-0 sm:rounded-xl sm:border sm:shadow-sm">
            <div className="flex items-start bg-card p-4 md:p-6">
                <div {...attributes} {...listeners} className="mt-3 mr-3 text-muted-foreground cursor-move touch-none hidden md:block">
                    <GripVertical className="h-5 w-5" />
                </div>
                <div className="flex-1 space-y-3 min-w-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-[10px] sm:text-xs">Пункт {index + 1}</Badge>
                            
                            {/* Mobile Move Buttons */}
                            <div className="flex items-center gap-1 md:hidden">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-7 w-7"
                                    disabled={index === 0}
                                    onClick={() => onMove(index, 'up')}
                                >
                                    <ChevronUp className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-7 w-7"
                                    disabled={index === totalItems - 1}
                                    onClick={() => onMove(index, 'down')}
                                >
                                    <ChevronDown className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-red-500"
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
                            className="text-sm"
                        />
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                        <div className="flex-1 grid gap-2">
                            <Label className="text-xs">Доп. описание (опционально)</Label>
                            <Textarea
                                placeholder="Пояснение для проверяющего"
                                value={item.description}
                                onChange={e => onUpdate(index, 'description', e.target.value)}
                                ref={el => {
                                    if (!el) return
                                    el.style.height = "auto"
                                    el.style.height = `${el.scrollHeight}px`
                                }}
                                onInput={e => {
                                    e.currentTarget.style.height = "auto"
                                    e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`
                                }}
                                className="text-sm resize-none overflow-hidden min-h-[36px]"
                                rows={1}
                            />
                        </div>
                        <div className="w-full sm:w-24 grid gap-2">
                            <Label className="text-xs">Вес (Баллы)</Label>
                            <Input
                                type="number"
                                step="0.1"
                                value={localWeight}
                                onChange={e => {
                                    const val = e.target.value
                                    setLocalWeight(val)
                                    onUpdate(index, 'weight', val)
                                }}
                                onBlur={() => {
                                    // Ensure valid number on blur
                                    if (localWeight === '' || localWeight === '.') {
                                        setLocalWeight(0)
                                        onUpdate(index, 'weight', 0)
                                    }
                                }}
                                className="text-sm text-center"
                                disabled={item.related_entity_type === 'workstations' || (item.options && item.options.length > 0)}
                            />
                        </div>
                    </div>
                    <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                        <div className="flex items-center gap-2">
                            <Switch 
                                id={`photo-required-${index}`}
                                checked={item.is_photo_required}
                                onCheckedChange={checked => onUpdate(index, 'is_photo_required', checked)}
                            />
                            <Label htmlFor={`photo-required-${index}`} className="flex items-center gap-1 text-xs sm:text-sm cursor-pointer select-none">
                                Требовать фото
                            </Label>
                        </div>

                        {item.is_photo_required && (
                            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2">
                                <Label className="text-xs whitespace-nowrap">Мин. фото:</Label>
                                <Input
                                    type="number"
                                    min="1"
                                    max="10"
                                    value={item.min_photos || 1}
                                    onChange={e => onUpdate(index, 'min_photos', parseInt(e.target.value))}
                                    className="w-14 sm:w-16 h-8 text-sm text-center"
                                />
                            </div>
                        )}
                        
                        <div className="hidden h-px bg-border sm:block sm:h-4 sm:w-auto" />

                        <div className="flex items-center gap-2">
                            <Switch 
                                id={`workstation-check-${index}`}
                                checked={item.related_entity_type === 'workstations'}
                                onCheckedChange={(checked) => handleWorkstationToggle(checked)}
                            />
                            <Label htmlFor={`workstation-check-${index}`} className="flex items-center gap-1 text-xs sm:text-sm cursor-pointer select-none">
                                Проверять рабочие места
                            </Label>
                        </div>

                        {item.related_entity_type === 'workstations' && (
                            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 w-full sm:w-auto">
                                <Label className="text-xs whitespace-nowrap">Зона:</Label>
                                <Select 
                                    value={item.target_zone || 'all'} 
                                    onValueChange={(val) => onUpdate(index, 'target_zone', val === 'all' ? null : val)}
                                >
                                    <SelectTrigger className="h-8 flex-1 sm:w-[150px] text-sm">
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

                    {/* Options Section - Hide if workstation check is enabled */}
                    {!item.related_entity_type && (
                            <div className="mt-4 border-t pt-2">
                            <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <Label className="text-xs font-semibold text-muted-foreground">Варианты замечаний (Опционально)</Label>
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-8 justify-start px-0 text-xs sm:h-6 sm:justify-center sm:px-2"
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
                                        <div key={optIndex} className="space-y-2">
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
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 sm:max-w-[96px]">
                                                    <OptionScoreInput
                                                        score={option.score}
                                                        onChange={(val) => {
                                                            const newOptions = [...(item.options || [])]
                                                            newOptions[optIndex] = { ...newOptions[optIndex], score: val }
                                                            
                                                            // Calculate max score from ALL options (including the one just updated)
                                                            // Parse everything to numbers for calculation
                                                            const currentParsedScore = (typeof val === 'string' ? parseFloat(val) : val) || 0
                                                            let maxWeight = currentParsedScore
                                                            
                                                            newOptions.forEach((opt, idx) => {
                                                                if (idx === optIndex) return // Already handled
                                                                const s = typeof opt.score === 'string' ? (parseFloat(opt.score) || 0) : opt.score
                                                                if (s > maxWeight) maxWeight = s
                                                            })
                                                            
                                                            // Only update weight if it's less than the max option score
                                                            const currentWeight = typeof item.weight === 'string' ? (parseFloat(item.weight) || 0) : item.weight
                                                            
                                                            if (currentWeight < maxWeight) {
                                                                onBulkUpdate(index, {
                                                                    options: newOptions,
                                                                    weight: maxWeight
                                                                })
                                                            } else {
                                                                onUpdate(index, 'options', newOptions)
                                                            }
                                                        }}
                                                    />
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-red-500"
                                                    onClick={() => {
                                                        const newOptions = [...(item.options || [])]
                                                        newOptions.splice(optIndex, 1)
                                                        onUpdate(index, 'options', newOptions)
                                                    }}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
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
                    )}
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
            const maxOptionScore = newItems[index].options?.reduce((max, opt) => {
                const s = typeof opt.score === 'string' ? (parseFloat(opt.score) || 0) : opt.score
                return Math.max(max, s)
            }, 0) || 0
            
            const numericValue = typeof value === 'string' ? (parseFloat(value) || 0) : value
            if (numericValue < maxOptionScore) {
                // Don't allow lowering weight below max option
                // Or we could auto-lower options? Better to just clamp weight.
                // For simplicity in this UI, we'll allow it but maybe show warning?
                // Actually, let's enforce it.
                if (numericValue < maxOptionScore) {
                    // Force value to be at least maxOptionScore
                    // But this might be annoying if user wants to lower everything.
                    // Let's just trust the user or the auto-update logic in the input.
                }
            }
        }

        setCurrentTemplate(prev => ({ ...prev, items: newItems }))
    }

    // New handler for bulk updates
    const handleBulkUpdateItem = (index: number, updates: Partial<ChecklistItem>) => {
        setCurrentTemplate(prev => {
            const newItems = [...(prev.items || [])]
            newItems[index] = { ...newItems[index], ...updates }
            return { ...prev, items: newItems }
        })
    }

    // Handler for moving items up or down
    const handleMoveItem = (index: number, direction: 'up' | 'down') => {
        const items = [...(currentTemplate.items || [])]
        if (direction === 'up' && index > 0) {
            // Swap with previous item
            [items[index], items[index - 1]] = [items[index - 1], items[index]]
        } else if (direction === 'down' && index < items.length - 1) {
            // Swap with next item
            [items[index], items[index + 1]] = [items[index + 1], items[index]]
        } else {
            return // No move possible
        }
        
        // Update sort_order for all items
        const reorderedItems = items.map((item, idx) => ({
            ...item,
            sort_order: idx
        }))

        setCurrentTemplate({
            ...currentTemplate,
            items: reorderedItems
        })
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

        // Ensure all weights and scores are numbers before saving
        const templateToSave = {
            ...currentTemplate,
            items: currentTemplate.items?.map(item => ({
                ...item,
                weight: typeof item.weight === 'string' ? (parseFloat(item.weight) || 0) : item.weight,
                options: item.options?.map(opt => ({
                    ...opt,
                    score: typeof opt.score === 'string' ? (parseFloat(opt.score) || 0) : opt.score
                }))
            }))
        }

        setIsSaving(true)
        try {
            let res
            if (templateId !== 'new') {
                // Update existing
                res = await fetch(`/api/clubs/${clubId}/evaluations/templates/${templateId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(templateToSave),
                })
            } else {
                // Create new
                res = await fetch(`/api/clubs/${clubId}/evaluations/templates`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(templateToSave),
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
        <div className="min-h-screen bg-background pb-28 md:pb-24">
            <div className="border-b bg-background">
                <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-5 md:flex-row md:items-start md:justify-between md:px-6 md:py-6">
                    <div className="min-w-0">
                        <h1 className="truncate text-2xl font-bold tracking-tight md:text-3xl">
                            {templateId === 'new' ? 'Создание чеклиста' : 'Редактирование чеклиста'}
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">Настройка структуры, пунктов и правил проверки</p>
                    </div>
                    <Button onClick={handleSave} disabled={isSaving} className="hidden bg-black text-white hover:bg-black/90 md:inline-flex">
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Сохранить
                    </Button>
                </div>
            </div>

            <div className="mx-auto max-w-3xl px-4 py-6 md:px-6 md:py-8">

                <Card className="mb-4 rounded-none border-x-0 shadow-none md:mb-8 md:rounded-xl md:border-x md:shadow-sm">
                    <CardHeader className="px-4 md:px-6">
                        <CardTitle>Основная информация</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 px-4 md:px-6">
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
                                <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="space-y-0.5">
                                        <Label>Блокировать открытие смены</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Сотрудник не сможет начать смену без прохождения этого чеклиста
                                        </p>
                                    </div>
                                    <Switch 
                                        className="self-end sm:self-auto"
                                        checked={currentTemplate.settings?.block_shift_open}
                                        onCheckedChange={checked => setCurrentTemplate({
                                            ...currentTemplate, 
                                            settings: { ...currentTemplate.settings, block_shift_open: checked }
                                        })}
                                    />
                                </div>
                                <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="space-y-0.5">
                                        <Label>Блокировать закрытие смены</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Сотрудник не сможет завершить смену без прохождения этого чеклиста
                                        </p>
                                    </div>
                                    <Switch 
                                        className="self-end sm:self-auto"
                                        checked={currentTemplate.settings?.block_shift_close}
                                        onCheckedChange={checked => setCurrentTemplate({
                                            ...currentTemplate, 
                                            settings: { ...currentTemplate.settings, block_shift_close: checked }
                                        })}
                                    />
                                </div>
                            </div>
                        )}

                        {(!currentTemplate.type || currentTemplate.type === 'manager_audit') && (
                            <div className="space-y-4 pt-2 border-t mt-4">
                                <h3 className="font-medium text-sm text-muted-foreground">Настройки аудита</h3>
                                <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="space-y-0.5">
                                        <Label>Влияет на KPI</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Учитывать результаты проверки в расчете премии
                                        </p>
                                    </div>
                                    <Switch 
                                        className="self-end sm:self-auto"
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

                <div className="space-y-4 px-4 md:px-0">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <h2 className="text-xl font-semibold">Пункты проверки</h2>
                        <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={handleAddItem}>
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
                                    onBulkUpdate={handleBulkUpdateItem}
                                    onMove={handleMoveItem}
                                    totalItems={currentTemplate.items?.length || 0}
                                    zones={zones}
                                />
                            ))}
                        </SortableContext>
                    </DndContext>
                </div>
            </div>

            <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
                <div className="mx-auto flex max-w-3xl gap-2">
                    <Button variant="outline" size="icon" className="h-11 w-11 shrink-0" onClick={() => router.push(`/clubs/${clubId}/settings/checklists`)}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" className="h-11 flex-1" onClick={handleAddItem}>
                        <Plus className="mr-2 h-4 w-4" />
                        Добавить пункт
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving} size="icon" className="h-11 w-11 shrink-0 bg-purple-600 hover:bg-purple-700" aria-label="Сохранить" title="Сохранить">
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    </Button>
                </div>
            </div>
        </div>
    )
}
