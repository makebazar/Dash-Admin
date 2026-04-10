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
        <div className="min-h-screen bg-slate-50/30 pb-24 md:pb-8">
            <div className="border-b bg-white">
                <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-5 md:flex-row md:items-start md:justify-between md:px-6 md:py-6">
                    <div className="min-w-0">
                        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Чеклисты</h1>
                        <p className="mt-1 text-sm text-muted-foreground">Шаблоны проверок, приемки смен и аудита клуба</p>
                    </div>
                    <Button onClick={() => router.push(`/clubs/${clubId}/settings/checklists/new`)} className="hidden bg-slate-900 h-11 rounded-xl px-6 text-white hover:bg-slate-800 md:inline-flex font-medium">
                        <Plus className="mr-2 h-4 w-4" /> Новый шаблон
                    </Button>
                </div>
            </div>

            <div className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8">

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {templates.map(template => (
                        <div key={template.id} className="group relative flex flex-col justify-between rounded-3xl border border-slate-100 bg-white p-6 shadow-sm transition-all hover:border-slate-200 hover:shadow-md">
                            <div className="space-y-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 group-hover:scale-105 transition-transform duration-300">
                                        <ClipboardCheck className="h-6 w-6" />
                                    </div>
                                    <Badge variant="outline" className="shrink-0 bg-slate-50 border-slate-200 text-xs font-medium text-slate-600 rounded-lg px-2.5 py-0.5">
                                        {template.type === 'shift_handover' ? 'Приемка смены' : 'Аудит'}
                                    </Badge>
                                </div>
                                <div>
                                    <h3 className="line-clamp-2 text-lg font-semibold text-slate-900 group-hover:text-slate-700 transition-colors">{template.name}</h3>
                                    <p className="mt-1.5 line-clamp-2 text-sm text-slate-500 leading-relaxed">{template.description || 'Нет описания'}</p>
                                </div>
                            </div>
                            
                            <div className="mt-6 pt-6 border-t border-slate-100">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-[10px] font-bold">
                                            {template.items?.length || 0}
                                        </div>
                                        <span className="text-sm font-medium text-slate-600">пунктов</span>
                                    </div>
                                    <span className="text-xs font-medium text-slate-400">
                                        {new Date(template.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                                <div className="flex gap-2">
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-11 w-11 shrink-0 rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors" 
                                        onClick={() => handleDeleteTemplate(template.id)}
                                        title="Удалить чеклист"
                                    >
                                        <Trash2 className="h-5 w-5" />
                                    </Button>
                                    <Button variant="secondary" className="h-11 flex-1 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium" onClick={() => router.push(`/clubs/${clubId}/settings/checklists/${template.id}`)}>
                                        Изменить
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ))}

                    {templates.length === 0 && (
                        <div className="col-span-full flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50/50 py-20 text-center">
                            <div className="h-16 w-16 rounded-2xl bg-white border border-slate-100 flex items-center justify-center mb-4 shadow-sm">
                                <ClipboardCheck className="h-8 w-8 text-slate-300" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900">У вас еще нет чеклистов</h3>
                            <p className="mt-2 text-sm text-slate-500 mb-6 max-w-sm leading-relaxed">Создайте свой первый шаблон для стандартизации работы клуба</p>
                            <Button onClick={() => router.push(`/clubs/${clubId}/settings/checklists/new`)} className="h-11 rounded-xl bg-slate-900 px-8 text-white hover:bg-slate-800 font-medium">Начать</Button>
                        </div>
                    )}
                </div>
            </div>

            <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-white/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-white/80 md:hidden">
                <div className="mx-auto flex max-w-5xl gap-2">
                    <Button asChild variant="outline" size="icon" className="h-12 w-12 shrink-0 rounded-xl border-slate-200">
                        <Link href={`/clubs/${clubId}/settings`}>
                            <ArrowLeft className="h-5 w-5 text-slate-600" />
                        </Link>
                    </Button>
                    <Button onClick={() => router.push(`/clubs/${clubId}/settings/checklists/new`)} className="h-12 flex-1 rounded-xl bg-slate-900 text-white hover:bg-slate-800 font-medium">
                        <Plus className="mr-2 h-4 w-4" />
                        Новый шаблон
                    </Button>
                </div>
            </div>
        </div>
    )
}
