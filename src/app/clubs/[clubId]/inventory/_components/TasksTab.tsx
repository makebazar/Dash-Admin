"use client"

import { useState, useTransition } from "react"
import { CheckCircle2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { completeTask } from "../actions"
import { useParams } from "next/navigation"
import { useUiDialogs } from "./useUiDialogs"

interface TasksTabProps {
    tasks: any[]
    currentUserId: string
}

export function TasksTab({ tasks, currentUserId }: TasksTabProps) {
    const params = useParams()
    const clubId = params.clubId as string
    
    const [isPending, startTransition] = useTransition()
    const { showMessage, Dialogs } = useUiDialogs()

    const handleComplete = (taskId: number) => {
        startTransition(async () => {
            try {
                await completeTask(taskId, currentUserId, clubId)
            } catch (e) {
                console.error(e)
                showMessage({ title: "Ошибка", description: "Ошибка при выполнении задачи" })
            }
        })
    }

    if (tasks.length === 0) {
        return (
            <div className="py-14 text-center text-sm text-slate-400 italic">
                Активных задач нет.
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tasks.map(task => (
                    <div key={task.id} className="bg-card border rounded-lg p-4 shadow-sm flex flex-col justify-between">
                        <div>
                            <div className="flex justify-between items-start mb-2">
                            <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${
                                task.priority === 'HIGH' ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-500'
                            }`}>
                                {task.priority === 'HIGH' ? 'Высокий' : 'Обычный'}
                            </span>
                            <span className="text-[10px] text-slate-400">
                                {new Date(task.created_at).toLocaleDateString('ru-RU')}
                            </span>
                        </div>
                            
                            <h3 className="font-semibold text-lg mb-1">{task.title}</h3>
                            <p className="text-sm text-muted-foreground mb-4">{task.description}</p>
                            
                            {task.product_name && (
                                <div className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-xs text-slate-600 mb-4">
                                    Товар: <strong>{task.product_name}</strong>
                                </div>
                            )}
                        </div>

                        <Button 
                            className="w-full h-9 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white" 
                            onClick={() => handleComplete(task.id)}
                            disabled={isPending}
                        >
                            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                            Выполнено
                        </Button>
                    </div>
                ))}
            </div>
            {Dialogs}
        </div>
    )
}
