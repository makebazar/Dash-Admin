"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, AlertTriangle, CheckCircle2, ChevronRight, ChevronLeft, Image as ImageIcon, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface MaintenanceTask {
    id: string
    equipment_id: string
    equipment_name: string
    equipment_type: string
    equipment_type_name: string
    workstation_name?: string
    workstation_zone?: string
    status: string
}

interface MaintenanceSessionWizardProps {
    isOpen: boolean
    onClose: () => void
    tasks: MaintenanceTask[]
    onComplete: () => void
}

export function MaintenanceSessionWizard({ isOpen, onClose, tasks, onComplete }: MaintenanceSessionWizardProps) {
    const { clubId } = useParams()
    const [currentIndex, setCurrentIndex] = useState(0)
    const [instructions, setInstructions] = useState<Record<string, string>>({})
    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    
    // Issue reporting state
    const [hasIssue, setHasIssue] = useState(false)
    const [issueTitle, setIssueTitle] = useState("")
    const [issueDescription, setIssueDescription] = useState("")
    
    // Photo upload state
    const [photos, setPhotos] = useState<File[]>([])
    const [isUploading, setIsUploading] = useState(false)

    const currentTask = tasks[currentIndex]
    const isLastTask = currentIndex === tasks.length - 1
    const progress = ((currentIndex + 1) / tasks.length) * 100

    useEffect(() => {
        if (isOpen && tasks.length > 0) {
            fetchInstructions()
            setCurrentIndex(0)
            resetIssueForm()
        }
    }, [isOpen, tasks])

    const fetchInstructions = async () => {
        setIsLoading(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/equipment-instructions`)
            const data = await res.json()
            const map: Record<string, string> = {}
            if (Array.isArray(data)) {
                data.forEach((i: any) => {
                    map[i.equipment_type_code] = i.instructions
                })
            }
            setInstructions(map)
        } catch (error) {
            console.error("Error fetching instructions:", error)
        } finally {
            setIsLoading(false)
        }
    }

    const resetIssueForm = () => {
        setHasIssue(false)
        setIssueTitle("")
        setIssueDescription("")
        setPhotos([])
    }

    const handleCompleteTask = async () => {
        if (!currentTask) return
        
        setIsSubmitting(true)
        setIsUploading(true)
        try {
            // 0. Upload photos if any
            const photoUrls: string[] = []
            if (photos.length > 0) {
                for (const file of photos) {
                    const formData = new FormData()
                    formData.append('file', file)
                    
                    try {
                        const res = await fetch('/api/upload', {
                            method: 'POST',
                            body: formData
                        })
                        if (res.ok) {
                            const data = await res.json()
                            if (data.url) photoUrls.push(data.url)
                        }
                    } catch (e) {
                        console.error("Failed to upload photo", e)
                    }
                }
            }
            setIsUploading(false)

            // 1. Complete the task
            await fetch(`/api/clubs/${clubId}/equipment/maintenance/${currentTask.id}/complete`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ photos: photoUrls })
            })

            // 2. Report issue if any
            if (hasIssue && issueTitle) {
                await fetch(`/api/clubs/${clubId}/equipment/${currentTask.equipment_id}/issues`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        title: issueTitle,
                        description: issueDescription,
                        severity: "MEDIUM", // Default
                        maintenance_task_id: currentTask.id
                    })
                })
            }

            // Move to next or finish
            if (isLastTask) {
                onComplete()
                onClose()
            } else {
                setCurrentIndex(prev => prev + 1)
                resetIssueForm()
            }
        } catch (error) {
            console.error("Error completing task:", error)
            alert("Ошибка при завершении задачи. Попробуйте снова.")
        } finally {
            setIsSubmitting(false)
        }
    }

    if (!isOpen || !currentTask) return null

    const instructionContent = instructions[currentTask.equipment_type] || "Инструкция отсутствует."

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="p-0 gap-0 overflow-hidden flex flex-col w-full h-full max-h-none sm:h-[90vh] sm:max-h-[850px] sm:max-w-[900px] sm:rounded-3xl border-none shadow-2xl">
                {/* Header */}
                <div className="relative bg-white border-b pt-4 sm:pt-6 px-4 sm:px-8 pb-6">
                    <div className="flex items-center justify-between mb-0">
                        <div className="flex items-center gap-3 sm:gap-4">
                            <div>
                                <DialogTitle className="text-lg sm:text-xl font-bold text-slate-900 leading-tight">
                                    {currentTask.equipment_name}
                                </DialogTitle>
                                <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-none text-[10px] font-bold uppercase tracking-wider">
                                        {currentTask.equipment_type_name}
                                    </Badge>
                                    {currentTask.workstation_name && (
                                        <span className="text-xs text-slate-400 flex items-center gap-1">
                                            <span className="h-1 w-1 rounded-full bg-slate-300" />
                                            {currentTask.workstation_name} ({currentTask.workstation_zone})
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="hidden sm:flex flex-col items-end gap-1 opacity-0">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Прогресс</span>
                            <span className="text-sm font-black text-indigo-600">{Math.round(progress)}%</span>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col md:flex-row bg-slate-50/50">
                    {/* Instructions Panel */}
                    <div className="flex-1 p-4 sm:p-8 overflow-y-auto bg-white sm:rounded-br-3xl">
                        <div className="max-w-2xl">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-indigo-500" />
                                Порядок действий
                            </h3>
                            
                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-4">
                                    <Loader2 className="h-10 w-10 animate-spin text-indigo-200" />
                                    <p className="text-sm text-slate-400 font-medium">Загрузка инструкции...</p>
                                </div>
                            ) : (
                                <div className="text-slate-700 leading-relaxed space-y-4">
                                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 text-sm whitespace-pre-wrap font-medium">
                                        {instructionContent}
                                    </div>
                                    
                                    <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-100/50 flex gap-3 items-start mt-8">
                                        <div className="h-5 w-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                                            <span className="text-[10px] font-bold">i</span>
                                        </div>
                                        <p className="text-xs text-indigo-700 leading-normal">
                                            Убедитесь, что оборудование выключено перед началом физической чистки. Сообщайте о любых видимых повреждениях.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Action Panel */}
                    <div className="w-full md:w-[320px] p-4 sm:p-6 flex flex-col gap-4 overflow-y-auto border-t md:border-t-0 md:border-l border-slate-200">
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Статус проверки</h3>
                                <div className="grid grid-cols-2 gap-2">
                                    <div 
                                        className={cn(
                                            "p-3 rounded-xl border-2 transition-all cursor-pointer flex flex-col items-center justify-center gap-2 text-center",
                                            !hasIssue 
                                                ? "bg-green-50 border-green-200 text-green-700" 
                                                : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"
                                        )}
                                        onClick={() => setHasIssue(false)}
                                    >
                                        <div className={cn("h-8 w-8 rounded-full flex items-center justify-center transition-colors", !hasIssue ? "bg-green-500 text-white" : "bg-slate-100")}>
                                            <CheckCircle2 className="h-5 w-5" />
                                        </div>
                                        <span className="font-bold text-xs leading-none">В порядке</span>
                                    </div>

                                    <div 
                                        className={cn(
                                            "p-3 rounded-xl border-2 transition-all cursor-pointer flex flex-col items-center justify-center gap-2 text-center",
                                            hasIssue 
                                                ? "bg-amber-50 border-amber-200 text-amber-700" 
                                                : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"
                                        )}
                                        onClick={() => setHasIssue(true)}
                                    >
                                        <div className={cn("h-8 w-8 rounded-full flex items-center justify-center transition-colors", hasIssue ? "bg-amber-500 text-white" : "bg-slate-100")}>
                                            <AlertTriangle className="h-5 w-5" />
                                        </div>
                                        <span className="font-bold text-xs leading-none">Проблема</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4 pt-4 border-t border-slate-100">
                                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                                    Фотоотчет
                                    <span className="text-rose-500 normal-case tracking-normal font-bold bg-rose-50 px-2 py-0.5 rounded-md">Обязательно</span>
                                </Label>
                                <div className="flex flex-wrap gap-2">
                                    {photos.map((file, idx) => (
                                        <div key={idx} className="relative h-20 w-20 rounded-xl border-2 border-slate-100 overflow-hidden group shadow-sm">
                                            <img src={URL.createObjectURL(file)} alt="preview" className="h-full w-full object-cover" />
                                            <button 
                                                onClick={() => setPhotos(prev => prev.filter((_, i) => i !== idx))}
                                                className="absolute top-0 right-0 bg-black/50 text-white p-1 opacity-0 group-hover:opacity-100 transition-opacity rounded-bl-xl backdrop-blur-sm"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ))}
                                    <label className="h-20 w-20 border-2 border-dashed border-indigo-200 bg-indigo-50/50 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-100 transition-all group">
                                        <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center mb-1 group-hover:bg-indigo-200 transition-colors">
                                            <ImageIcon className="h-4 w-4 text-indigo-500" />
                                        </div>
                                        <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Фото</span>
                                        <input 
                                            type="file" 
                                            className="hidden" 
                                            accept="image/*" 
                                            capture="environment"
                                            multiple 
                                            onChange={(e) => {
                                                if (e.target.files) {
                                                    setPhotos(prev => [...prev, ...Array.from(e.target.files!)])
                                                }
                                            }} 
                                        />
                                    </label>
                                </div>
                            </div>

                            {hasIssue && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Что случилось?</Label>
                                        <Input 
                                            placeholder="Напр: Залипает кнопка" 
                                            value={issueTitle}
                                            onChange={(e) => setIssueTitle(e.target.value)}
                                            className="rounded-xl border-slate-200 focus:ring-indigo-500/20"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Подробности</Label>
                                        <Textarea 
                                            placeholder="Опишите подробнее..." 
                                            className="resize-none h-24 rounded-xl border-slate-200 focus:ring-indigo-500/20" 
                                            value={issueDescription}
                                            onChange={(e) => setIssueDescription(e.target.value)}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-4 sm:p-6 bg-white border-t flex flex-col sm:flex-row gap-4 items-center justify-between">
                    <div className="flex items-center gap-3 text-slate-400 order-2 sm:order-1 opacity-0 pointer-events-none">
                        <span className="text-xs font-bold tracking-tight">
                            {isLastTask ? "Финальный этап" : `Осталось: ${tasks.length - currentIndex - 1}`}
                        </span>
                    </div>
                    
                    <div className="flex gap-3 w-full sm:w-auto order-1 sm:order-2">
                        <Button 
                            onClick={handleCompleteTask} 
                            disabled={isSubmitting || isUploading || (hasIssue && !issueTitle) || (photos.length === 0)}
                            className="w-full sm:w-auto h-12 px-8 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg shadow-indigo-200 transition-all hover:translate-y-[-2px] active:translate-y-0 disabled:opacity-50"
                        >
                            {isSubmitting || isUploading ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <>
                                    Завершить
                                    <CheckCircle2 className="ml-2 h-5 w-5" />
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

function ClipboardListIcon(props: any) {
    return (
      <svg
        {...props}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        <path d="M12 11h4" />
        <path d="M12 16h4" />
        <path d="M8 11h.01" />
        <path d="M8 16h.01" />
      </svg>
    )
}
