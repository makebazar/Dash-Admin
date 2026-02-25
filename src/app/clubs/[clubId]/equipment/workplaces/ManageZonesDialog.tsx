"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Pencil, Trash2, Plus, Save, X, Loader2, MapPin } from "lucide-react"

interface Zone {
    id: string
    name: string
    assigned_user_id: string | null
    assigned_user_name: string | null
    workstation_count: number
}

interface Employee {
    id: string
    full_name: string
}

interface ManageZonesDialogProps {
    clubId: string
    zones: Zone[]
    employees: Employee[]
    onZonesChange: () => void
    trigger?: React.ReactNode
}

export function ManageZonesDialog({ clubId, zones, employees, onZonesChange, trigger }: ManageZonesDialogProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [isCreating, setIsCreating] = useState(false)
    const [newZoneName, setNewZoneName] = useState("")
    const [newZoneResponsible, setNewZoneResponsible] = useState<string | null>(null)
    const [editingZoneId, setEditingZoneId] = useState<string | null>(null)
    const [editName, setEditName] = useState("")
    const [editResponsible, setEditResponsible] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)

    const handleCreate = async () => {
        if (!newZoneName.trim()) return

        setIsLoading(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/zones`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: newZoneName,
                    assigned_user_id: newZoneResponsible === "none" ? null : newZoneResponsible
                })
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || "Failed to create zone")
            }

            // toast.success("Зона успешно создана")
            setNewZoneName("")
            setNewZoneResponsible(null)
            setIsCreating(false)
            onZonesChange()
        } catch (error) {
            console.error(error)
            alert(error instanceof Error ? error.message : "Ошибка при создании зоны")
        } finally {
            setIsLoading(false)
        }
    }

    const handleUpdate = async (zoneId: string) => {
        if (!editName.trim()) return

        setIsLoading(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/zones/${zoneId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: editName,
                    assigned_user_id: editResponsible === "none" ? null : editResponsible
                })
            })

            if (!res.ok) throw new Error("Failed to update zone")

            // toast.success("Зона успешно обновлена")
            setEditingZoneId(null)
            onZonesChange()
        } catch (error) {
            console.error(error)
            alert("Ошибка при обновлении зоны")
        } finally {
            setIsLoading(false)
        }
    }

    const handleDelete = async (zoneId: string) => {
        if (!confirm("Вы уверены, что хотите удалить эту зону?")) return

        setIsLoading(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/zones/${zoneId}`, {
                method: "DELETE"
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || "Failed to delete zone")
            }

            // toast.success("Зона успешно удалена")
            onZonesChange()
        } catch (error) {
            console.error(error)
            alert(error instanceof Error ? error.message : "Ошибка при удалении зоны")
        } finally {
            setIsLoading(false)
        }
    }

    const startEditing = (zone: Zone) => {
        setEditingZoneId(zone.id)
        setEditName(zone.name)
        setEditResponsible(zone.assigned_user_id)
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {trigger || <Button variant="outline"><MapPin className="mr-2 h-4 w-4" /> Управление зонами</Button>}
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Управление зонами</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="flex justify-end">
                        <Button onClick={() => setIsCreating(true)} disabled={isCreating} size="sm">
                            <Plus className="mr-2 h-4 w-4" /> Добавить зону
                        </Button>
                    </div>

                    {isCreating && (
                        <div className="flex items-center gap-2 p-2 border rounded-md bg-slate-50">
                            <Input
                                value={newZoneName}
                                onChange={(e) => setNewZoneName(e.target.value)}
                                placeholder="Название зоны"
                                className="flex-1"
                            />
                            <Select
                                value={newZoneResponsible || "none"}
                                onValueChange={(val) => setNewZoneResponsible(val === "none" ? null : val)}
                            >
                                <SelectTrigger className="w-[200px]">
                                    <SelectValue placeholder="Ответственный" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">⛔ Не требует обслуживания</SelectItem>
                                    {employees.map(emp => (
                                        <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button size="sm" onClick={handleCreate} disabled={isLoading || !newZoneName.trim()}>
                                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setIsCreating(false)}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    )}

                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Название</TableHead>
                                <TableHead>Ответственный</TableHead>
                                <TableHead className="text-right">Рабочих мест</TableHead>
                                <TableHead className="w-[100px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {zones.map((zone) => (
                                <TableRow key={zone.id}>
                                    <TableCell>
                                        {editingZoneId === zone.id ? (
                                            <Input
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                            />
                                        ) : (
                                            <span className="font-medium">{zone.name}</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {editingZoneId === zone.id ? (
                                            <Select
                                                value={editResponsible || "none"}
                                                onValueChange={(val) => setEditResponsible(val === "none" ? null : val)}
                                            >
                                                <SelectTrigger className="w-[200px]">
                                                    <SelectValue placeholder="Ответственный" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                <SelectItem value="none">⛔ Не требует обслуживания</SelectItem>
                                                {employees.map(emp => (
                                                    <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                            </Select>
                                        ) : (
                                            <span className="text-sm text-muted-foreground">
                                                {zone.assigned_user_name || "Не назначено"}
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {zone.workstation_count}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center justify-end gap-2">
                                            {editingZoneId === zone.id ? (
                                                <>
                                                    <Button size="icon" variant="ghost" onClick={() => handleUpdate(zone.id)} disabled={isLoading}>
                                                        <Save className="h-4 w-4 text-green-600" />
                                                    </Button>
                                                    <Button size="icon" variant="ghost" onClick={() => setEditingZoneId(null)}>
                                                        <X className="h-4 w-4 text-slate-400" />
                                                    </Button>
                                                </>
                                            ) : (
                                                <>
                                                    <Button size="icon" variant="ghost" onClick={() => startEditing(zone)}>
                                                        <Pencil className="h-4 w-4 text-slate-400 hover:text-blue-600" />
                                                    </Button>
                                                    <Button 
                                                        size="icon" 
                                                        variant="ghost" 
                                                        onClick={() => handleDelete(zone.id)}
                                                        disabled={zone.workstation_count > 0}
                                                        title={zone.workstation_count > 0 ? "Нельзя удалить зону с рабочими местами" : "Удалить зону"}
                                                    >
                                                        <Trash2 className={`h-4 w-4 ${zone.workstation_count > 0 ? "text-slate-200" : "text-slate-400 hover:text-red-600"}`} />
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {zones.length === 0 && !isCreating && (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                                        Зон пока нет. Создайте первую зону!
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </DialogContent>
        </Dialog>
    )
}
