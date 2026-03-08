"use client"

import { useState, useEffect, useRef } from "react"
import { useParams } from "next/navigation"
import {
    Loader2,
    Save,
    Clock,
    RefreshCw
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

interface EquipmentType {
    code: string
    name_ru: string
    icon: string
}

interface Instruction {
    id: string
    equipment_type_code: string
    instructions: string
    default_interval_days?: number
}

export function InstructionsTab() {
    const { clubId } = useParams()
    const [equipmentTypes, setEquipmentTypes] = useState<EquipmentType[]>([])
    const [instructions, setInstructions] = useState<Record<string, Instruction>>({})
    const [selectedType, setSelectedType] = useState<string>("")
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [content, setContent] = useState("")
    const [interval, setInterval] = useState<number>(30)
    const [applyToExisting, setApplyToExisting] = useState(false)
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

    useEffect(() => {
        import("quill")
    }, [])

    useEffect(() => {
        fetchData()
    }, [clubId])

    // Load content when selected type changes
    useEffect(() => {
        if (selectedType) {
            const savedInstr = instructions[selectedType]
            setContent(savedInstr?.instructions || "")
            setInterval(savedInstr?.default_interval_days || 30)
            setHasUnsavedChanges(false)
            setApplyToExisting(false)
        }
    }, [selectedType, instructions])

    const fetchData = async () => {
        try {
            const [typesRes, instrRes] = await Promise.all([
                fetch('/api/equipment-types'),
                fetch(`/api/clubs/${clubId}/equipment-instructions`)
            ])

            const types = await typesRes.json()
            const instrs = await instrRes.json()

            setEquipmentTypes(types)
            
            const instrMap: Record<string, Instruction> = {}
            if (Array.isArray(instrs)) {
                instrs.forEach((i: Instruction) => {
                    instrMap[i.equipment_type_code] = i
                })
            }
            setInstructions(instrMap)

            if (types.length > 0 && !selectedType) {
                setSelectedType(types[0].code)
            }
        } catch (error) {
            console.error("Error fetching data:", error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleSave = async () => {
        if (!selectedType) return

        setIsSaving(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/equipment-instructions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    equipment_type_code: selectedType,
                    instructions: content,
                    default_interval_days: interval,
                    apply_to_existing: applyToExisting
                })
            })

            if (res.ok) {
                const updatedInstr = await res.json()
                // Update local state
                setInstructions(prev => ({
                    ...prev,
                    [selectedType]: updatedInstr
                }))
                setHasUnsavedChanges(false)
                setApplyToExisting(false)
                alert("Настройки сохранены")
            } else {
                alert("Ошибка при сохранении")
            }
        } catch (error) {
            console.error("Error saving instructions:", error)
            alert("Ошибка при сохранении")
        } finally {
            setIsSaving(false)
        }
    }

    if (isLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="md:col-span-1 h-fit bg-white border-none shadow-sm">
                <CardHeader>
                    <CardTitle className="text-lg">Типы оборудования</CardTitle>
                    <CardDescription>Выберите тип для настройки</CardDescription>
                </CardHeader>
                <CardContent className="p-2">
                    <div className="flex flex-col gap-1">
                        {equipmentTypes.map(type => (
                            <Button
                                key={type.code}
                                variant={selectedType === type.code ? "secondary" : "ghost"}
                                className={cn(
                                    "justify-start w-full text-sm",
                                    selectedType === type.code ? "bg-slate-100 font-medium" : "hover:bg-slate-50"
                                )}
                                onClick={() => {
                                    if (hasUnsavedChanges && !confirm("У вас есть несохраненные изменения. Продолжить?")) {
                                        return
                                    }
                                    setSelectedType(type.code)
                                }}
                            >
                                <span className="mr-2 opacity-70 w-4">{instructions[type.code] ? "📝" : "📄"}</span>
                                {type.name_ru}
                            </Button>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Card className="md:col-span-3 bg-white border-none shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                    <div className="space-y-1">
                        <CardTitle>Редактор инструкций и регламентов</CardTitle>
                        <CardDescription>
                            Настройка процесса обслуживания для <span className="font-medium text-foreground">{equipmentTypes.find(t => t.code === selectedType)?.name_ru}</span>
                        </CardDescription>
                    </div>
                    <Button onClick={handleSave} disabled={isSaving || !hasUnsavedChanges} className={cn(hasUnsavedChanges && "bg-green-600 hover:bg-green-700")}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        {hasUnsavedChanges ? "Сохранить изменения" : "Сохранено"}
                    </Button>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Settings Panel */}
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Clock className="h-4 w-4 text-indigo-500" />
                            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Периодичность обслуживания</h3>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label className="text-xs">Интервал чистки (дней)</Label>
                                <div className="flex items-center gap-2">
                                    <Input 
                                        type="number" 
                                        min="1" 
                                        max="365"
                                        className="w-24 bg-white" 
                                        value={interval}
                                        onChange={(e) => {
                                            setInterval(parseInt(e.target.value) || 30)
                                            setHasUnsavedChanges(true)
                                        }}
                                    />
                                    <span className="text-sm text-muted-foreground">дней</span>
                                </div>
                                <p className="text-[10px] text-muted-foreground">Как часто нужно обслуживать этот тип устройств</p>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs">Применить ко всем устройствам</Label>
                                <div className="flex items-center gap-3 p-2 bg-white rounded-lg border border-slate-200">
                                    <Switch 
                                        checked={applyToExisting}
                                        onCheckedChange={(checked) => {
                                            setApplyToExisting(checked)
                                            setHasUnsavedChanges(true)
                                        }}
                                    />
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium">Обновить существующие</span>
                                        <span className="text-[10px] text-muted-foreground">Перезаписать интервалы у всех {equipmentTypes.find(t => t.code === selectedType)?.name_ru}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                             <Label className="text-sm font-bold text-slate-700 uppercase tracking-wide">Инструкция для персонала</Label>
                        </div>
                        <div className="h-[500px] flex flex-col">
                            <textarea
                                className="flex-1 w-full p-4 rounded-md border bg-slate-50 outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none text-sm text-slate-800 font-sans leading-relaxed"
                                placeholder="Опишите пошаговый процесс обслуживания..."
                                value={content}
                                onChange={(e) => {
                                    setContent(e.target.value)
                                    setHasUnsavedChanges(true)
                                }}
                            />
                            <div className="mt-2 text-[10px] text-muted-foreground flex justify-between px-1">
                                <span>Поддержка переноса строк включена</span>
                                {hasUnsavedChanges && <span className="text-amber-600 font-medium">Есть несохраненные изменения</span>}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
