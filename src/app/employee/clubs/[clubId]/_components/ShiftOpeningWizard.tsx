"use client"

import { useState, useEffect } from "react"
import { CheckCircle2, ArrowRight, Camera, Upload, Trash2, ExternalLink, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useParams } from "next/navigation"

interface ShiftOpeningWizardProps {
    isOpen: boolean
    onClose: () => void
    onComplete: (responses: Record<number, { score: number, comment: string, photo_urls?: string[], selected_workstations?: string[] }>, targetShiftId?: string) => void
    checklistTemplate: any
}

export function ShiftOpeningWizard({
    isOpen,
    onClose,
    onComplete,
    checklistTemplate
}: ShiftOpeningWizardProps) {
    const params = useParams()
    const clubId = params.clubId as string
    
    const [checklistResponses, setChecklistResponses] = useState<Record<number, { score: number, comment: string, photo_urls: string[], selected_workstations?: string[] }>>({})
    const [uploadingState, setUploadingState] = useState<Record<number, boolean>>({})
    
    // Workstations state
    const [workstations, setWorkstations] = useState<any[]>([])
    const [isLoadingWorkstations, setIsLoadingWorkstations] = useState(false)

    // Wizard step state
    const [currentStep, setCurrentStep] = useState(-1) // Start at -1 for Shift Selection Step
    const totalSteps = checklistTemplate?.items?.length || 0

    // Shift Selection State
    const [shifts, setShifts] = useState<any[]>([])
    const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null)
    const [isLoadingShifts, setIsLoadingShifts] = useState(true)

    useEffect(() => {
        // Fetch recent shifts for selection
        const fetchShifts = async () => {
            try {
                const res = await fetch(`/api/clubs/${clubId}/shifts/recent`)
                if (res.ok) {
                    const data = await res.json()
                    setShifts(data.shifts || [])
                    
                    // Auto-select logic:
                    // 1. Priority: Active shift (if employee arrived early and wants to check current shift)
                    // 2. Fallback: Last CLOSED shift (handover from previous employee)
                    
                    const activeShift = data.shifts.find((s: any) => s.status === 'ACTIVE')
                    const lastClosedShift = data.shifts.find((s: any) => s.status === 'CLOSED')
                    
                    if (activeShift) {
                        setSelectedShiftId(activeShift.id)
                    } else if (lastClosedShift) {
                        setSelectedShiftId(lastClosedShift.id)
                    }
                }
            } catch (e) {
                console.error("Failed to fetch shifts", e)
            } finally {
                setIsLoadingShifts(false)
            }
        }
        
        fetchShifts()

        // Fetch workstations if any item needs them
        const needsWorkstations = checklistTemplate?.items?.some((item: any) => item.related_entity_type === 'workstations')
        if (needsWorkstations) {
            fetchWorkstations()
        }

        if (checklistTemplate?.items) {
            const initial: Record<number, { score: number, comment: string, photo_urls: string[], selected_workstations?: string[] }> = {}
            checklistTemplate.items.forEach((item: any) => {
                initial[item.id] = { score: -1, comment: '', photo_urls: [], selected_workstations: [] }
            })
            setChecklistResponses(initial)
        }
    }, [checklistTemplate, clubId])

    const fetchWorkstations = async () => {
        setIsLoadingWorkstations(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/workstations`)
            if (res.ok) {
                const data = await res.json()
                setWorkstations(data)
            }
        } catch (error) {
            console.error('Failed to fetch workstations', error)
        } finally {
            setIsLoadingWorkstations(false)
        }
    }

    const handleChecklistChange = (itemId: number, score: number) => {
        setChecklistResponses(prev => ({
            ...prev,
            [itemId]: { ...prev[itemId], score }
        }))
    }

    const toggleWorkstationSelection = (itemId: number, workstationName: string) => {
        setChecklistResponses(prev => {
            const currentSelected = prev[itemId]?.selected_workstations || []
            const isSelected = currentSelected.includes(workstationName)
            
            let newSelected
            if (isSelected) {
                newSelected = currentSelected.filter(name => name !== workstationName)
            } else {
                newSelected = [...currentSelected, workstationName]
            }
            
            // Auto-set score to 0 (No/Issues) if workstations are selected, or reset if cleared
            // If user manually set score, we might want to respect it, but generally:
            // Workstations selected -> There are issues -> Score 0
            // No workstations selected -> Maybe clean? -> Let user decide or keep current
            
            // Logic: If user selects workstations, they are reporting issues.
            const newScore = newSelected.length > 0 ? 0 : prev[itemId].score

            // Auto-generate comment
            const newComment = newSelected.length > 0 
                ? `Проблемы: ${newSelected.join(', ')}` 
                : (prev[itemId].score === 0 ? '' : prev[itemId].comment) // Clear comment if we reset score, else keep

            return {
                ...prev,
                [itemId]: { 
                    ...prev[itemId], 
                    selected_workstations: newSelected,
                    score: newScore,
                    comment: newComment
                }
            }
        })
    }

    const compressImage = async (file: File): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            const img = new Image()
            const reader = new FileReader()

            reader.onload = (e) => {
                img.src = e.target?.result as string
            }

            img.onload = () => {
                const canvas = document.createElement('canvas')
                const ctx = canvas.getContext('2d')
                
                // Max dimensions
                const MAX_WIDTH = 1200
                const MAX_HEIGHT = 1200
                
                let width = img.width
                let height = img.height

                // Calculate new dimensions
                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width
                        width = MAX_WIDTH
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height
                        height = MAX_HEIGHT
                    }
                }

                canvas.width = width
                canvas.height = height

                ctx?.drawImage(img, 0, 0, width, height)

                // Compress to JPEG with 0.7 quality
                canvas.toBlob((blob) => {
                    if (blob) {
                        resolve(blob)
                    } else {
                        reject(new Error('Canvas to Blob failed'))
                    }
                }, 'image/jpeg', 0.7)
            }

            reader.onerror = (err) => reject(err)
            reader.readAsDataURL(file)
        })
    }

    const handlePhotoUpload = async (itemId: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files || files.length === 0) return

        setUploadingState(prev => ({ ...prev, [itemId]: true }))
        
        try {
            // Process all selected files
            const uploadPromises = Array.from(files).map(async (file) => {
                // Compress image
                const compressedBlob = await compressImage(file)
                const compressedFile = new File([compressedBlob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                    type: 'image/jpeg'
                })

                const formData = new FormData()
                formData.append('file', compressedFile)

                const res = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                })
                
                if (!res.ok) throw new Error('Upload failed')
                const data = await res.json()
                return data.url
            })

            const urls = await Promise.all(uploadPromises)

            setChecklistResponses(prev => ({
                ...prev,
                [itemId]: { 
                    ...prev[itemId], 
                    photo_urls: [...(prev[itemId]?.photo_urls || []), ...urls]
                }
            }))

        } catch (error) {
            console.error('Failed to upload file:', error)
            alert('Не удалось загрузить фото')
        } finally {
            setUploadingState(prev => ({ ...prev, [itemId]: false }))
        }
    }

    const removePhoto = (itemId: number, urlToRemove: string) => {
        setChecklistResponses(prev => ({
            ...prev,
            [itemId]: { 
                ...prev[itemId], 
                photo_urls: prev[itemId].photo_urls.filter(url => url !== urlToRemove)
            }
        }))
    }

    const handleNext = () => {
        // Shift Selection Step Validation
        if (currentStep === -1) {
            if (!selectedShiftId) {
                alert('Пожалуйста, выберите смену для приемки')
                return
            }
            setCurrentStep(0)
            return
        }

        // Validate current step
        const currentItem = checklistTemplate.items[currentStep]
        const response = checklistResponses[currentItem.id]

        if (response?.score === -1) {
            alert('Пожалуйста, выберите "Да" или "Нет"')
            return
        }

        if (response?.score === 0 && !response.comment && !response.selected_workstations?.length) {
            alert('При выборе "Нет" обязательно укажите комментарий или выберите проблемные места!')
            return
        }

        if (currentItem.is_photo_required) {
            const uploadedCount = response.photo_urls?.length || 0
            const minRequired = currentItem.min_photos || 1 // Default to 1 if not specified
            
            if (uploadedCount < minRequired) {
                alert(`Для этого пункта необходимо загрузить минимум ${minRequired} фото (загружено: ${uploadedCount})`)
                return
            }
        }

        if (currentStep < totalSteps - 1) {
            setCurrentStep(prev => prev + 1)
        } else {
            handleComplete()
        }
    }

    const handleBack = () => {
        if (currentStep > -1) {
            setCurrentStep(prev => prev - 1)
        }
    }

    const handleComplete = () => {
        // Final validation (should be redundant if steps are validated)
        onComplete(checklistResponses, selectedShiftId || undefined)
    }

    const currentItem = checklistTemplate?.items?.[currentStep]
    const progress = ((currentStep + 1) / totalSteps) * 100

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="w-full h-full max-w-none m-0 rounded-none sm:rounded-lg sm:max-w-2xl sm:h-auto sm:max-h-[90vh] bg-slate-950 border-slate-800 text-white overflow-hidden flex flex-col p-0">
                
                {/* Header with Progress */}
                <div className="p-4 border-b border-slate-800 bg-slate-900/50">
                    <div className="flex items-center justify-between mb-2">
                        <DialogTitle className="text-lg">
                            {currentStep === -1 ? 'Выбор смены' : 'Приемка смены'}
                        </DialogTitle>
                        {currentStep >= 0 && (
                            <span className="text-xs text-slate-400 font-mono">
                                {currentStep + 1} / {totalSteps}
                            </span>
                        )}
                    </div>
                    {currentStep >= 0 && (
                        <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-purple-600 transition-all duration-300 ease-out"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    )}
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col justify-center min-h-[300px]">
                    {currentStep === -1 ? (
                        <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                            <div className="space-y-2">
                                <h2 className="text-xl sm:text-2xl font-bold leading-tight">Какую смену вы принимаете?</h2>
                                <p className="text-sm text-slate-400">Выберите смену, чтобы привязать к ней результаты проверки.</p>
                            </div>

                            {isLoadingShifts ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                                </div>
                            ) : (
                                <div className="grid gap-3">
                                    {shifts.map((shift) => (
                                        <button
                                            key={shift.id}
                                            onClick={() => setSelectedShiftId(shift.id)}
                                            className={`
                                                flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left
                                                ${selectedShiftId === shift.id
                                                    ? 'bg-purple-500/10 border-purple-500 shadow-lg shadow-purple-500/10'
                                                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'}
                                            `}
                                        >
                                            <div>
                                                <div className="font-bold text-white flex items-center gap-2">
                                                    {shift.employee_name}
                                                    {shift.status === 'ACTIVE' && (
                                                        <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-[10px] uppercase tracking-wider font-bold border border-green-500/20">
                                                            Активна
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-slate-400 mt-1">
                                                    {new Date(shift.check_in).toLocaleString('ru-RU', { 
                                                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' 
                                                    })}
                                                    {shift.check_out && ` — ${new Date(shift.check_out).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`}
                                                </div>
                                            </div>
                                            {selectedShiftId === shift.id && (
                                                <CheckCircle2 className="h-6 w-6 text-purple-500" />
                                            )}
                                        </button>
                                    ))}
                                    
                                    {shifts.length === 0 && (
                                        <div className="text-center py-8 text-slate-500 bg-slate-900/50 rounded-xl border border-slate-800 border-dashed">
                                            Смен за последнее время не найдено
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : currentItem && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 key={currentStep}">
                            <div className="space-y-2">
                                <h2 className="text-xl sm:text-2xl font-bold leading-tight">{currentItem.content}</h2>
                                {currentItem.description && (
                                    <p className="text-sm text-slate-400">{currentItem.description}</p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => handleChecklistChange(currentItem.id, 1)}
                                    className={`
                                        flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all
                                        ${checklistResponses[currentItem.id]?.score === 1
                                            ? 'bg-green-500/10 border-green-500 text-green-400'
                                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'}
                                    `}
                                >
                                    <CheckCircle2 className="h-8 w-8" />
                                    <span className="font-bold">Все отлично</span>
                                </button>

                                <button
                                    onClick={() => handleChecklistChange(currentItem.id, 0)}
                                    className={`
                                        flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all
                                        ${checklistResponses[currentItem.id]?.score === 0
                                            ? 'bg-red-500/10 border-red-500 text-red-400'
                                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'}
                                    `}
                                >
                                    <Trash2 className="h-8 w-8" /> {/* Using Trash icon as "Issues" metaphor or just XCircle */}
                                    <span className="font-bold">Есть проблемы</span>
                                </button>
                            </div>

                            {/* Workstation Selection Grid */}
                            {currentItem.related_entity_type === 'workstations' && (
                                <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                                    <p className="text-xs text-slate-400 mb-3 font-medium uppercase tracking-wider">Отметьте проблемные места:</p>
                                    
                                    {isLoadingWorkstations ? (
                                        <div className="flex justify-center py-4">
                                            <Loader2 className="h-6 w-6 animate-spin text-purple-500"/>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                                            {workstations.map(ws => (
                                                <button
                                                    key={ws.id}
                                                    onClick={() => toggleWorkstationSelection(currentItem.id, ws.name)}
                                                    className={`
                                                        py-2 px-1 text-[10px] sm:text-xs font-medium rounded-lg border transition-all truncate
                                                        ${checklistResponses[currentItem.id]?.selected_workstations?.includes(ws.name)
                                                            ? 'bg-red-500 border-red-500 text-white shadow-lg shadow-red-500/20'
                                                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}
                                                    `}
                                                >
                                                    {ws.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Photo Upload Section */}
                            {(currentItem.is_photo_required || (checklistResponses[currentItem.id]?.photo_urls && checklistResponses[currentItem.id]?.photo_urls.length > 0)) && (
                                <div className="space-y-3">
                                    {/* Gallery */}
                                    {checklistResponses[currentItem.id]?.photo_urls && checklistResponses[currentItem.id].photo_urls.length > 0 && (
                                        <div className="grid grid-cols-2 gap-2">
                                            {checklistResponses[currentItem.id].photo_urls.map((url, idx) => (
                                                <div key={idx} className="relative rounded-xl overflow-hidden border border-slate-700 aspect-video bg-slate-900 group">
                                                    <img 
                                                        src={url} 
                                                        alt={`Attached ${idx + 1}`} 
                                                        className="h-full w-full object-cover"
                                                    />
                                                    <button 
                                                        onClick={() => removePhoto(currentItem.id, url)}
                                                        className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-red-600 text-white rounded-full backdrop-blur-sm transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Upload Button */}
                                    <label className={`
                                        flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 border-dashed cursor-pointer transition-all
                                        ${currentItem.is_photo_required && (!checklistResponses[currentItem.id]?.photo_urls || checklistResponses[currentItem.id].photo_urls.length < (currentItem.min_photos || 1))
                                            ? 'border-purple-500/50 bg-purple-500/5 hover:bg-purple-500/10' 
                                            : 'border-slate-700 hover:bg-slate-800'}
                                    `}>
                                        {uploadingState[currentItem.id] ? (
                                            <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
                                        ) : (
                                            <Camera className={`h-8 w-8 ${currentItem.is_photo_required ? 'text-purple-400' : 'text-slate-400'}`} />
                                        )}
                                        <div className="text-center">
                                            <p className={`font-medium ${currentItem.is_photo_required ? 'text-purple-300' : 'text-slate-300'}`}>
                                                {uploadingState[currentItem.id] ? 'Загрузка...' : (currentItem.is_photo_required 
                                                    ? `Добавить фото (минимум ${currentItem.min_photos || 1})` 
                                                    : 'Добавить фото')}
                                            </p>
                                            <p className="text-xs text-slate-500 mt-1">Нажмите, чтобы открыть камеру</p>
                                        </div>
                                        <input 
                                            type="file" 
                                            accept="image/*" 
                                            multiple
                                            capture="environment"
                                            className="hidden" 
                                            onChange={(e) => handlePhotoUpload(currentItem.id, e)}
                                            disabled={uploadingState[currentItem.id]}
                                        />
                                    </label>
                                </div>
                            )}

                            {/* Comment Input */}
                            {(checklistResponses[currentItem.id]?.score === 0 || checklistResponses[currentItem.id]?.comment) && (
                                <div className="animate-in fade-in slide-in-from-bottom-2">
                                    <Label className="text-xs text-slate-400 mb-2 block">Комментарий</Label>
                                    <Input 
                                        placeholder={checklistResponses[currentItem.id]?.score === 0 ? "Опишите проблему..." : "Комментарий (опционально)..."}
                                        className="bg-slate-900 border-slate-700 focus-visible:ring-purple-500"
                                        value={checklistResponses[currentItem.id]?.comment || ''}
                                        onChange={(e) => setChecklistResponses(prev => ({
                                            ...prev,
                                            [currentItem.id]: { ...prev[currentItem.id], comment: e.target.value }
                                        }))}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Navigation */}
                <DialogFooter className="p-4 border-t border-slate-800 bg-slate-900/50 mt-auto">
                    <div className="flex gap-3 w-full">
                        <Button 
                            variant="outline" 
                            onClick={handleBack}
                            disabled={currentStep === 0}
                            className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                        >
                            Назад
                        </Button>
                        <Button 
                            onClick={handleNext} 
                            className="flex-[2] bg-purple-600 hover:bg-purple-700 text-white font-bold"
                        >
                            {currentStep === totalSteps - 1 ? 'Завершить' : 'Далее'}
                            {currentStep < totalSteps - 1 && <ArrowRight className="ml-2 h-4 w-4" />}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
