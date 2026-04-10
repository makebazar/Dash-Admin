"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import {
    Loader2,
    Save
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

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

    useEffect(() => {
        fetchData()
    }, [clubId])

    useEffect(() => {
        if (selectedType) {
            const savedInstr = instructions[selectedType]
            setContent(savedInstr?.instructions || "")
            setInterval(savedInstr?.default_interval_days || 30)
        }
    }, [selectedType, instructions])

    const selectedInstruction = useMemo(
        () => (selectedType ? instructions[selectedType] : undefined),
        [instructions, selectedType]
    )

    const savedContent = selectedInstruction?.instructions || ""
    const savedInterval = selectedInstruction?.default_interval_days || 30
    const hasUnsavedChanges = content !== savedContent || interval !== savedInterval
    const selectedTypeMeta = equipmentTypes.find(type => type.code === selectedType)

    const handleSelectType = (typeCode: string) => {
        if (typeCode === selectedType) return
        if (hasUnsavedChanges && !confirm("У вас есть несохраненные изменения. Продолжить?")) {
            return
        }
        setSelectedType(typeCode)
    }

    const fetchData = async () => {
        try {
            const [typesRes, instrRes] = await Promise.all([
                fetch(`/api/equipment-types?clubId=${clubId}`),
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
                    default_interval_days: interval
                })
            })

            if (res.ok) {
                const updatedInstr = await res.json()
                setInstructions(prev => ({
                    ...prev,
                    [selectedType]: updatedInstr
                }))
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
        <>
        <div className="space-y-4 md:space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-8 border-b border-slate-100 pb-6">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">Настройки обслуживания</h2>
                        <p className="text-sm text-slate-500 mt-1">Интервал и инструкция для выбранного типа оборудования.</p>
                    </div>
                    <Button
                        onClick={handleSave}
                        disabled={isSaving || !hasUnsavedChanges}
                        className={cn(
                            "hidden md:inline-flex rounded-xl h-11 px-6 font-medium",
                            hasUnsavedChanges ? "bg-green-600 hover:bg-green-700 text-white" : "bg-slate-900 text-white hover:bg-slate-800"
                        )}
                    >
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        {hasUnsavedChanges ? "Сохранить изменения" : "Сохранено"}
                    </Button>
                </div>

                    <div className="grid gap-6 lg:grid-cols-[minmax(320px,1fr)_180px] lg:items-end mb-8">
                        <div className="space-y-2">
                            <Label htmlFor="equipment-type" className="text-sm font-medium">Тип оборудования</Label>
                            <Select value={selectedType} onValueChange={handleSelectType}>
                                <SelectTrigger id="equipment-type" className="h-11 rounded-xl bg-white px-4 text-base">
                                    <SelectValue placeholder="Выберите тип оборудования" />
                                </SelectTrigger>
                                <SelectContent>
                                    {equipmentTypes.map(type => (
                                        <SelectItem key={type.code} value={type.code}>
                                            {type.name_ru}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="default-interval" className="text-sm font-medium">Интервал</Label>
                            <div className="flex h-11 w-fit items-center overflow-hidden rounded-xl border bg-white">
                                <Input
                                    id="default-interval"
                                    type="number"
                                    min="1"
                                    max="365"
                                    value={interval}
                                    onChange={(e) => setInterval(parseInt(e.target.value, 10) || 30)}
                                    className="h-full w-20 border-0 bg-transparent px-3 text-center text-lg font-semibold tabular-nums shadow-none focus-visible:ring-0"
                                />
                                <div className="flex h-full items-center border-l bg-slate-50 px-3 text-sm text-muted-foreground">
                                    дней
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div>
                    <div className="space-y-3">
                        <div>
                            <div className="text-lg font-semibold text-slate-950">Инструкция для персонала</div>
                            <div className="mt-1 text-sm text-muted-foreground">
                                Пошаговый регламент, критерии проверки и любые важные детали для {selectedTypeMeta?.name_ru || "выбранного типа"}.
                            </div>
                        </div>

                        <RichTextEditor
                            value={content}
                            onChange={setContent}
                            placeholder="Опиши порядок действий, критерии проверки, фото-примеры и важные замечания для сотрудников."
                            className="min-h-[360px] md:min-h-[420px]"
                        />

                        <div className="flex flex-col gap-2 px-1 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                            <span>Поддерживаются заголовки, списки, ссылки, изображения, акценты и цветовые выделения.</span>
                            {hasUnsavedChanges && <span className="font-medium text-amber-600">Есть несохранённые изменения</span>}
                        </div>
                    </div>
                </div>
            </div>

            <div className="sticky bottom-4 z-20 md:hidden">
                <div className="rounded-2xl border bg-white/95 p-3 shadow-lg backdrop-blur">
                    <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-900">{selectedTypeMeta?.name_ru}</div>
                            <div className="text-[11px] text-muted-foreground">{interval} дн. · единый стандарт типа</div>
                        </div>
                        {hasUnsavedChanges && (
                            <span className="shrink-0 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700">
                                Не сохранено
                            </span>
                        )}
                    </div>
                    <Button
                        onClick={handleSave}
                        disabled={isSaving || !hasUnsavedChanges}
                        className={cn(
                            "h-11 w-full rounded-xl",
                            hasUnsavedChanges && "bg-green-600 hover:bg-green-700"
                        )}
                    >
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        {hasUnsavedChanges ? "Сохранить изменения" : "Сохранено"}
                    </Button>
                </div>
            </div>
        </>
    )
}
