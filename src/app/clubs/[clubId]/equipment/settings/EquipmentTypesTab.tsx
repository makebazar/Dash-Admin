"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { Edit3, Loader2, Plus, RotateCcw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { EQUIPMENT_ICON_OPTIONS, renderEquipmentIcon } from "@/lib/equipment-icons"

interface EquipmentType {
    code: string
    name: string
    name_ru: string
    default_cleaning_interval: number
    icon: string
    sort_order: number
    club_id: number | null
    is_system: boolean
    is_active: boolean
    base_type_code?: string | null
}

const EMPTY_FORM = {
    name_ru: "",
    default_cleaning_interval: 30,
    icon: "wrench",
    base_type_code: "none",
}

export function EquipmentTypesTab() {
    const { clubId } = useParams()
    const [types, setTypes] = useState<EquipmentType[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingType, setEditingType] = useState<EquipmentType | null>(null)
    const [form, setForm] = useState(EMPTY_FORM)

    const fetchTypes = async () => {
        setIsLoading(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/equipment-types`, { cache: "no-store" })
            const data = await res.json()
            if (res.ok) {
                setTypes(Array.isArray(data) ? data : [])
            } else {
                alert(data.error || "Не удалось загрузить типы оборудования")
            }
        } catch (error) {
            console.error("Error loading equipment types:", error)
            alert("Не удалось загрузить типы оборудования")
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchTypes()
    }, [clubId])

    const systemTypes = useMemo(
        () => types.filter(type => type.is_system).sort((a, b) => a.sort_order - b.sort_order || a.name_ru.localeCompare(b.name_ru)),
        [types]
    )

    const customTypes = useMemo(
        () => types.filter(type => !type.is_system).sort((a, b) => Number(b.is_active) - Number(a.is_active) || a.name_ru.localeCompare(b.name_ru)),
        [types]
    )

    const openCreateDialog = () => {
        setEditingType(null)
        setForm(EMPTY_FORM)
        setIsDialogOpen(true)
    }

    const openEditDialog = (type: EquipmentType) => {
        setEditingType(type)
        setForm({
            name_ru: type.name_ru,
            default_cleaning_interval: type.default_cleaning_interval || 30,
            icon: type.icon || "wrench",
            base_type_code: type.base_type_code || "none",
        })
        setIsDialogOpen(true)
    }

    const handleSave = async () => {
        if (!form.name_ru.trim()) {
            alert("Введите название типа")
            return
        }

        setIsSaving(true)
        try {
            const payload = {
                name_ru: form.name_ru.trim(),
                default_cleaning_interval: form.default_cleaning_interval,
                icon: form.icon,
                base_type_code: form.base_type_code === "none" ? null : form.base_type_code,
            }

            const url = editingType
                ? `/api/clubs/${clubId}/equipment-types/${editingType.code}`
                : `/api/clubs/${clubId}/equipment-types`

            const res = await fetch(url, {
                method: editingType ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })

            const data = await res.json()
            if (!res.ok) {
                alert(data.error || "Не удалось сохранить тип")
                return
            }

            setIsDialogOpen(false)
            await fetchTypes()
        } catch (error) {
            console.error("Error saving equipment type:", error)
            alert("Не удалось сохранить тип")
        } finally {
            setIsSaving(false)
        }
    }

    const handleToggleActive = async (type: EquipmentType, nextActive: boolean) => {
        setIsSaving(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/equipment-types/${type.code}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ is_active: nextActive }),
            })
            const data = await res.json()
            if (!res.ok) {
                alert(data.error || "Не удалось обновить тип")
                return
            }
            await fetchTypes()
        } catch (error) {
            console.error("Error updating equipment type status:", error)
            alert("Не удалось обновить тип")
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async (type: EquipmentType) => {
        if (!confirm(`Удалить тип "${type.name_ru}"?`)) return

        setIsSaving(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/equipment-types/${type.code}`, {
                method: "DELETE",
            })
            const data = await res.json()
            if (!res.ok) {
                alert(data.error || "Не удалось удалить тип")
                return
            }
            await fetchTypes()
        } catch (error) {
            console.error("Error deleting equipment type:", error)
            alert("Не удалось удалить тип")
        } finally {
            setIsSaving(false)
        }
    }

    if (isLoading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        )
    }

    return (
        <>
            <div className="space-y-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <h2 className="text-xl font-semibold tracking-tight text-slate-950">Типы оборудования</h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Системные типы доступны всем клубам, а свои типы ты можешь добавлять и настраивать отдельно.
                        </p>
                    </div>
                    <Button onClick={openCreateDialog} className="h-10 rounded-xl">
                        <Plus className="mr-2 h-4 w-4" />
                        Добавить тип
                    </Button>
                </div>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
                    <Card className="border-none shadow-sm">
                        <CardHeader>
                            <CardTitle>Типы клуба</CardTitle>
                            <CardDescription>Собственные типы оборудования для этого клуба</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {customTypes.length === 0 ? (
                                <div className="rounded-2xl border border-dashed bg-slate-50 px-4 py-6 text-sm text-muted-foreground">
                                    Клубных типов пока нет. Добавь свой тип, если системного списка недостаточно.
                                </div>
                            ) : (
                                customTypes.map(type => (
                                    <div key={type.code} className="rounded-2xl border bg-white p-4">
                                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                                                        {renderEquipmentIcon(undefined, type.icon, "h-5 w-5")}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="truncate text-base font-semibold text-slate-950">{type.name_ru}</div>
                                                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                                            <span>{type.code}</span>
                                                            <span>·</span>
                                                            <span>{type.default_cleaning_interval || 30} дн.</span>
                                                            <span>·</span>
                                                            <Badge variant={type.is_active ? "secondary" : "outline"} className="h-5 px-1.5">
                                                                {type.is_active ? "Активен" : "В архиве"}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2">
                                                <Button variant="outline" size="sm" onClick={() => openEditDialog(type)}>
                                                    <Edit3 className="mr-2 h-4 w-4" />
                                                    Изменить
                                                </Button>
                                                {type.is_active ? (
                                                    <Button variant="outline" size="sm" onClick={() => handleToggleActive(type, false)}>
                                                        В архив
                                                    </Button>
                                                ) : (
                                                    <Button variant="outline" size="sm" onClick={() => handleToggleActive(type, true)}>
                                                        <RotateCcw className="mr-2 h-4 w-4" />
                                                        Восстановить
                                                    </Button>
                                                )}
                                                <Button variant="ghost" size="sm" className="text-rose-600 hover:text-rose-700" onClick={() => handleDelete(type)}>
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Удалить
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm">
                        <CardHeader>
                            <CardTitle>Системные типы</CardTitle>
                            <CardDescription>Базовые типы, которые доступны всем клубам</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {systemTypes.map(type => (
                                <div key={type.code} className="flex items-center justify-between gap-3 rounded-2xl border bg-slate-50/60 px-4 py-3">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-700">
                                                {renderEquipmentIcon(type.code, type.icon, "h-4 w-4")}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="truncate text-sm font-semibold text-slate-950">{type.name_ru}</div>
                                                <div className="text-xs text-muted-foreground">{type.default_cleaning_interval || 30} дн. по умолчанию</div>
                                            </div>
                                        </div>
                                    </div>
                                    <Badge variant="outline">Системный</Badge>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>{editingType ? "Изменить тип оборудования" : "Новый тип оборудования"}</DialogTitle>
                        <DialogDescription>
                            Настрой название, иконку и интервал по умолчанию для клубного типа оборудования.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="type-name-ru">Название</Label>
                            <Input
                                id="type-name-ru"
                                value={form.name_ru}
                                onChange={(e) => setForm(prev => ({ ...prev, name_ru: e.target.value }))}
                                placeholder="Например: Симрейсинг-кресло"
                            />
                        </div>

                        <div className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
                            <div className="space-y-2">
                                <Label htmlFor="type-interval">Интервал</Label>
                                <Input
                                    id="type-interval"
                                    type="number"
                                    min="1"
                                    max="365"
                                    value={form.default_cleaning_interval}
                                    onChange={(e) => setForm(prev => ({ ...prev, default_cleaning_interval: parseInt(e.target.value, 10) || 30 }))}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Базовый тип</Label>
                                <Select value={form.base_type_code} onValueChange={(value) => setForm(prev => ({ ...prev, base_type_code: value }))}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Выбери базовый тип" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Без базового типа</SelectItem>
                                        {systemTypes.map(type => (
                                            <SelectItem key={type.code} value={type.code}>
                                                {type.name_ru}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Иконка</Label>
                            <Select value={form.icon} onValueChange={(value) => setForm(prev => ({ ...prev, icon: value }))}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Выбери иконку" />
                                </SelectTrigger>
                                <SelectContent>
                                    {EQUIPMENT_ICON_OPTIONS.map(option => (
                                        <SelectItem key={option.value} value={option.value}>
                                            <div className="flex items-center gap-2">
                                                {renderEquipmentIcon(undefined, option.value, "h-4 w-4")}
                                                <span>{option.label}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Отмена</Button>
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {editingType ? "Сохранить" : "Создать тип"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
