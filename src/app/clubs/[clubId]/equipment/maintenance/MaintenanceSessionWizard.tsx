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
import { Loader2, AlertTriangle, CheckCircle2, ChevronRight, ChevronLeft } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

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
    }

    const handleCompleteTask = async () => {
        if (!currentTask) return
        
        setIsSubmitting(true)
        try {
            // 1. Complete the task
            await fetch(`/api/clubs/${clubId}/equipment/maintenance/${currentTask.id}/complete`, {
                method: "POST"
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
                {/* Header with Progress */}
                <div className="relative bg-white border-b pt-4 sm:pt-6 px-4 sm:px-8 pb-4">
                    {/* Mobile Close Button */}
                    <button 
                        onClick={onClose}
                        className="sm:hidden absolute right-4 top-4 p-2 rounded-full hover:bg-slate-100 text-slate-400"
                    >
                        <X className="h-5 w-5" />
                    </button>

                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3 sm:gap-4">
                            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-lg shadow-indigo-200">
                                {currentIndex + 1}
                            </div>
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
                        <div className="hidden sm:flex flex-col items-end gap-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Прогресс</span>
                            <span className="text-sm font-black text-indigo-600">{Math.round(progress)}%</span>
                        </div>
                    </div>
                    <Progress value={progress} className="h-1.5 bg-slate-100" />
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
                    <div className="w-full md:w-[360px] p-4 sm:p-8 flex flex-col gap-6 overflow-y-auto border-t md:border-t-0 md:border-l border-slate-200">
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Статус проверки</h3>
                                <div 
                                    className={cn(
                                        "p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between group",
                                        !hasIssue 
                                            ? "bg-green-50 border-green-200 text-green-700" 
                                            : "bg-white border-slate-100 text-slate-500 hover:border-slate-200"
                                    )}
                                    onClick={() => setHasIssue(false)}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={cn("h-6 w-6 rounded-full flex items-center justify-center", !hasIssue ? "bg-green-500 text-white" : "bg-slate-100 text-slate-300")}>
                                            <CheckCircle2 className="h-4 w-4" />
                                        </div>
                                        <span className="font-bold text-sm">Все в порядке</span>
                                    </div>
                                    {!hasIssue && <Badge className="bg-green-500/20 text-green-700 border-none text-[10px]">Выбрано</Badge>}
                                </div>

                                <div 
                                    className={cn(
                                        "p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between mt-3 group",
                                        hasIssue 
                                            ? "bg-amber-50 border-amber-200 text-amber-700" 
                                            : "bg-white border-slate-100 text-slate-500 hover:border-slate-200"
                                    )}
                                    onClick={() => setHasIssue(true)}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={cn("h-6 w-6 rounded-full flex items-center justify-center", hasIssue ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-300")}>
                                            <AlertTriangle className="h-4 w-4" />
                                        </div>
                                        <span className="font-bold text-sm">Есть проблема</span>
                                    </div>
                                    {hasIssue && <Badge className="bg-amber-500/20 text-amber-700 border-none text-[10px]">Выбрано</Badge>}
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
                    <div className="flex items-center gap-3 text-slate-400 order-2 sm:order-1">
                        <div className="flex -space-x-2">
                            {tasks.slice(0, 5).map((_, i) => (
                                <div key={i} className={cn("h-6 w-6 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-bold", i <= currentIndex ? "bg-indigo-600 text-white" : "text-slate-400")}>
                                    {i + 1}
                                </div>
                            ))}
                            {tasks.length > 5 && (
                                <div className="h-6 w-6 rounded-full border-2 border-white bg-slate-50 flex items-center justify-center text-[8px] font-bold text-slate-400">
                                    +{tasks.length - 5}
                                </div>
                            )}
                        </div>
                        <span className="text-xs font-bold tracking-tight">
                            {isLastTask ? "Финальный этап" : `Осталось: ${tasks.length - currentIndex - 1}`}
                        </span>
                    </div>
                    
                    <div className="flex gap-3 w-full sm:w-auto order-1 sm:order-2">
                        <Button 
                            onClick={handleCompleteTask} 
                            disabled={isSubmitting || (hasIssue && !issueTitle)}
                            className="w-full sm:w-auto h-12 px-8 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg shadow-indigo-200 transition-all hover:translate-y-[-2px] active:translate-y-0 disabled:opacity-50"
                        >
                            {isSubmitting ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <>
                                    {isLastTask ? "Завершить сессию" : "Подтвердить и далее"}
                                    {isLastTask ? <CheckCircle2 className="ml-2 h-5 w-5" /> : <ChevronRight className="ml-2 h-5 w-5" />}
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
