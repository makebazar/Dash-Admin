"use client"

import { useState } from "react"
import { CheckCircle2, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface ShiftOpeningWizardProps {
    isOpen: boolean
    onClose: () => void
    onComplete: (responses: Record<number, { score: number, comment: string }>) => void
    checklistTemplate: any
}

export function ShiftOpeningWizard({
    isOpen,
    onClose,
    onComplete,
    checklistTemplate
}: ShiftOpeningWizardProps) {
    const [checklistResponses, setChecklistResponses] = useState<Record<number, { score: number, comment: string }>>({})

    const handleChecklistChange = (itemId: number, score: number) => {
        setChecklistResponses(prev => ({
            ...prev,
            [itemId]: { ...prev[itemId], score }
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

        onComplete(checklistResponses)
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-2xl bg-slate-950 border-slate-800 text-white max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle>Приемка смены: {checklistTemplate.name}</DialogTitle>
                    <DialogDescription className="text-slate-400">
                        Проверьте состояние клуба после предыдущей смены
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto py-4 pr-2 space-y-4">
                    {checklistTemplate.items?.map((item: any) => (
                        <div key={item.id} className="space-y-2 border-b border-slate-800 pb-4 last:border-0">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-slate-200">{item.content}</span>
                                <div className="flex gap-1 bg-slate-900 p-1 rounded-md border border-slate-800">
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

                <DialogFooter className="mt-4 border-t border-slate-800 pt-4">
                    <Button onClick={handleComplete} className="w-full bg-blue-600 hover:bg-blue-700">
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Подтвердить и начать смену
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
