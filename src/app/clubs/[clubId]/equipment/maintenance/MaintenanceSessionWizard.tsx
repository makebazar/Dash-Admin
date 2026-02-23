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

interface MaintenanceTask {
    id: string
    equipment_id: string
    equipment_name: string
    equipment_type: string
    equipment_type_name: string
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
                        priority: "MEDIUM", // Default
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

    const instructionHtml = instructions[currentTask.equipment_type] || "<p>Инструкция отсутствует.</p>"

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[800px] h-[90vh] flex flex-col p-0 gap-0">
                <DialogHeader className="p-6 pb-4 bg-slate-50 border-b">
                    <div className="flex items-center justify-between">
                        <DialogTitle className="text-xl flex items-center gap-2">
                            <span className="bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center text-sm">
                                {currentIndex + 1}/{tasks.length}
                            </span>
                            Обслуживание: {currentTask.equipment_name}
                        </DialogTitle>
                        <Badge variant="outline">{currentTask.equipment_type_name}</Badge>
                    </div>
                    <DialogDescription>
                        Следуйте инструкции ниже для выполнения обслуживания.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                    {/* Instructions Panel */}
                    <div className="flex-1 p-6 overflow-y-auto border-r bg-white">
                        <h3 className="font-semibold mb-4 flex items-center gap-2">
                            <ClipboardListIcon className="h-5 w-5 text-blue-600" />
                            Инструкция
                        </h3>
                        {isLoading ? (
                            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-300" /></div>
                        ) : (
                            <div 
                                className="prose prose-sm max-w-none prose-blue"
                                dangerouslySetInnerHTML={{ __html: instructionHtml }} 
                            />
                        )}
                    </div>

                    {/* Action Panel */}
                    <div className="w-full md:w-[320px] bg-slate-50 p-6 flex flex-col gap-6 overflow-y-auto">
                        <div className="space-y-4">
                            <h3 className="font-semibold flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-amber-600" />
                                Сообщить о проблеме
                            </h3>
                            <div className="flex items-start space-x-2">
                                <Switch 
                                    id="has-issue" 
                                    checked={hasIssue}
                                    onCheckedChange={(c) => setHasIssue(!!c)}
                                />
                                <div className="grid gap-1.5 leading-none">
                                    <Label
                                        htmlFor="has-issue"
                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                    >
                                        Обнаружена неисправность
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                        Создаст инцидент после завершения
                                    </p>
                                </div>
                            </div>

                            {hasIssue && (
                                <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                                    <div className="space-y-1">
                                        <Label className="text-xs">Суть проблемы</Label>
                                        <Input 
                                            placeholder="Например: Люфт колеса" 
                                            value={issueTitle}
                                            onChange={(e) => setIssueTitle(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Описание (опционально)</Label>
                                        <Textarea 
                                            placeholder="Подробности..." 
                                            className="resize-none h-20" 
                                            value={issueDescription}
                                            onChange={(e) => setIssueDescription(e.target.value)}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <DialogFooter className="p-4 border-t bg-white flex justify-between items-center sm:justify-between">
                    <div className="text-sm text-muted-foreground">
                        {tasks.length - currentIndex - 1 > 0 ? `Осталось задач: ${tasks.length - currentIndex - 1}` : "Последняя задача"}
                    </div>
                    <div className="flex gap-2">
                         {/* Skip button could be added here */}
                        <Button onClick={handleCompleteTask} disabled={isSubmitting || (hasIssue && !issueTitle)}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isLastTask ? "Завершить сессию" : "Далее"}
                            {!isLastTask && <ChevronRight className="ml-2 h-4 w-4" />}
                            {isLastTask && <CheckCircle2 className="ml-2 h-4 w-4" />}
                        </Button>
                    </div>
                </DialogFooter>
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
