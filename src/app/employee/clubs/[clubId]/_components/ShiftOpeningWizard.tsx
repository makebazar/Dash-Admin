"use client"

import { useState, useEffect } from "react"
import { CheckCircle2, ArrowRight, Camera, Upload, Trash2, ExternalLink, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

interface ShiftOpeningWizardProps {
    isOpen: boolean
    onClose: () => void
    onComplete: (responses: Record<number, { score: number, comment: string, photo_url?: string }>) => void
    checklistTemplate: any
}

export function ShiftOpeningWizard({
    isOpen,
    onClose,
    onComplete,
    checklistTemplate
}: ShiftOpeningWizardProps) {
    const [checklistResponses, setChecklistResponses] = useState<Record<number, { score: number, comment: string, photo_url?: string }>>({})
    const [uploadingState, setUploadingState] = useState<Record<number, boolean>>({})

    useEffect(() => {
        if (checklistTemplate?.items) {
            const initial: Record<number, { score: number, comment: string, photo_url?: string }> = {}
            checklistTemplate.items.forEach((item: any) => {
                // No pre-selection of score
                // score is undefined initially
                // But types say score: number. Let's make it nullable or handle -1 as unset.
                // Better yet, update type or just use -1 as "not set"
                initial[item.id] = { score: -1, comment: '', photo_url: '' }
            })
            setChecklistResponses(initial)
        }
    }, [checklistTemplate])

    const handleChecklistChange = (itemId: number, score: number) => {
        setChecklistResponses(prev => ({
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
            setChecklistResponses(prev => ({
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
        setChecklistResponses(prev => ({
            ...prev,
            [itemId]: { ...prev[itemId], photo_url: '' }
        }))
    }

    const handleComplete = () => {
        // Validate
        const missing = checklistTemplate.items?.filter((item: any) => checklistResponses[item.id] === undefined)
        if (missing && missing.length > 0) {
            alert('Заполните все пункты чеклиста!')
            return
        }
        
        // Also check if score 0 has comment
        const missingComment = Object.entries(checklistResponses).find(([_, val]) => val.score === 0 && !val.comment)
        if (missingComment) {
            alert('При выборе "Нет" обязательно укажите комментарий!')
            return
        }

        // Validate required photos
        const missingPhotos = checklistTemplate.items?.filter((item: any) => 
            item.is_photo_required && !checklistResponses[item.id]?.photo_url
        )

        if (missingPhotos && missingPhotos.length > 0) {
            alert(`Необходимо прикрепить фото для следующих пунктов:\n${missingPhotos.map((i: any) => `- ${i.content}`).join('\n')}`)
            return
        }

        onComplete(checklistResponses)
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="w-full h-full max-w-none m-0 rounded-none sm:rounded-lg sm:max-w-2xl sm:h-auto sm:max-h-[90vh] bg-slate-950 border-slate-800 text-white overflow-hidden flex flex-col p-0 sm:p-6">
                <DialogHeader className="p-4 sm:p-0">
                    <DialogTitle>Приемка смены: {checklistTemplate.name}</DialogTitle>
                    <DialogDescription className="text-slate-400">
                        Проверьте состояние клуба после предыдущей смены
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {checklistTemplate.items?.map((item: any) => (
                        <div key={item.id} className="space-y-3 border-b border-slate-800 pb-4 last:border-0">
                            <div className="flex flex-col gap-1">
                                <div className="flex items-start justify-between gap-2">
                                    <span className="text-sm font-medium text-slate-200 mt-1">{item.content}</span>
                                    <div className="flex gap-1 bg-slate-900 p-1 rounded-md border border-slate-800 shrink-0">
                                        <Button 
                                            variant={checklistResponses[item.id]?.score === 1 ? 'default' : 'ghost'} 
                                            size="sm"
                                            className={`h-7 px-3 text-xs ${checklistResponses[item.id]?.score === 1 ? 'bg-green-600 hover:bg-green-700' : 'text-slate-400'}`}
                                            onClick={() => handleChecklistChange(item.id, 1)}
                                        >
                                            Да
                                        </Button>
                                        <Button 
                                            variant={checklistResponses[item.id]?.score === 0 ? 'default' : 'ghost'} 
                                            size="sm"
                                            className={`h-7 px-3 text-xs ${checklistResponses[item.id]?.score === 0 ? 'bg-red-600 hover:bg-red-700' : 'text-slate-400'}`}
                                            onClick={() => handleChecklistChange(item.id, 0)}
                                        >
                                            Нет
                                        </Button>
                                    </div>
                                </div>
                                {item.description && (
                                    <p className="text-xs text-slate-500">{item.description}</p>
                                )}
                            </div>
                            
                            {/* Photo Upload Section - Only show if required */}
                            {(item.is_photo_required || checklistResponses[item.id]?.photo_url) && (
                                <div className="mt-2">
                                    {checklistResponses[item.id]?.photo_url ? (
                                        <div className="flex items-center gap-3 p-2 bg-slate-900 rounded-lg border border-slate-800">
                                            <div className="h-10 w-10 bg-slate-800 rounded overflow-hidden relative">
                                                <img 
                                                    src={checklistResponses[item.id].photo_url} 
                                                    alt="Attached" 
                                                    className="h-full w-full object-cover"
                                                />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs text-slate-400 truncate">Фото прикреплено</p>
                                                <a 
                                                    href={checklistResponses[item.id].photo_url} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="text-xs text-blue-400 hover:underline flex items-center gap-1"
                                                >
                                                    Открыть <ExternalLink className="h-3 w-3" />
                                                </a>
                                            </div>
                                            <button 
                                                onClick={() => removePhoto(item.id)}
                                                className="p-2 hover:bg-red-900/20 text-slate-400 hover:text-red-500 rounded-full transition-colors"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <label className={`
                                            flex items-center justify-center gap-2 p-3 rounded-lg border border-dashed cursor-pointer transition-colors
                                            ${item.is_photo_required ? 'border-purple-500/50 bg-purple-500/10 hover:bg-purple-500/20' : 'border-slate-700 hover:bg-slate-800'}
                                        `}>
                                            {uploadingState[item.id] ? (
                                                <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
                                            ) : (
                                                <Upload className={`h-4 w-4 ${item.is_photo_required ? 'text-purple-400' : 'text-slate-400'}`} />
                                            )}
                                            <span className={`text-xs font-medium ${item.is_photo_required ? 'text-purple-300' : 'text-slate-400'}`}>
                                                {uploadingState[item.id] ? 'Загрузка...' : (item.is_photo_required ? 'Сделать обязательное фото' : 'Прикрепить фото')}
                                            </span>
                                            <input 
                                                type="file" 
                                                accept="image/*" 
                                                capture="environment"
                                                className="hidden" 
                                                onChange={(e) => handlePhotoUpload(item.id, e)}
                                                disabled={uploadingState[item.id]}
                                            />
                                        </label>
                                    )}
                                </div>
                            )}

                            {/* Optional photo trigger if not required and no photo yet - REMOVED per request */}
                            {/* {!item.is_photo_required && !checklistResponses[item.id]?.photo_url && (
                                <div className="flex justify-end">
                                    <button 
                                        onClick={() => document.getElementById(`shift-photo-${item.id}`)?.click()}
                                        className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1"
                                    >
                                        <Camera className="h-3 w-3" />
                                        Добавить фото
                                    </button>
                                    <input 
                                        id={`shift-photo-${item.id}`}
                                        type="file" 
                                        accept="image/*" 
                                        capture="environment"
                                        className="hidden" 
                                        onChange={(e) => handlePhotoUpload(item.id, e)}
                                        disabled={uploadingState[item.id]}
                                    />
                                </div>
                            )} */}

                            {checklistResponses[item.id]?.score === 0 && (
                                <Input 
                                    placeholder="Комментарий (обязательно)..."
                                    className="h-8 text-xs bg-slate-900 border-slate-700"
                                    value={checklistResponses[item.id]?.comment || ''}
                                    onChange={(e) => setChecklistResponses(prev => ({
                                        ...prev,
                                        [item.id]: { ...prev[item.id], comment: e.target.value }
                                    }))}
                                />
                            )}
                        </div>
                    ))}
                </div>

                <DialogFooter className="p-4 border-t border-slate-800 sm:p-6 sm:pt-4 mt-auto">
                    <Button onClick={handleComplete} className="w-full bg-blue-600 hover:bg-blue-700 h-12 sm:h-10 text-base sm:text-sm">
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Подтвердить и начать смену
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
