"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, ArrowLeft, CheckCircle2, XCircle, AlertCircle, UserCircle, Camera, Upload, Trash2, ExternalLink, CalendarClock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"

interface ChecklistItem {
    id: number
    content: string
    description: string
    weight: number
    is_photo_required?: boolean
}

interface ChecklistTemplate {
    id: number
    name: string
    description: string
    items: ChecklistItem[]
}

interface Shift {
    id: string
    check_in: string
    check_out?: string
    status: string
    user_id: string
    employee_name: string
    role: string
}

function EvaluationForm({ params }: { params: { clubId: string } }) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const templateId = searchParams.get('templateId')

    const [clubId, setClubId] = useState(params.clubId)
    const [template, setTemplate] = useState<ChecklistTemplate | null>(null)
    const [employees, setEmployees] = useState<Employee[]>([])
    const [recentShifts, setRecentShifts] = useState<Shift[]>([])
    const [selectedShiftId, setSelectedShiftId] = useState<string>('none')
    const [selectedEmployee, setSelectedEmployee] = useState<string>('')
    const [responses, setResponses] = useState<Record<number, { score: number, comment: string, photo_url?: string }>>({})
    const [generalComment, setGeneralComment] = useState('')
    const [uploadingState, setUploadingState] = useState<Record<number, boolean>>({})

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

            if (tRes.ok && Array.isArray(tData)) {
                const foundTemplate = tData.find((t: ChecklistTemplate) => t.id === Number(templateId))
                if (foundTemplate) {
                    setTemplate(foundTemplate)
                    // Initialize responses
                    const initial: Record<number, { score: number, comment: string, photo_url?: string }> = {}
                    foundTemplate.items.forEach((item: ChecklistItem) => {
                        initial[item.id] = { score: 1, comment: '', photo_url: '' } // Default to Yes (1)
                    })
                    setResponses(initial)
                }
            }

            // Fetch employees
            const eRes = await fetch(`/api/clubs/${clubId}/employees`)
            const eData = await eRes.json()
            if (eRes.ok && eData.employees && Array.isArray(eData.employees)) {
                setEmployees(eData.employees)
            }

            // Fetch recent shifts
            const sRes = await fetch(`/api/clubs/${clubId}/shifts/recent`)
            const sData = await sRes.json()
            if (sRes.ok && sData.shifts && Array.isArray(sData.shifts)) {
                setRecentShifts(sData.shifts)
                
                // Smart default selection
                // If it's a "Handover" (implied logic: check for 'приемка' or similar in name, or just default behavior)
                // Let's assume we want to select the last closed shift if available, or current active one.
                
                // For now, let's select the first one (most recent) if available
                if (sData.shifts.length > 0) {
                    const mostRecent = sData.shifts[0]
                    setSelectedShiftId(mostRecent.id)
                    // Auto-select the employee of that shift
                    // We need to match user_id from shift to employee id in employees list.
                    // Note: shifts.user_id is UUID (users table), employees.id is SERIAL (employees table usually linked to user)
                    // Wait, in this project employees table is just a list? Let's check api/employees.
                    
                    // Actually, the employee selection logic relies on `employees` array which has `id` (number).
                    // But `shifts` returns `user_id` (uuid) and `employee_name`.
                    // We might need to map them. For now let's just pre-fill employee name if possible or let user choose.
                    
                    // If we can't map easily, we just filter the dropdown or show shift info.
                }
            }

        } catch (error) {
            console.error(error)
        } finally {
            setIsLoading(false)
        }
    }
    
    // Effect to auto-select employee when shift changes
    useEffect(() => {
        if (selectedShiftId && selectedShiftId !== 'none') {
            const shift = recentShifts.find(s => s.id === selectedShiftId)
            if (shift) {
                // Try to find employee by name match since we don't have direct ID link easily available on frontend without more data
                // Ideally we should link by user_id. 
                // Let's assume for now user manually selects or we try to match name.
                // UPD: The recent shifts API now returns user_id (UUID). The employees list returns id (integer) and user_id (UUID) is implicit.
                // We need to fetch employees with user_id to match correctly.
                
                // Since we don't have user_id in employees list (it's id, full_name, role...), we can only match by name for now.
                // OR we update employees API to return user_id.
                
                const foundEmp = employees.find(e => e.full_name === shift.employee_name)
                if (foundEmp) {
                    setSelectedEmployee(foundEmp.id.toString())
                } else {
                    // Fallback: Try to match by user_id if available in employee object (it might be added later)
                    // @ts-ignore
                    const foundEmpById = employees.find(e => e.user_id === shift.user_id)
                    if (foundEmpById) {
                        setSelectedEmployee(foundEmpById.id.toString())
                    }
                }
            }
        }
    }, [selectedShiftId, recentShifts, employees])

    const handleScoreChange = (itemId: number, score: number) => {
        setResponses(prev => ({
            ...prev,
            [itemId]: { ...prev[itemId], score }
        }))
    }

    const handlePhotoUpload = async (itemId: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploadingState(prev => ({ ...prev, [itemId]: true }))
        const formData = new FormData()
        formData.append('file', file)

        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            })
            
            if (!res.ok) throw new Error('Upload failed')
            
            const data = await res.json()
            setResponses(prev => ({
                ...prev,
                [itemId]: { ...prev[itemId], photo_url: data.url }
            }))
        } catch (error) {
            console.error('Failed to upload file:', error)
            alert('Не удалось загрузить фото')
        } finally {
            setUploadingState(prev => ({ ...prev, [itemId]: false }))
        }
    }

    const removePhoto = (itemId: number) => {
        setResponses(prev => ({
            ...prev,
            [itemId]: { ...prev[itemId], photo_url: '' }
        }))
    }

    const handleSubmit = async () => {
        if (!selectedEmployee) return alert('Выберите сотрудника')

        // Validate required photos
        const missingPhotos = template?.items.filter(item => 
            item.is_photo_required && !responses[item.id]?.photo_url
        )

        if (missingPhotos && missingPhotos.length > 0) {
            alert(`Необходимо прикрепить фото для следующих пунктов:\n${missingPhotos.map(i => `- ${i.content}`).join('\n')}`)
            return
        }

        setIsSubmitting(true)
        try {
            const formattedResponses = Object.entries(responses).map(([itemId, data]) => ({
                item_id: Number(itemId),
                score: data.score,
                comment: data.comment,
                photo_url: data.photo_url
            }))

            const res = await fetch(`/api/clubs/${clubId}/evaluations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    template_id: Number(templateId),
                    employee_id: Number(selectedEmployee),
                    responses: formattedResponses,
                    comments: generalComment,
                    shift_id: selectedShiftId !== 'none' ? selectedShiftId : null
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
                            <CalendarClock className="h-4 w-4 text-purple-600" />
                            Выберите смену (Опционально)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Select value={selectedShiftId} onValueChange={setSelectedShiftId}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Без привязки к смене" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Без привязки к смене</SelectItem>
                                {recentShifts.map(shift => (
                                    <SelectItem key={shift.id} value={shift.id}>
                                        <div className="flex flex-col text-left">
                                            <span className="font-medium">{shift.employee_name} ({shift.role})</span>
                                            <span className="text-xs text-muted-foreground">
                                                {new Date(shift.check_in).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} 
                                                {' - '}
                                                {shift.check_out 
                                                    ? new Date(shift.check_out).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit' }) 
                                                    : 'Активна'}
                                            </span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {selectedShiftId !== 'none' && (
                            <p className="text-xs text-muted-foreground mt-2">
                                * Сотрудник будет выбран автоматически на основе смены
                            </p>
                        )}
                    </CardContent>
                </Card>

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
                                    {/* Photo Upload Section */}
                                    {(item.is_photo_required || responses[item.id]?.photo_url) && (
                                        <div className="mt-4 pt-3 border-t">
                                            {responses[item.id]?.photo_url ? (
                                                <div className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg border">
                                                    <div className="h-10 w-10 bg-slate-200 rounded overflow-hidden relative">
                                                        <img 
                                                            src={responses[item.id].photo_url} 
                                                            alt="Attached" 
                                                            className="h-full w-full object-cover"
                                                        />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs text-muted-foreground truncate">Фото прикреплено</p>
                                                        <a 
                                                            href={responses[item.id].photo_url} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                                                        >
                                                            Открыть <ExternalLink className="h-3 w-3" />
                                                        </a>
                                                    </div>
                                                    <button 
                                                        onClick={() => removePhoto(item.id)}
                                                        className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full transition-colors"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <Label className="text-xs font-medium flex items-center gap-1 text-slate-600">
                                                            <Camera className="h-3 w-3" />
                                                            {item.is_photo_required ? 'Фото обязательно' : 'Прикрепить фото'}
                                                        </Label>
                                                    </div>
                                                    <label className={`
                                                        flex items-center justify-center gap-2 p-3 rounded-lg border-2 border-dashed cursor-pointer transition-colors
                                                        ${item.is_photo_required ? 'border-purple-200 bg-purple-50 hover:bg-purple-100' : 'border-slate-200 hover:bg-slate-50'}
                                                    `}>
                                                        {uploadingState[item.id] ? (
                                                            <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                                                        ) : (
                                                            <Upload className={`h-4 w-4 ${item.is_photo_required ? 'text-purple-600' : 'text-slate-400'}`} />
                                                        )}
                                                        <span className={`text-xs font-medium ${item.is_photo_required ? 'text-purple-700' : 'text-slate-500'}`}>
                                                            {uploadingState[item.id] ? 'Загрузка...' : 'Загрузить фото'}
                                                        </span>
                                                        <input 
                                                            type="file" 
                                                            accept="image/*" 
                                                            className="hidden" 
                                                            onChange={(e) => handlePhotoUpload(item.id, e)}
                                                            disabled={uploadingState[item.id]}
                                                        />
                                                    </label>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Optional photo upload button if not required and no photo yet */}
                                    {!item.is_photo_required && !responses[item.id]?.photo_url && (
                                        <div className="mt-2 text-center">
                                            <button 
                                                onClick={() => {
                                                    // Trigger hidden file input
                                                    document.getElementById(`optional-photo-${item.id}`)?.click()
                                                }}
                                                className="text-xs text-slate-400 hover:text-purple-600 flex items-center justify-center gap-1 mx-auto py-1"
                                            >
                                                <Camera className="h-3 w-3" />
                                                Добавить фото
                                            </button>
                                            <input 
                                                id={`optional-photo-${item.id}`}
                                                type="file" 
                                                accept="image/*" 
                                                className="hidden" 
                                                onChange={(e) => handlePhotoUpload(item.id, e)}
                                                disabled={uploadingState[item.id]}
                                            />
                                        </div>
                                    )}
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
