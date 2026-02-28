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
        return null // Should redirect to dynamic page
    }

    return (
        <div className="min-h-screen bg-background p-8">
            <div className="mx-auto max-w-5xl">
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">Настройка чеклистов</h1>
                        <p className="text-muted-foreground">Управление шаблонами проверок и приемки смен</p>
                    </div>
                    <Button onClick={() => router.push(`/clubs/${clubId}/settings/checklists/new`)} className="bg-purple-600 hover:bg-purple-700">
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
                                    <Button variant="outline" className="flex-1" onClick={() => router.push(`/clubs/${clubId}/settings/checklists/${template.id}`)}>
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
                            <Button onClick={() => router.push(`/clubs/${clubId}/settings/checklists/new`)}>Начать</Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
