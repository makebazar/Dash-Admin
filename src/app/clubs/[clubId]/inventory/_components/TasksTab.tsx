"use client"

import { useState, useTransition } from "react"
import { CheckCircle2, AlertCircle, Clock, Package, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { completeTask } from "../actions"
import { useParams } from "next/navigation"

interface TasksTabProps {
    tasks: any[]
    currentUserId: string
}

export function TasksTab({ tasks, currentUserId }: TasksTabProps) {
    const params = useParams()
    const clubId = params.clubId as string
    
    const [isPending, startTransition] = useTransition()

    const handleComplete = (taskId: number) => {
        startTransition(async () => {
            try {
                await completeTask(taskId, currentUserId, clubId)
            } catch (e) {
                console.error(e)
                alert("Ошибка при выполнении задачи")
            }
        })
    }

    if (tasks.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 border rounded-lg bg-white text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mb-4 text-green-500/50" />
                <p className="text-lg font-medium">Все задачи выполнены!</p>
                <p className="text-sm">На данный момент нет активных задач по складу.</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tasks.map(task => (
                    <div key={task.id} className="bg-white border rounded-lg p-4 shadow-sm flex flex-col justify-between">
                        <div>
                            <div className="flex justify-between items-start mb-2">
                                <Badge variant={task.priority === 'HIGH' ? 'destructive' : 'secondary'}>
                                    {task.priority === 'HIGH' ? 'Высокий приоритет' : 'Обычный'}
                                </Badge>
                                <span className="text-xs text-muted-foreground flex items-center">
                                    <Clock className="h-3 w-3 mr-1" />
                                    {new Date(task.created_at).toLocaleDateString()}
                                </span>
                            </div>
                            
                            <h3 className="font-semibold text-lg mb-1">{task.title}</h3>
                            <p className="text-sm text-muted-foreground mb-4">{task.description}</p>
                            
                            {task.product_name && (
                                <div className="bg-slate-50 p-2 rounded text-sm mb-4 flex items-center">
                                    <Package className="h-4 w-4 mr-2 text-slate-500" />
                                    <span>Товар: <strong>{task.product_name}</strong></span>
                                </div>
                            )}
                        </div>

                        <Button 
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" 
                            onClick={() => handleComplete(task.id)}
                            disabled={isPending}
                        >
                            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                            Выполнено
                        </Button>
                    </div>
                ))}
            </div>
        </div>
    )
}
