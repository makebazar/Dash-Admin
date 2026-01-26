"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, ArrowLeft, CheckCircle2, XCircle, AlertCircle, UserCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"

interface ChecklistItem {
    id: number
    content: string
    description: string
    weight: number
}

interface ChecklistTemplate {
    id: number
    name: string
    description: string
    items: ChecklistItem[]
}

interface Employee {
    id: number
    full_name: string
}

function EvaluationForm({ params }: { params: { clubId: string } }) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const templateId = searchParams.get('templateId')

    const [clubId, setClubId] = useState(params.clubId)
    const [template, setTemplate] = useState<ChecklistTemplate | null>(null)
    const [employees, setEmployees] = useState<Employee[]>([])
    const [selectedEmployee, setSelectedEmployee] = useState<string>('')
    const [responses, setResponses] = useState<Record<number, { score: number, comment: string }>>({})
    const [generalComment, setGeneralComment] = useState('')

    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        if (!templateId) {
            router.push(`/clubs/${clubId}/settings/checklists`)
            return
        }
        fetchData()
    }, [templateId])

    const fetchData = async () => {
        try {
            // Fetch template
            const tRes = await fetch(`/api/clubs/${clubId}/evaluations/templates`)
            const tData = await tRes.json()
            const foundTemplate = tData.find((t: ChecklistTemplate) => t.id === Number(templateId))
            if (foundTemplate) {
                setTemplate(foundTemplate)
                // Initialize responses
                const initial: Record<number, { score: number, comment: string }> = {}
                foundTemplate.items.forEach((item: ChecklistItem) => {
                    initial[item.id] = { score: 1, comment: '' } // Default to Yes (1)
                })
                setResponses(initial)
            }

            // Fetch employees
            const eRes = await fetch(`/api/clubs/${clubId}/employees`)
            const eData = await eRes.json()
            if (eRes.ok) setEmployees(eData)

        } catch (error) {
            console.error(error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleScoreChange = (itemId: number, score: number) => {
        setResponses(prev => ({
            ...prev,
            [itemId]: { ...prev[itemId], score }
        }))
    }

    const handleSubmit = async () => {
        if (!selectedEmployee) return alert('Выберите сотрудника')

        setIsSubmitting(true)
        try {
            const formattedResponses = Object.entries(responses).map(([itemId, data]) => ({
                item_id: Number(itemId),
                score: data.score,
                comment: data.comment
            }))

            const res = await fetch(`/api/clubs/${clubId}/evaluations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    template_id: Number(templateId),
                    employee_id: Number(selectedEmployee),
                    responses: formattedResponses,
                    comments: generalComment
                }),
            })

            if (res.ok) {
                const result = await res.json()
                alert(`Оценка сохранена! Результат: ${result.score.toFixed(1)}%`)
                router.push(`/clubs/${clubId}/settings/checklists`)
            } else {
                alert('Ошибка сохранения')
            }
        } catch (error) {
            console.error(error)
            alert('Ошибка сервера')
        } finally {
            setIsSubmitting(false)
        }
    }

    if (isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>
    if (!template) return <div className="p-8 text-center">Шаблон не найден</div>

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8 pb-32">
            <div className="mx-auto max-w-2xl">
                <div className="mb-6">
                    <Link href={`/clubs/${clubId}/settings/checklists`} className="mb-2 flex items-center text-sm text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="mr-1 h-4 w-4" /> Отмена
                    </Link>
                    <h1 className="text-2xl font-bold">{template.name}</h1>
                    <p className="text-muted-foreground text-sm">{template.description}</p>
                </div>

                <Card className="mb-6 border-none shadow-sm">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <UserCircle className="h-4 w-4 text-purple-600" />
                            Кто проходит проверку?
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Выберите сотрудника" />
                            </SelectTrigger>
                            <SelectContent>
                                {employees.map(emp => (
                                    <SelectItem key={emp.id} value={emp.id.toString()}>
                                        {emp.full_name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </CardContent>
                </Card>

                <div className="space-y-4">
                    {template.items.map((item, idx) => (
                        <Card key={item.id} className="border-none shadow-sm overflow-hidden">
                            <CardContent className="p-5">
                                <div className="mb-4">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Badge variant="outline" className="text-[10px] h-5">№{idx + 1}</Badge>
                                        <h3 className="font-semibold text-slate-800">{item.content}</h3>
                                    </div>
                                    {item.description && (
                                        <p className="text-xs text-muted-foreground ml-7">{item.description}</p>
                                    )}
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleScoreChange(item.id, 1)}
                                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all ${responses[item.id]?.score === 1
                                            ? 'bg-green-50 border-green-500 text-green-700 shadow-sm'
                                            : 'bg-white border-slate-100 text-slate-400 grayscale opacity-60'
                                            }`}
                                    >
                                        <CheckCircle2 className="h-5 w-5" />
                                        <span className="font-bold">ДА</span>
                                    </button>
                                    <button
                                        onClick={() => handleScoreChange(item.id, 0)}
                                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all ${responses[item.id]?.score === 0
                                            ? 'bg-red-50 border-red-500 text-red-700 shadow-sm'
                                            : 'bg-white border-slate-100 text-slate-400 grayscale opacity-60'
                                            }`}
                                    >
                                        <XCircle className="h-5 w-5" />
                                        <span className="font-bold">НЕТ</span>
                                    </button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <Card className="mt-8 border-none shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-purple-600" />
                            Общий комментарий
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Textarea
                            placeholder="Ваши замечания или похвала..."
                            value={generalComment}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setGeneralComment(e.target.value)}
                            className="bg-slate-50 border-none focus-visible:ring-purple-500"
                        />
                    </CardContent>
                </Card>

                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t md:static md:bg-transparent md:border-none md:p-0 md:mt-8">
                    <Button
                        onClick={handleSubmit}
                        disabled={isSubmitting || !selectedEmployee}
                        className="w-full bg-purple-600 hover:bg-purple-700 h-12 text-lg font-bold shadow-lg shadow-purple-200"
                    >
                        {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : 'Завершить проверку'}
                    </Button>
                </div>
            </div>
        </div>
    )
}

export default function NewEvaluationPage({ params }: { params: Promise<{ clubId: string }> }) {
    const [resolvedParams, setResolvedParams] = useState<{ clubId: string } | null>(null)

    useEffect(() => {
        params.then(setResolvedParams)
    }, [params])

    if (!resolvedParams) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>

    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>}>
            <EvaluationForm params={resolvedParams} />
        </Suspense>
    )
}
