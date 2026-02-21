"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Plus, GripVertical, Save, Trash2, ArrowLeft, ClipboardCheck, History, Camera, ExternalLink } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

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

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"

interface Evaluation {
    id: number
    template_name: string
    employee_name: string
    evaluator_name: string
    total_score: number
    max_score: number
    evaluation_date: string
    created_at: string
}

interface EvaluationDetail extends Evaluation {
    comments?: string
    responses: {
        id: number
        item_content: string
        score: number
        comment?: string
        photo_url?: string
        photo_urls?: string[]
    }[]
}

export default function ChecklistSettingsPage({ params }: { params: Promise<{ clubId: string }> }) {
    const router = useRouter()
    const [clubId, setClubId] = useState('')
    const [templates, setTemplates] = useState<ChecklistTemplate[]>([])
    const [history, setHistory] = useState<Evaluation[]>([])
    const [selectedEvaluation, setSelectedEvaluation] = useState<EvaluationDetail | null>(null)
    const [isDetailLoading, setIsDetailLoading] = useState(false)
    const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)
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
            fetchHistory(p.clubId)
            fetchZones(p.clubId)
        })
    }, [params])

    useEffect(() => {
        setPhotoPreviewUrl(null)
    }, [selectedEvaluation])

    const fetchZones = async (id: string) => {
        try {
            const res = await fetch(`/api/clubs/${id}/workstations`)
            if (res.ok) {
                const data = await res.json()
                // Extract unique zones from workstations
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

    const fetchHistory = async (id: string) => {
        try {
            const res = await fetch(`/api/clubs/${id}/evaluations`)
            const data = await res.json()
            if (res.ok && Array.isArray(data)) setHistory(data)
        } catch (error) {
            console.error(error)
        }
    }

    const handleViewEvaluation = async (evaluationId: number) => {
        // Find basic info from history first to show immediately
        const basicInfo = history.find(h => h.id === evaluationId)
        if (basicInfo) {
            // @ts-ignore - responses missing initially
            setSelectedEvaluation({ ...basicInfo, responses: [] })
        }
        
        setIsDetailLoading(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/evaluations/${evaluationId}`)
            const data = await res.json()
            if (res.ok) {
                setSelectedEvaluation(data)
            } else {
                alert('Не удалось загрузить детали')
            }
        } catch (error) {
            console.error(error)
        } finally {
            setIsDetailLoading(false)
        }
    }

    const handleDeleteEvaluation = async (evaluationId: number) => {
        if (!confirm('Удалить эту проверку?')) return

        try {
            const res = await fetch(`/api/clubs/${clubId}/evaluations/${evaluationId}`, {
                method: 'DELETE'
            })

            if (res.ok) {
                setHistory(prev => prev.filter(item => item.id !== evaluationId))
                if (selectedEvaluation?.id === evaluationId) {
                    setSelectedEvaluation(null)
                    setPhotoPreviewUrl(null)
                }
            } else {
                alert('Ошибка удаления')
            }
        } catch (error) {
            console.error(error)
            alert('Ошибка сервера')
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
                        <h1 className="text-3xl font-bold">Система чеклистов</h1>
                        <p className="text-muted-foreground">Создавайте шаблоны для живой оценки сотрудников</p>
                    </div>
                    <Button onClick={() => {
                        setCurrentTemplate({ name: '', description: '', items: [], type: 'manager_audit', settings: {} })
                        setIsEditing(true)
                    }} className="bg-purple-600 hover:bg-purple-700">
                        <Plus className="mr-2 h-4 w-4" /> Новый чеклист
                    </Button>
                </div>

                <Tabs defaultValue="templates" className="w-full">
                    <TabsList className="mb-6">
                        <TabsTrigger value="templates" className="flex items-center gap-2">
                            <ClipboardCheck className="h-4 w-4" />
                            Шаблоны
                        </TabsTrigger>
                        <TabsTrigger value="history" className="flex items-center gap-2">
                            <History className="h-4 w-4" />
                            История проверок
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="templates">
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
                                            <Link href={`/clubs/${clubId}/evaluations/new?templateId=${template.id}`} className="flex-1">
                                                <Button className="w-full bg-green-600 hover:bg-green-700">
                                                    Проверить
                                                </Button>
                                            </Link>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}

                            {templates.length === 0 && (
                                <div className="col-span-full border-2 border-dashed rounded-xl p-12 text-center">
                                    <ClipboardCheck className="mx-auto h-12 w-12 text-muted-foreground mb-4 opacity-20" />
                                    <h3 className="text-lg font-medium">У вас еще нет чеклистов</h3>
                                    <p className="text-muted-foreground mb-6">Создайте свой первый шаблон для оценки персонала</p>
                                    <Button onClick={() => setIsEditing(true)}>Начать</Button>
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="history">
                        <Card>
                            <CardHeader>
                                <CardTitle>История проверок</CardTitle>
                                <CardDescription>Список всех проведенных оценок и чеклистов</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {history.length === 0 ? (
                                    <div className="text-center py-12 text-muted-foreground">
                                        <History className="mx-auto h-12 w-12 opacity-20 mb-4" />
                                        <p>Проверок еще не проводилось</p>
                                    </div>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Дата</TableHead>
                                                <TableHead>Шаблон</TableHead>
                                                <TableHead>Сотрудник</TableHead>
                                                <TableHead>Проверяющий</TableHead>
                                                <TableHead className="text-right">Результат</TableHead>
                                                <TableHead className="w-12"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {history.map(evaluation => (
                                                <TableRow key={evaluation.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleViewEvaluation(evaluation.id)}>
                                                    <TableCell>{new Date(evaluation.evaluation_date || evaluation.created_at).toLocaleDateString()}</TableCell>
                                                    <TableCell>{evaluation.template_name}</TableCell>
                                                    <TableCell>{evaluation.employee_name}</TableCell>
                                                    <TableCell>{evaluation.evaluator_name || '—'}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Badge variant={evaluation.total_score >= 80 ? 'default' : evaluation.total_score >= 50 ? 'secondary' : 'destructive'}>
                                                            {Math.round(evaluation.total_score)}%
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-muted-foreground hover:text-red-500"
                                                            onClick={(event) => {
                                                                event.stopPropagation()
                                                                handleDeleteEvaluation(evaluation.id)
                                                            }}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

                <Dialog
                    open={!!selectedEvaluation}
                    onOpenChange={(open) => {
                        if (!open) {
                            setSelectedEvaluation(null)
                            setPhotoPreviewUrl(null)
                        }
                    }}
                >
                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Результаты проверки</DialogTitle>
                            <DialogDescription>
                                {selectedEvaluation?.template_name} • {selectedEvaluation && new Date(selectedEvaluation.evaluation_date || selectedEvaluation.created_at).toLocaleDateString()}
                            </DialogDescription>
                        </DialogHeader>
                        
                        {isDetailLoading ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : selectedEvaluation ? (
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <p className="text-muted-foreground">Сотрудник</p>
                                        <p className="font-medium">{selectedEvaluation.employee_name}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground">Проверяющий</p>
                                        <p className="font-medium">{selectedEvaluation.evaluator_name || '—'}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground">Результат</p>
                                        <Badge variant={selectedEvaluation.total_score >= 80 ? 'default' : selectedEvaluation.total_score >= 50 ? 'secondary' : 'destructive'}>
                                            {Math.round(selectedEvaluation.total_score)}%
                                        </Badge>
                                    </div>
                                </div>

                                {selectedEvaluation.comments && (
                                    <div className="bg-muted p-4 rounded-lg">
                                        <p className="text-xs text-muted-foreground mb-1">Комментарий проверяющего</p>
                                        <p className="text-sm">{selectedEvaluation.comments}</p>
                                    </div>
                                )}

                                <div>
                                    <h3 className="font-semibold mb-3">Детализация</h3>
                                    <div className="space-y-3">
                                        {selectedEvaluation.responses?.map((response, index) => {
                                            const photos = response.photo_urls && response.photo_urls.length > 0
                                                ? response.photo_urls
                                                : response.photo_url
                                                    ? [response.photo_url]
                                                    : []

                                            return (
                                            <div key={index} className="border rounded-lg p-3">
                                                <div className="flex justify-between items-start mb-2">
                                                    <p className="text-sm font-medium">{response.item_content}</p>
                                                    {response.score > 0 ? (
                                                        <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">Да</Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">Нет</Badge>
                                                    )}
                                                </div>
                                                {response.comment && (
                                                    <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                                                        {response.comment}
                                                    </p>
                                                )}
                                                {photos.length > 0 && (
                                                    <div className="mt-2 space-y-2">
                                                        <div className="flex flex-wrap gap-2">
                                                            {photos.map((url, photoIndex) => (
                                                                <Button
                                                                    key={`${response.id}-${photoIndex}`}
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="h-7 gap-2"
                                                                    onClick={() => setPhotoPreviewUrl(url)}
                                                                >
                                                                    <Camera className="h-3 w-3" />
                                                                    Посмотреть фото
                                                                </Button>
                                                            ))}
                                                        </div>
                                                        {photoPreviewUrl && photos.includes(photoPreviewUrl) && (
                                                            <div className="border rounded-lg p-2 bg-muted/30">
                                                                <img src={photoPreviewUrl} alt="Фото" className="w-full max-h-[360px] object-contain rounded" />
                                                                <div className="flex justify-end mt-2">
                                                                    <Button variant="ghost" size="sm" onClick={() => setPhotoPreviewUrl(null)}>
                                                                        Закрыть
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    )
}
