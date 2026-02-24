"use client"

import { useState, useEffect, useRef } from "react"
import { useParams } from "next/navigation"
import {
    Loader2,
    Save,
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

interface EquipmentType {
    code: string
    name_ru: string
    icon: string
}

interface Instruction {
    id: string
    equipment_type_code: string
    instructions: string
}

export function InstructionsTab() {
    const { clubId } = useParams()
    const [equipmentTypes, setEquipmentTypes] = useState<EquipmentType[]>([])
    const [instructions, setInstructions] = useState<Record<string, string>>({})
    const [selectedType, setSelectedType] = useState<string>("")
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [content, setContent] = useState("")
    const editorRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        fetchData()
    }, [clubId])

    useEffect(() => {
        if (selectedType) {
            setContent(instructions[selectedType] || "")
        }
    }, [selectedType])

    const fetchData = async () => {
        try {
            const [typesRes, instrRes] = await Promise.all([
                fetch('/api/equipment-types'),
                fetch(`/api/clubs/${clubId}/equipment-instructions`)
            ])

            const types = await typesRes.json()
            const instrs = await instrRes.json()

            setEquipmentTypes(types)
            
            const instrMap: Record<string, string> = {}
            if (Array.isArray(instrs)) {
                instrs.forEach((i: Instruction) => {
                    instrMap[i.equipment_type_code] = i.instructions
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
                    instructions: content
                })
            })

            if (res.ok) {
                setInstructions(prev => ({
                    ...prev,
                    [selectedType]: content
                }))
            }
        } catch (error) {
            console.error("Error saving instructions:", error)
        } finally {
            setIsSaving(false)
        }
    }

    useEffect(() => {
        if (!editorRef.current) return
        if (editorRef.current.innerText === content) return
        editorRef.current.innerText = content
    }, [selectedType]) // Only update when type changes to avoid cursor jumps during typing

    if (isLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="md:col-span-1 h-fit bg-white border-none shadow-sm">
                <CardHeader>
                    <CardTitle className="text-lg">Типы оборудования</CardTitle>
                    <CardDescription>Выберите тип для настройки инструкции</CardDescription>
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
                                onClick={() => setSelectedType(type.code)}
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
                        <CardTitle>Редактор инструкций</CardTitle>
                        <CardDescription>
                            Опишите пошаговый процесс обслуживания для <span className="font-medium text-foreground">{equipmentTypes.find(t => t.code === selectedType)?.name_ru}</span>
                        </CardDescription>
                    </div>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Сохранить
                    </Button>
                </CardHeader>
                <CardContent>
                    <div className="h-[600px] flex flex-col bg-slate-50 rounded-md border p-4">
                        <div
                            ref={editorRef}
                            className="flex-1 h-full outline-none whitespace-pre-wrap text-sm text-slate-800"
                            contentEditable
                            suppressContentEditableWarning
                            onInput={(event) => {
                                const value = (event.target as HTMLDivElement).innerText
                                setContent(value)
                            }}
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
