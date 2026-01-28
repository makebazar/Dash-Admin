"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useParams } from "next/navigation"
import {
    LayoutGrid,
    Plus,
    ChevronLeft,
    MoreVertical,
    Pencil,
    Trash2,
    Loader2,
    MapPin,
    Monitor,
    Layers,
    Save,
    X,
    FolderPlus
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface Workstation {
    id: string
    name: string
    zone: string
    equipment_count?: number
}

export default function WorkplacesManager() {
    const { clubId } = useParams()
    const [workstations, setWorkstations] = useState<Workstation[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)

    // Dialog states
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingWorkplace, setEditingWorkplace] = useState<Partial<Workstation> | null>(null)

    const fetchData = useCallback(async () => {
        setIsLoading(true)
        try {
            // Fetch workstations and possibly counts from equipment
            const [wsRes, eqRes] = await Promise.all([
                fetch(`/api/clubs/${clubId}/workstations`),
                fetch(`/api/clubs/${clubId}/equipment`)
            ])

            const wsData = await wsRes.json()
            const eqData = await eqRes.json()

            if (wsRes.ok && eqRes.ok) {
                const equipment = eqData.equipment || []
                const enhancedWs = wsData.map((ws: Workstation) => ({
                    ...ws,
                    equipment_count: equipment.filter((e: any) => e.workstation_id === ws.id).length
                }))
                setWorkstations(enhancedWs)
            }
        } catch (error) {
            console.error("Error fetching workplaces:", error)
        } finally {
            setIsLoading(false)
        }
    }, [clubId])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const zones = useMemo(() => {
        const z = new Set(workstations.map(w => w.zone))
        return Array.from(z).sort()
    }, [workstations])

    const handleCreate = () => {
        setEditingWorkplace({
            name: '',
            zone: zones[0] || 'General'
        })
        setIsDialogOpen(true)
    }

    const handleEdit = (ws: Workstation) => {
        setEditingWorkplace(ws)
        setIsDialogOpen(true)
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editingWorkplace?.name || !editingWorkplace?.zone) return

        setIsSaving(true)
        try {
            const isNew = !editingWorkplace.id
            const url = isNew
                ? `/api/clubs/${clubId}/workstations`
                : `/api/clubs/${clubId}/workstations/${editingWorkplace.id}`

            const res = await fetch(url, {
                method: isNew ? "POST" : "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editingWorkplace)
            })

            if (res.ok) {
                setIsDialogOpen(false)
                fetchData()
            }
        } catch (error) {
            console.error("Error saving workplace:", error)
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async (id: string) => {
        const ws = workstations.find(w => w.id === id)
        if (ws && ws.equipment_count && ws.equipment_count > 0) {
            alert("Нельзя удалить рабочее место, к которому привязано оборудование. Сначала переместите оборудование на склад.")
            return
        }

        if (!confirm("Вы уверены, что хотите удалить это рабочее место?")) return

        try {
            const res = await fetch(`/api/clubs/${clubId}/workstations/${id}`, {
                method: "DELETE"
            })
            if (res.ok) fetchData()
        } catch (error) {
            console.error("Error deleting workplace:", error)
        }
    }

    return (
        <div className="p-8 space-y-8 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex flex-col gap-4">
                <Link href={`/clubs/${clubId}/equipment`} className="flex items-center text-sm text-muted-foreground hover:text-foreground">
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    К обзору
                </Link>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">🗺 Управление местами</h1>
                        <p className="text-muted-foreground mt-1">Настройка игровых зон и рабочих станций</p>
                    </div>
                    <Button onClick={handleCreate} className="bg-gradient-to-r from-indigo-600 to-violet-600">
                        <Plus className="mr-2 h-4 w-4" />
                        Создать место
                    </Button>
                </div>
            </div>

            {/* Zones Grid */}
            <div className="space-y-12">
                {zones.length === 0 && !isLoading ? (
                    <div className="text-center py-20 bg-slate-50 rounded-[40px] border-2 border-dashed border-slate-200">
                        <div className="h-20 w-20 bg-white rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                            <MapPin className="h-10 w-10 text-slate-300" />
                        </div>
                        <h3 className="text-lg font-bold">Зоны не созданы</h3>
                        <p className="text-sm text-muted-foreground mb-6">Создайте первое рабочее место, чтобы организовать пространство клуба</p>
                        <Button onClick={handleCreate} variant="outline">Создать первое место</Button>
                    </div>
                ) : (
                    zones.map(zone => (
                        <section key={zone} className="space-y-4">
                            <div className="flex items-center justify-between px-2">
                                <h2 className="text-lg font-black uppercase tracking-widest text-slate-500 flex items-center gap-3">
                                    <Layers className="h-5 w-5 text-indigo-500" />
                                    {zone}
                                    <Badge variant="secondary" className="bg-indigo-50 text-indigo-600 border-none px-2">{workstations.filter(w => w.zone === zone).length}</Badge>
                                </h2>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {workstations.filter(w => w.zone === zone).map(ws => (
                                    <Card key={ws.id} className="group hover:border-indigo-200 transition-all border-slate-100 shadow-sm overflow-hidden">
                                        <CardContent className="p-4 flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="h-12 w-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                                    <Monitor className="h-6 w-6" />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-slate-900">{ws.name}</h4>
                                                    <p className="text-[10px] text-muted-foreground font-medium uppercase">{ws.equipment_count || 0} устройств</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-indigo-600" onClick={() => handleEdit(ws)}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-rose-600" onClick={() => handleDelete(ws.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                                <button
                                    onClick={handleCreate}
                                    className="h-[82px] border-2 border-dashed border-slate-100 rounded-xl flex items-center justify-center gap-2 text-slate-400 hover:border-indigo-200 hover:text-indigo-500 hover:bg-indigo-50/30 transition-all group"
                                >
                                    <Plus className="h-4 w-4 group-hover:scale-125 transition-transform" />
                                    <span className="text-xs font-bold uppercase tracking-widest">Добавить в {zone}</span>
                                </button>
                            </div>
                        </section>
                    ))
                )}
            </div>

            {/* Workplace Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>{editingWorkplace?.id ? "Редактировать место" : "Новое рабочее место"}</DialogTitle>
                        <DialogDescription>
                            Укажите название (например, PC-01) и зону (Vip, Standard, Boot-camp).
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSave} className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label htmlFor="ws-name">Название места</Label>
                            <Input
                                id="ws-name"
                                placeholder="PC-01"
                                value={editingWorkplace?.name || ""}
                                onChange={(e) => setEditingWorkplace(prev => ({ ...prev, name: e.target.value }))}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="ws-zone">Игровая зона</Label>
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <Select
                                        value={editingWorkplace?.zone}
                                        onValueChange={(val) => setEditingWorkplace(prev => ({ ...prev, zone: val }))}
                                    >
                                        <SelectTrigger id="ws-zone">
                                            <SelectValue placeholder="Выберите зону" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {zones.length > 0 ? zones.map(z => (
                                                <SelectItem key={z} value={z}>{z}</SelectItem>
                                            )) : (
                                                <SelectItem value="General">General</SelectItem>
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button type="button" variant="outline" size="icon" title="Новая зона">
                                            <FolderPlus className="h-4 w-4" />
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Добавить новую зону</DialogTitle>
                                        </DialogHeader>
                                        <div className="py-4">
                                            <Input id="new-zone" placeholder="Название зоны (например, PS5 Zone)" onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    const val = (e.target as HTMLInputElement).value
                                                    if (val) setEditingWorkplace(prev => ({ ...prev, zone: val }))
                                                    // Close this sub-dialog? Radix handles nested dialogs okay-ish
                                                }
                                            }} />
                                        </div>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        </div>
                        <DialogFooter className="pt-4">
                            <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>Отмена</Button>
                            <Button type="submit" disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700">
                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Сохранить
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
