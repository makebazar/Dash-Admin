"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, AlertTriangle, CheckCircle2, Image as ImageIcon, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn, isLaundryEquipmentType, optimizeFileBeforeUpload } from "@/lib/utils"

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

type TaskReportMode = "OK" | "ISSUE" | "LAUNDRY"

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
    const [reportMode, setReportMode] = useState<TaskReportMode>("OK")
    const [issueTitle, setIssueTitle] = useState("")
    const [issueDescription, setIssueDescription] = useState("")
    const [generalNotes, setGeneralNotes] = useState("")
    
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
        setReportMode("OK")
        setIssueTitle("")
        setIssueDescription("")
        setGeneralNotes("")
        setPhotos([])
    }

    const handleCompleteTask = async () => {
        if (!currentTask) return
        
        setIsSubmitting(true)
        setIsUploading(true)
        try {
            const photoUrls: string[] = []
            if (photos.length > 0) {
                for (const file of photos) {
                    const optimizedFile = await optimizeFileBeforeUpload(file)
                    const formData = new FormData()
                    formData.append('file', optimizedFile)
                    
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

            const isIssueReport = reportMode === "ISSUE"
            const isLaundryReport = reportMode === "LAUNDRY"
            const hasReport = isIssueReport || isLaundryReport
            const reportPrefix = isLaundryReport ? "[СТИРКА]" : isIssueReport ? "[ИНЦИДЕНТ]" : null

            const completeRes = await fetch(`/api/clubs/${clubId}/equipment/maintenance/${currentTask.id}/complete`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    photos: photoUrls,
                    notes: hasReport && issueTitle
                        ? `${reportPrefix} ${issueTitle}: ${issueDescription}`
                        : generalNotes
                })
            })

            if (!completeRes.ok) {
                throw new Error("Failed to complete task")
            }

            if (hasReport && issueTitle) {
                if (isLaundryReport) {
                    const laundryRes = await fetch(`/api/clubs/${clubId}/laundry`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            equipment_id: currentTask.equipment_id,
                            maintenance_task_id: currentTask.id,
                            title: issueTitle,
                            description: issueDescription,
                            photos: photoUrls,
                            source: "EMPLOYEE_SERVICE"
                        })
                    })

                    if (!laundryRes.ok) {
                        throw new Error("Failed to create laundry request")
                    }
                } else {
                    const issueRes = await fetch(`/api/clubs/${clubId}/equipment/${currentTask.equipment_id}/issues`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            title: issueTitle,
                            description: issueDescription,
                            severity: "MEDIUM",
                            maintenance_task_id: currentTask.id
                        })
                    })

                    if (!issueRes.ok) {
                        throw new Error("Failed to create equipment issue")
                    }
                }
            }

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

    const instructionContent = instructions[currentTask.equipment_type] || ""
    const hasInstruction = instructionContent.trim().length > 0
    const isLaundryEquipment = isLaundryEquipmentType(currentTask.equipment_type)
    const hasReport = reportMode === "ISSUE" || reportMode === "LAUNDRY"
    const isLaundryReport = reportMode === "LAUNDRY"

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="p-0 gap-0 overflow-hidden flex flex-col w-full h-full max-h-none sm:h-[90vh] sm:max-h-[850px] sm:max-w-[900px] sm:rounded-xl border border-border shadow-md bg-background dark text-foreground">
                {/* Header */}
                <div className="relative bg-card border-b border-border pt-4 sm:pt-6 px-4 sm:px-8 pb-6">
                    <div className="flex items-center justify-between mb-0">
                        <div className="flex items-center gap-3 sm:gap-4">
                            <div>
                                <DialogTitle className="text-lg sm:text-xl font-bold text-foreground leading-tight">
                                    {currentTask.equipment_name}
                                </DialogTitle>
                                <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="secondary" className="bg-accent text-muted-foreground border-none text-[10px] font-bold uppercase tracking-wider">
                                        {currentTask.equipment_type_name}
                                    </Badge>
                                    {currentTask.workstation_name && (
                                        <span className="text-xs text-muted-foreground/70 flex items-center gap-1">
                                            <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                                            {currentTask.workstation_name} ({currentTask.workstation_zone})
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="hidden sm:flex flex-col items-end gap-1 opacity-0">
                            <span className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest">Прогресс</span>
                            <span className="text-sm font-black text-primary">{Math.round(progress)}%</span>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col md:flex-row bg-background">
                    {/* Instructions Panel */}
                    <div className="flex-1 p-4 sm:p-8 overflow-y-auto bg-card">
                        <div className="max-w-2xl">
                            <h3 className="text-sm font-bold text-muted-foreground/70 uppercase tracking-widest mb-6 flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-primary" />
                                Порядок действий
                            </h3>
                            
                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-4">
                                    <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                                    <p className="text-sm text-muted-foreground/70 font-medium">Загрузка инструкции...</p>
                                </div>
                            ) : (
                                <div className="text-foreground leading-relaxed space-y-4">
                                    {hasInstruction ? (
                                        <div
                                            className="equipment-instruction-content p-6 bg-accent/30 rounded-xl border border-border text-sm"
                                            dangerouslySetInnerHTML={{ __html: instructionContent }}
                                        />
                                    ) : (
                                        <div className="p-6 bg-accent/30 rounded-xl border border-dashed border-border text-sm text-muted-foreground font-medium">
                                            Инструкция отсутствует.
                                        </div>
                                    )}
                                    
                                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex gap-3 items-start mt-8">
                                        <div className="h-5 w-5 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0 mt-0.5">
                                            <span className="text-[10px] font-bold">i</span>
                                        </div>
                                        <p className="text-xs text-primary leading-normal">
                                            Убедитесь, что оборудование выключено перед началом физической чистки. Сообщайте о любых видимых повреждениях.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Action Panel */}
                    <div className="w-full md:w-[320px] p-4 sm:p-6 flex flex-col gap-4 overflow-y-auto border-t md:border-t-0 md:border-l border-border bg-card">
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest mb-2">Статус проверки</h3>
                                <div className={cn("grid gap-2", isLaundryEquipment ? "grid-cols-3" : "grid-cols-2")}>
                                    <div 
                                        className={cn(
                                            "p-3 rounded-xl border transition-all cursor-pointer flex flex-col items-center justify-center gap-2 text-center",
                                            reportMode === "OK"
                                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500" 
                                                : "bg-accent/30 border-border text-muted-foreground hover:bg-accent/50"
                                        )}
                                        onClick={() => setReportMode("OK")}
                                    >
                                        <div className={cn("h-8 w-8 rounded-full flex items-center justify-center transition-colors", reportMode === "OK" ? "bg-emerald-500 text-primary-foreground" : "bg-background border border-border")}>
                                            <CheckCircle2 className="h-5 w-5" />
                                        </div>
                                        <span className="font-bold text-xs leading-none">В порядке</span>
                                    </div>

                                    <div 
                                        className={cn(
                                            "p-3 rounded-xl border transition-all cursor-pointer flex flex-col items-center justify-center gap-2 text-center",
                                            reportMode === "ISSUE"
                                                ? "bg-amber-500/10 border-amber-500/30 text-amber-500" 
                                                : "bg-accent/30 border-border text-muted-foreground hover:bg-accent/50"
                                        )}
                                        onClick={() => setReportMode("ISSUE")}
                                    >
                                        <div className={cn("h-8 w-8 rounded-full flex items-center justify-center transition-colors", reportMode === "ISSUE" ? "bg-amber-500 text-primary-foreground" : "bg-background border border-border")}>
                                            <AlertTriangle className="h-5 w-5" />
                                        </div>
                                        <span className="font-bold text-xs leading-none">Проблема</span>
                                    </div>

                                    {isLaundryEquipment && (
                                        <div
                                            className={cn(
                                                "p-3 rounded-xl border transition-all cursor-pointer flex flex-col items-center justify-center gap-2 text-center",
                                                reportMode === "LAUNDRY"
                                                    ? "bg-blue-500/10 border-blue-500/30 text-blue-500"
                                                    : "bg-accent/30 border-border text-muted-foreground hover:bg-accent/50"
                                            )}
                                            onClick={() => setReportMode("LAUNDRY")}
                                        >
                                            <div className={cn("h-8 w-8 rounded-full flex items-center justify-center transition-colors", reportMode === "LAUNDRY" ? "bg-blue-500 text-primary-foreground" : "bg-background border border-border")}>
                                                <ImageIcon className="h-5 w-5" />
                                            </div>
                                            <span className="font-bold text-xs leading-none">В стирку</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4 pt-4 border-t border-border/50">
                                <Label className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest flex items-center justify-between">
                                    Фотоотчет
                                    <span className="text-rose-500 normal-case tracking-normal font-bold bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">Обязательно</span>
                                </Label>
                                <div className="flex flex-wrap gap-2">
                                    {photos.map((file, idx) => (
                                        <div key={idx} className="relative h-20 w-20 rounded-xl border border-border overflow-hidden group shadow-sm bg-accent/30">
                                            <img src={URL.createObjectURL(file)} alt="preview" className="h-full w-full object-cover" />
                                            <button 
                                                onClick={() => setPhotos(prev => prev.filter((_, i) => i !== idx))}
                                                className="absolute top-0 right-0 bg-background/80 text-foreground p-1 opacity-0 group-hover:opacity-100 transition-opacity rounded-bl-xl backdrop-blur-sm hover:bg-background hover:text-rose-500"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ))}
                                    <label className="h-20 w-20 border border-dashed border-border bg-accent/30 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-accent/50 transition-all group">
                                        <div className="h-8 w-8 rounded-full bg-background border border-border flex items-center justify-center mb-1 group-hover:border-primary/30 transition-colors">
                                            <ImageIcon className="h-4 w-4 text-primary" />
                                        </div>
                                        <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Фото</span>
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

                            {hasReport ? (
                                <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest ml-1">
                                            {isLaundryReport ? "Что отправить в стирку?" : "Что случилось?"}
                                        </Label>
                                        <Input 
                                            placeholder={isLaundryReport ? "Напр: Коврик сильно загрязнен" : "Напр: Залипает кнопка"} 
                                            value={issueTitle}
                                            onChange={(e) => setIssueTitle(e.target.value)}
                                            className="rounded-xl border-border bg-background focus-visible:ring-primary/20"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest ml-1">Подробности</Label>
                                        <Textarea 
                                            placeholder={isLaundryReport ? "Опишите состояние и причину отправки в стирку..." : "Опишите подробнее..."} 
                                            className="resize-none h-24 rounded-xl border-border bg-background focus-visible:ring-primary/20" 
                                            value={issueDescription}
                                            onChange={(e) => setIssueDescription(e.target.value)}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest ml-1">Примечание (необязательно)</Label>
                                        <Textarea 
                                            placeholder="Напр: Есть небольшая потертость, в целом всё ок" 
                                            className="resize-none h-24 rounded-xl border-border bg-background focus-visible:ring-primary/20" 
                                            value={generalNotes}
                                            onChange={(e) => setGeneralNotes(e.target.value)}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-4 sm:p-6 bg-card border-t border-border flex flex-col sm:flex-row gap-4 items-center justify-between">
                    <div className="flex items-center gap-3 text-muted-foreground/70 order-2 sm:order-1 opacity-0 pointer-events-none">
                        <span className="text-xs font-bold tracking-tight">
                            {isLastTask ? "Финальный этап" : `Осталось: ${tasks.length - currentIndex - 1}`}
                        </span>
                    </div>
                    
                    <div className="flex gap-3 w-full sm:w-auto order-1 sm:order-2">
                        <Button 
                            onClick={handleCompleteTask} 
                            disabled={isSubmitting || isUploading || (hasReport && !issueTitle) || (photos.length === 0)}
                            className="w-full sm:w-auto h-12 px-8 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold transition-all disabled:opacity-50"
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
                <style jsx global>{`
                    .equipment-instruction-content h1 { font-size: 1.75rem; font-weight: 700; margin-bottom: 1rem; line-height: 1.2; color: hsl(var(--foreground)); }
                    .equipment-instruction-content h2 { font-size: 1.375rem; font-weight: 700; margin-top: 1.75rem; margin-bottom: 0.75rem; line-height: 1.3; color: hsl(var(--foreground)); }
                    .equipment-instruction-content h3 { font-size: 1.125rem; font-weight: 600; margin-top: 1.25rem; margin-bottom: 0.5rem; line-height: 1.35; color: hsl(var(--foreground)); }
                    .equipment-instruction-content p { margin-bottom: 0.875rem; line-height: 1.65; color: hsl(var(--muted-foreground)); }
                    .equipment-instruction-content ul,
                    .equipment-instruction-content ol { margin: 0 0 1rem 1.25rem; color: hsl(var(--muted-foreground)); }
                    .equipment-instruction-content li { margin-bottom: 0.5rem; }
                    .equipment-instruction-content a { color: hsl(var(--primary)); text-decoration: underline; }
                    .equipment-instruction-content img { max-width: 100%; height: auto; border-radius: 0.75rem; margin: 1rem auto; }
                    .equipment-instruction-content blockquote {
                        margin: 1rem 0;
                        padding-left: 1rem;
                        border-left: 3px solid hsl(var(--border));
                        color: hsl(var(--muted-foreground));
                    }
                    .equipment-instruction-content pre {
                        margin: 1rem 0;
                        padding: 1rem;
                        overflow-x: auto;
                        border-radius: 0.75rem;
                        background: hsl(var(--background));
                        border: 1px solid hsl(var(--border));
                        color: hsl(var(--foreground));
                    }
                    .equipment-instruction-content code {
                        padding: 0.125rem 0.375rem;
                        border-radius: 0.375rem;
                        background: hsl(var(--accent));
                        color: hsl(var(--foreground));
                        font-size: 0.875em;
                    }
                    .equipment-instruction-content pre code {
                        padding: 0;
                        background: transparent;
                        border: none;
                    }
                `}</style>
            </DialogContent>
        </Dialog>
    )
}
