"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Loader2, Plus, Trash2, ArrowLeft, ClipboardCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

interface ChecklistTemplate {
    id: number
    name: string
    description: string
    items: any[]
    type?: 'shift_handover' | 'manager_audit'
    created_at: string
}

export default function ChecklistSettingsPage({ params }: { params: Promise<{ clubId: string }> }) {
    const router = useRouter()
    const [clubId, setClubId] = useState('')
    const [templates, setTemplates] = useState<ChecklistTemplate[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        params.then(p => {
            setClubId(p.clubId)
            fetchTemplates(p.clubId)
        })
    }, [params])

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

    if (isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>

    return (
        <div className="min-h-screen bg-background pb-24 md:pb-8">
            <div className="border-b bg-background">
                <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-5 md:flex-row md:items-start md:justify-between md:px-6 md:py-6">
                    <div className="min-w-0">
                        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Чеклисты</h1>
                        <p className="mt-1 text-sm text-muted-foreground">Шаблоны проверок, приемки смен и аудита клуба</p>
                    </div>
                    <Button onClick={() => router.push(`/clubs/${clubId}/settings/checklists/new`)} className="hidden bg-black text-white hover:bg-black/90 md:inline-flex">
                        <Plus className="mr-2 h-4 w-4" /> Новый шаблон
                    </Button>
                </div>
            </div>

            <div className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8">

                <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {templates.map(template => (
                        <Card key={template.id} className="transition-colors hover:border-purple-500/50">
                            <CardHeader className="space-y-3 p-4 sm:p-6">
                                <div className="flex items-start justify-between">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
                                        <ClipboardCheck className="h-5 w-5" />
                                    </div>
                                    <Badge variant="outline" className="shrink-0 text-[10px] sm:text-xs">
                                        {template.type === 'shift_handover' ? 'Приемка смены' : 'Аудит'}
                                    </Badge>
                                </div>
                                <div className="space-y-1">
                                    <CardTitle className="line-clamp-2 text-base sm:text-lg">{template.name}</CardTitle>
                                    <CardDescription className="line-clamp-3 text-sm">{template.description || 'Нет описания'}</CardDescription>
                                </div>
                            </CardHeader>
                            <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
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
                                        className="h-10 w-10 shrink-0 text-red-500 hover:bg-red-50 hover:text-red-600" 
                                        onClick={() => handleDeleteTemplate(template.id)}
                                        title="Удалить чеклист"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                    <Button variant="outline" className="h-10 flex-1" onClick={() => router.push(`/clubs/${clubId}/settings/checklists/${template.id}`)}>
                                        Изменить
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}

                    {templates.length === 0 && (
                        <div className="col-span-full rounded-xl border-2 border-dashed bg-white p-8 text-center sm:p-12">
                            <ClipboardCheck className="mx-auto mb-4 h-12 w-12 text-muted-foreground opacity-20" />
                            <h3 className="text-lg font-medium">У вас еще нет чеклистов</h3>
                            <p className="mb-6 text-muted-foreground">Создайте свой первый шаблон</p>
                            <Button onClick={() => router.push(`/clubs/${clubId}/settings/checklists/new`)}>Начать</Button>
                        </div>
                    )}
                </div>
            </div>

            <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
                <div className="mx-auto flex max-w-5xl gap-2">
                    <Button asChild variant="outline" size="icon" className="h-11 w-11 shrink-0">
                        <Link href={`/clubs/${clubId}/settings`}>
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <Button onClick={() => router.push(`/clubs/${clubId}/settings/checklists/new`)} className="h-11 flex-1 bg-purple-600 hover:bg-purple-700">
                        <Plus className="mr-2 h-4 w-4" />
                        Новый шаблон
                    </Button>
                </div>
            </div>
        </div>
    )
}
