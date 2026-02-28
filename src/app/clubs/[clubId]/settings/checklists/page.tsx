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
import Link from "next/link"

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

export default function ChecklistSettingsPage({ params }: { params: Promise<{ clubId: string }> }) {
    const router = useRouter()
    const [clubId, setClubId] = useState('')
    const [templates, setTemplates] = useState<ChecklistTemplate[]>([])
    const [isEditing, setIsEditing] = useState(false)
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

    useEffect(() => {
        params.then(p => {
            setClubId(p.clubId)
            fetchTemplates(p.clubId)
            fetchZones(p.clubId)
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

    const fetchTemplates = async (id: string) => {
        try {
            const res = await fetch(`/api/clubs/${id}/evaluations/templates`)
            const data = await res.json()
            if (res.ok && Array.isArray(data)) setTemplates(data)
        } catch (error) {
            console.error(error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleAddItem = () => {
        const newItem: ChecklistItem = {
            content: '',
            description: '',
            weight: 1.0,
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
        setCurrentTemplate({ ...currentTemplate, items: newItems })
    }

    const handleRemoveItem = (index: number) => {
        const newItems = [...(currentTemplate.items || [])]
        newItems.splice(index, 1)
        setCurrentTemplate({ ...currentTemplate, items: newItems })
    }

    const handleDeleteTemplate = async (templateId: number) => {
        if (!confirm('Вы уверены, что хотите удалить этот чеклист?')) return

        try {
            const res = await fetch(`/api/clubs/${clubId}/evaluations/templates/${templateId}`, {
                method: 'DELETE'
            })

            if (res.ok) {
                fetchTemplates(clubId)
            } else {
                alert('Ошибка удаления')
            }
        } catch (error) {
            console.error(error)
            alert('Ошибка сервера')
        }
    }

    const handleSave = async () => {
        if (!currentTemplate.name) return alert('Введите название чеклиста')

        setIsSaving(true)
        try {
            let res
            if (currentTemplate.id) {
                // Update existing
                res = await fetch(`/api/clubs/${clubId}/evaluations/templates/${currentTemplate.id}`, {
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
                setIsEditing(false)
                fetchTemplates(clubId)
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

    if (isEditing) {
        return (
            <div className="min-h-screen bg-background p-8 pb-24">
                <div className="mx-auto max-w-3xl">
                    <div className="mb-8 flex items-center justify-between">
                        <div>
                            <button onClick={() => setIsEditing(false)} className="mb-2 flex items-center text-sm text-muted-foreground hover:text-foreground">
                                <ArrowLeft className="mr-1 h-4 w-4" /> К списку
                            </button>
                            <h1 className="text-3xl font-bold">Создание чеклиста</h1>
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

                        {currentTemplate.items?.map((item, index) => (
                            <Card key={index} className="overflow-hidden">
                                <div className="flex items-start bg-card p-4">
                                    <div className="mt-3 mr-3 text-muted-foreground">
                                        <GripVertical className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <Badge variant="secondary">Пункт {index + 1}</Badge>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500"
                                                onClick={() => handleRemoveItem(index)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        <div className="grid gap-2">
                                            <Label className="text-xs">Что проверить?</Label>
                                            <Input
                                                placeholder="Напр: Чистота рабочих поверхностей"
                                                value={item.content}
                                                onChange={e => handleUpdateItem(index, 'content', e.target.value)}
                                            />
                                        </div>
                                        <div className="flex gap-4">
                                            <div className="flex-1 grid gap-2">
                                                <Label className="text-xs">Доп. описание (опционально)</Label>
                                                <Input
                                                    placeholder="Пояснение для проверяющего"
                                                    value={item.description}
                                                    onChange={e => handleUpdateItem(index, 'description', e.target.value)}
                                                    className="text-sm"
                                                />
                                            </div>
                                            <div className="w-24 grid gap-2">
                                                <Label className="text-xs">Вес (1.0)</Label>
                                                <Input
                                                    type="number"
                                                    step="0.1"
                                                    value={item.weight}
                                                    onChange={e => handleUpdateItem(index, 'weight', parseFloat(e.target.value))}
                                                    className="text-sm"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-4 pt-2">
                                            <div className="flex items-center gap-2">
                                                <Switch 
                                                    id={`photo-required-${index}`}
                                                    checked={item.is_photo_required}
                                                    onCheckedChange={checked => handleUpdateItem(index, 'is_photo_required', checked)}
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
                                                        onChange={e => handleUpdateItem(index, 'min_photos', parseInt(e.target.value))}
                                                        className="w-16 h-8 text-sm"
                                                    />
                                                </div>
                                            )}

                                            <div className="flex items-center gap-2">
                                                <Label className="text-xs whitespace-nowrap">Привязка:</Label>
                                                <Select 
                                                    value={item.related_entity_type || 'none'} 
                                                    onValueChange={(val) => handleUpdateItem(index, 'related_entity_type', val === 'none' ? null : val)}
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
                                                        onValueChange={(val) => handleUpdateItem(index, 'target_zone', val === 'all' ? null : val)}
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
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background p-8">
            <div className="mx-auto max-w-5xl">
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">Настройка чеклистов</h1>
                        <p className="text-muted-foreground">Управление шаблонами проверок и приемки смен</p>
                    </div>
                    <Button onClick={() => {
                        setCurrentTemplate({ name: '', description: '', items: [], type: 'manager_audit', settings: {} })
                        setIsEditing(true)
                    }} className="bg-purple-600 hover:bg-purple-700">
                        <Plus className="mr-2 h-4 w-4" /> Новый шаблон
                    </Button>
                </div>

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {templates.map(template => (
                        <Card key={template.id} className="hover:border-purple-500/50 transition-colors">
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
                                        <ClipboardCheck className="h-6 w-6" />
                                    </div>
                                    <Badge variant="outline">
                                        {template.type === 'shift_handover' ? 'Приемка смены' : 'Аудит'}
                                    </Badge>
                                </div>
                                <CardTitle>{template.name}</CardTitle>
                                <CardDescription>{template.description || 'Нет описания'}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">{template.items?.length || 0} пунктов</span>
                                    <span className="text-xs text-muted-foreground">
                                        {new Date(template.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                                <div className="mt-4 flex gap-2">
                                    <Button 
                                        variant="outline" 
                                        size="icon" 
                                        className="shrink-0 text-red-500 hover:text-red-600 hover:bg-red-50" 
                                        onClick={() => handleDeleteTemplate(template.id)}
                                        title="Удалить чеклист"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                    <Button variant="outline" className="flex-1" onClick={() => {
                                        setCurrentTemplate(template)
                                        setIsEditing(true)
                                    }}>
                                        Изменить
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}

                    {templates.length === 0 && (
                        <div className="col-span-full border-2 border-dashed rounded-xl p-12 text-center">
                            <ClipboardCheck className="mx-auto h-12 w-12 text-muted-foreground mb-4 opacity-20" />
                            <h3 className="text-lg font-medium">У вас еще нет чеклистов</h3>
                            <p className="text-muted-foreground mb-6">Создайте свой первый шаблон</p>
                            <Button onClick={() => setIsEditing(true)}>Начать</Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
