"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
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
        <div ref={setNodeRef} style={style} className="mb-4 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm transition-all hover:border-slate-200 hover:shadow-md">
            <div className="flex items-start p-6 md:p-8">
                <div {...attributes} {...listeners} className="mt-1 mr-4 text-slate-300 hover:text-slate-600 transition-colors cursor-move touch-none hidden md:block">
                    <GripVertical className="h-6 w-6" />
                </div>
                <div className="flex-1 space-y-6 min-w-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Badge variant="outline" className="text-xs font-semibold bg-slate-50 border-slate-200 text-slate-600 rounded-lg px-2.5 py-0.5">
                                Пункт {index + 1}
                            </Badge>
                            
                            {/* Mobile Move Buttons */}
                            <div className="flex items-center gap-1.5 md:hidden">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 rounded-lg border-slate-200 text-slate-600"
                                    disabled={index === 0}
                                    onClick={() => onMove(index, 'up')}
                                >
                                    <ChevronUp className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 rounded-lg border-slate-200 text-slate-600"
                                    disabled={index === totalItems - 1}
                                    onClick={() => onMove(index, 'down')}
                                >
                                    <ChevronDown className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 shrink-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                            onClick={() => onRemove(index)}
                        >
                            <Trash2 className="h-5 w-5" />
                        </Button>
                    </div>
                    <div className="grid gap-3">
                        <Label className="text-sm font-medium ml-1">Что проверить?</Label>
                        <Input
                            placeholder="Напр: Чистота рабочих поверхностей"
                            value={item.content}
                            onChange={e => onUpdate(index, 'content', e.target.value)}
                            className="text-sm h-11 rounded-xl bg-slate-50/50 border-slate-200"
                        />
                    </div>
                    <div className="flex flex-col sm:flex-row gap-6">
                        <div className="flex-1 grid gap-3">
                            <Label className="text-sm font-medium ml-1">Доп. описание (опционально)</Label>
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
                                className="text-sm resize-none overflow-hidden min-h-[44px] rounded-xl bg-slate-50/50 border-slate-200 p-3 leading-relaxed"
                                rows={1}
                            />
                        </div>
                        <div className="w-full sm:w-32 grid gap-3">
                            <Label className="text-sm font-medium ml-1">Вес (Баллы)</Label>
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
                                className="text-sm text-center h-11 rounded-xl bg-slate-50/50 border-slate-200 font-semibold"
                                disabled={item.related_entity_type === 'workstations' || (item.options && item.options.length > 0)}
                            />
                        </div>
                    </div>
                    <div className="flex flex-col gap-4 pt-4 sm:flex-row sm:flex-wrap sm:items-center">
                        <div className="flex items-center gap-3">
                            <Switch 
                                id={`photo-required-${index}`}
                                checked={item.is_photo_required}
                                onCheckedChange={checked => onUpdate(index, 'is_photo_required', checked)}
                                className="data-[state=checked]:bg-slate-900"
                            />
                            <Label htmlFor={`photo-required-${index}`} className="flex items-center gap-1 text-sm font-medium cursor-pointer select-none text-slate-700">
                                Требовать фото
                            </Label>
                        </div>

                        {item.is_photo_required && (
                            <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2 ml-2">
                                <Label className="text-sm font-medium text-slate-500 whitespace-nowrap">Мин. фото:</Label>
                                <Input
                                    type="number"
                                    min="1"
                                    max="10"
                                    value={item.min_photos || 1}
                                    onChange={e => onUpdate(index, 'min_photos', parseInt(e.target.value))}
                                    className="w-16 h-9 rounded-lg text-sm text-center bg-slate-50/50 border-slate-200 font-medium"
                                />
                            </div>
                        )}
                        
                        <div className="hidden h-6 w-px bg-slate-200 sm:block mx-4" />

                        <div className="flex items-center gap-3">
                            <Switch 
                                id={`workstation-check-${index}`}
                                checked={item.related_entity_type === 'workstations'}
                                onCheckedChange={(checked) => handleWorkstationToggle(checked)}
                                className="data-[state=checked]:bg-slate-900"
                            />
                            <Label htmlFor={`workstation-check-${index}`} className="flex items-center gap-1 text-sm font-medium cursor-pointer select-none text-slate-700">
                                Проверять рабочие места
                            </Label>
                        </div>

                        {item.related_entity_type === 'workstations' && (
                            <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2 w-full sm:w-auto ml-2">
                                <Label className="text-sm font-medium text-slate-500 whitespace-nowrap">Зона:</Label>
                                <Select 
                                    value={item.target_zone || 'all'} 
                                    onValueChange={(val) => onUpdate(index, 'target_zone', val === 'all' ? null : val)}
                                >
                                    <SelectTrigger className="h-9 flex-1 sm:w-[160px] rounded-lg bg-slate-50/50 border-slate-200 text-sm font-medium">
                                        <SelectValue placeholder="Все зоны" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-slate-200">
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
                            <div className="mt-6 border-t border-slate-100 pt-6">
                            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <Label className="text-sm font-medium text-slate-700">Варианты замечаний <span className="text-slate-400 font-normal">(Опционально)</span></Label>
                                <Button 
                                    variant="secondary" 
                                    size="sm" 
                                    className="h-9 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium px-4 w-fit"
                                    onClick={() => {
                                        const currentOptions = item.options || []
                                        onUpdate(index, 'options', [...currentOptions, { label: '', score: 0 }])
                                    }}
                                >
                                    <Plus className="h-4 w-4 mr-1.5" /> Добавить вариант
                                </Button>
                            </div>
                            
                            {item.options && item.options.length > 0 && (
                                <div className="space-y-3">
                                    {item.options.map((option, optIndex) => (
                                        <div key={optIndex} className="flex gap-3">
                                            <Input
                                                placeholder="Текст замечания (напр. Грязно)"
                                                value={option.label}
                                                onChange={(e) => {
                                                    const newOptions = [...(item.options || [])]
                                                    newOptions[optIndex] = { ...newOptions[optIndex], label: e.target.value }
                                                    onUpdate(index, 'options', newOptions)
                                                }}
                                                className="h-11 flex-1 rounded-xl text-sm bg-slate-50/50 border-slate-200"
                                            />
                                            <div className="flex items-center gap-2">
                                                <div className="w-20 sm:w-24">
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
                                                    size="icon"
                                                    className="h-11 w-11 shrink-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                                                    onClick={() => {
                                                        const newOptions = [...(item.options || [])]
                                                        newOptions.splice(optIndex, 1)
                                                        onUpdate(index, 'options', newOptions)
                                                    }}
                                                >
                                                    <Trash2 className="h-5 w-5" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {(!item.options || item.options.length === 0) && (
                                <div className="text-sm text-slate-500 italic bg-slate-50/50 rounded-xl border border-slate-100 p-4 text-center">
                                    Нет вариантов. Будет использована стандартная оценка.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
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
        <div className="min-h-screen bg-slate-50/30 pb-28 md:pb-24">
            <div className="border-b bg-white">
                <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-5 md:flex-row md:items-start md:justify-between md:px-6 md:py-6">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => router.push(`/clubs/${clubId}/settings/checklists`)} className="hidden md:flex h-11 w-11 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 shadow-sm shrink-0">
                            <ArrowLeft className="h-5 w-5 text-slate-600" />
                        </Button>
                        <div className="min-w-0">
                            <h1 className="truncate text-2xl font-bold tracking-tight md:text-3xl">
                                {templateId === 'new' ? 'Создание чеклиста' : 'Редактирование чеклиста'}
                            </h1>
                            <p className="mt-1 text-sm text-muted-foreground">Настройка структуры, пунктов и правил проверки</p>
                        </div>
                    </div>
                    <div className="hidden md:flex gap-3">
                        <Button onClick={() => router.push(`/clubs/${clubId}/settings/checklists`)} variant="outline" className="h-11 rounded-xl px-6 border-slate-200 bg-white font-medium shadow-sm">
                            Отмена
                        </Button>
                        <Button onClick={handleSave} disabled={isSaving} className="h-11 rounded-xl px-6 bg-slate-900 text-white hover:bg-slate-800 font-medium shadow-sm">
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Сохранить
                        </Button>
                    </div>
                </div>
            </div>

            <div className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-8 space-y-8">
                <div className="rounded-3xl border border-slate-100 bg-white p-6 md:p-8 shadow-sm">
                    <div className="mb-6">
                        <h2 className="text-xl font-semibold">Основная информация</h2>
                    </div>
                    <div className="space-y-6">
                        <div className="grid gap-3">
                            <Label className="text-sm font-medium ml-1">Название чеклиста</Label>
                            <Input
                                placeholder="Напр: Утренняя проверка"
                                value={currentTemplate.name}
                                onChange={e => setCurrentTemplate({ ...currentTemplate, name: e.target.value })}
                                className="h-11 rounded-xl bg-slate-50/50 border-slate-200"
                            />
                        </div>
                        <div className="grid gap-3">
                            <Label className="text-sm font-medium ml-1">Описание</Label>
                            <Input
                                placeholder="Для чего этот чеклист"
                                value={currentTemplate.description}
                                onChange={e => setCurrentTemplate({ ...currentTemplate, description: e.target.value })}
                                className="h-11 rounded-xl bg-slate-50/50 border-slate-200"
                            />
                        </div>

                        <div className="grid gap-3">
                            <Label className="text-sm font-medium ml-1">Тип чеклиста</Label>
                            <Select 
                                value={currentTemplate.type || 'manager_audit'} 
                                onValueChange={(val: any) => setCurrentTemplate({...currentTemplate, type: val})}
                            >
                                <SelectTrigger className="h-11 rounded-xl bg-slate-50/50 border-slate-200">
                                    <SelectValue placeholder="Выберите тип" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-slate-200">
                                    <SelectItem value="manager_audit">Аудит (Управляющий)</SelectItem>
                                    <SelectItem value="shift_handover">Приемка смены (Сотрудник)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {currentTemplate.type === 'shift_handover' && (
                            <div className="space-y-4 pt-6 border-t border-slate-100 mt-6">
                                <h3 className="font-medium text-sm text-muted-foreground ml-1">Настройки приемки</h3>
                                <div className="flex flex-col gap-3 rounded-2xl bg-slate-50/50 border border-slate-100 p-5 transition-colors hover:bg-slate-50">
                                    <div className="space-y-1">
                                        <Label className="text-sm font-medium text-slate-700">Кого проверяем</Label>
                                        <p className="text-xs text-slate-500 leading-relaxed">
                                            Для приемки при открытии обычно выбирают смену/сотрудника. Для чеклиста при закрытии — проверка себя.
                                        </p>
                                    </div>
                                    <Select
                                        value={currentTemplate.settings?.target_mode === 'SELF' ? 'SELF' : 'SHIFT'}
                                        onValueChange={(val) => setCurrentTemplate({
                                            ...currentTemplate,
                                            settings: { ...currentTemplate.settings, target_mode: val }
                                        })}
                                    >
                                        <SelectTrigger className="h-11 rounded-xl bg-white border-slate-200">
                                            <SelectValue placeholder="Выберите режим" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl border-slate-200">
                                            <SelectItem value="SHIFT">Выбирать смену / сотрудника</SelectItem>
                                            <SelectItem value="SELF">Проверка себя</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex flex-col gap-4 rounded-2xl bg-slate-50/50 border border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between group/switch transition-colors hover:bg-slate-50">
                                    <div className="space-y-1">
                                        <Label className="text-sm font-medium text-slate-700 cursor-pointer" htmlFor="block-open">Блокировать открытие смены</Label>
                                        <p className="text-xs text-slate-500 leading-relaxed">
                                            Сотрудник не сможет начать смену без прохождения этого чеклиста
                                        </p>
                                    </div>
                                    <Switch 
                                        id="block-open"
                                        className="self-end sm:self-auto data-[state=checked]:bg-slate-900"
                                        checked={currentTemplate.settings?.block_shift_open}
                                        onCheckedChange={checked => setCurrentTemplate({
                                            ...currentTemplate, 
                                            settings: { ...currentTemplate.settings, block_shift_open: checked }
                                        })}
                                    />
                                </div>
                                <div className="flex flex-col gap-4 rounded-2xl bg-slate-50/50 border border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between group/switch transition-colors hover:bg-slate-50">
                                    <div className="space-y-1">
                                        <Label className="text-sm font-medium text-slate-700 cursor-pointer" htmlFor="block-close">Блокировать закрытие смены</Label>
                                        <p className="text-xs text-slate-500 leading-relaxed">
                                            Сотрудник не сможет завершить смену без прохождения этого чеклиста
                                        </p>
                                    </div>
                                    <Switch 
                                        id="block-close"
                                        className="self-end sm:self-auto data-[state=checked]:bg-slate-900"
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
                            <div className="space-y-4 pt-6 border-t border-slate-100 mt-6">
                                <h3 className="font-medium text-sm text-muted-foreground ml-1">Настройки аудита</h3>
                                <div className="flex flex-col gap-4 rounded-2xl bg-slate-50/50 border border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between group/switch transition-colors hover:bg-slate-50">
                                    <div className="space-y-1">
                                        <Label className="text-sm font-medium text-slate-700 cursor-pointer" htmlFor="affects-kpi">Влияет на KPI</Label>
                                        <p className="text-xs text-slate-500 leading-relaxed">
                                            Учитывать результаты проверки в расчете премии
                                        </p>
                                    </div>
                                    <Switch 
                                        id="affects-kpi"
                                        className="self-end sm:self-auto data-[state=checked]:bg-slate-900"
                                        checked={currentTemplate.settings?.affects_kpi}
                                        onCheckedChange={checked => setCurrentTemplate({
                                            ...currentTemplate, 
                                            settings: { ...currentTemplate.settings, affects_kpi: checked }
                                        })}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-2">
                        <div>
                            <h2 className="text-xl font-semibold">Пункты проверки</h2>
                            <p className="text-sm text-muted-foreground mt-1">Добавьте задачи, которые нужно проверить</p>
                        </div>
                        <Button className="h-11 rounded-xl px-6 bg-slate-900 text-white hover:bg-slate-800 font-medium w-full sm:w-auto" onClick={handleAddItem}>
                            <Plus className="mr-2 h-4 w-4" /> Добавить пункт
                        </Button>
                    </div>

                    {currentTemplate.items?.length === 0 && (
                        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50/50 py-16 text-center">
                            <div className="h-12 w-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center mb-4 shadow-sm">
                                <Plus className="h-5 w-5 text-slate-400" />
                            </div>
                            <p className="text-sm font-medium text-slate-900">В чеклисте пока нет пунктов</p>
                            <p className="text-xs text-slate-500 mt-1">Добавьте первый пункт проверки</p>
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

            <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-white/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-white/80 md:hidden">
                <div className="mx-auto flex max-w-4xl gap-2">
                    <Button variant="outline" size="icon" className="h-12 w-12 shrink-0 rounded-xl border-slate-200" onClick={() => router.push(`/clubs/${clubId}/settings/checklists`)}>
                        <ArrowLeft className="h-5 w-5 text-slate-600" />
                    </Button>
                    <Button variant="outline" className="h-12 flex-1 rounded-xl border-slate-200 font-medium" onClick={handleAddItem}>
                        <Plus className="mr-2 h-4 w-4" />
                        Добавить пункт
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving} size="icon" className="h-12 w-12 shrink-0 bg-slate-900 text-white hover:bg-slate-800 rounded-xl" aria-label="Сохранить" title="Сохранить">
                        {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                    </Button>
                </div>
            </div>
        </div>
    )
}
