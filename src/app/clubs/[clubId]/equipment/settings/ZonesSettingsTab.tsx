"use client"

import { useCallback, useEffect, useState } from "react"
import { ChevronDown, ChevronUp, Loader2, MapPin, Pencil, Plus, Save, Trash2, User, X } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Zone {
    id: string
    name: string
    display_order?: number
    assigned_user_id: string | null
    assigned_user_name: string | null
    workstation_count: number
}

interface Employee {
    id: string
    full_name: string
}

interface ZonesSettingsTabProps {
    clubId: string
}

export function ZonesSettingsTab({ clubId }: ZonesSettingsTabProps) {
    const [zones, setZones] = useState<Zone[]>([])
    const [employees, setEmployees] = useState<Employee[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [isCreating, setIsCreating] = useState(false)
    const [newZoneName, setNewZoneName] = useState("")
    const [newZoneResponsible, setNewZoneResponsible] = useState<string | null>(null)
    const [editingZoneId, setEditingZoneId] = useState<string | null>(null)
    const [editName, setEditName] = useState("")
    const [editResponsible, setEditResponsible] = useState<string | null>(null)

    const fetchData = useCallback(async () => {
        setIsLoading(true)
        try {
            const [zonesRes, employeesRes] = await Promise.all([
                fetch(`/api/clubs/${clubId}/zones`, { cache: "no-store" }),
                fetch(`/api/clubs/${clubId}/employees`, { cache: "no-store" })
            ])

            const [zonesData, employeesData] = await Promise.all([
                zonesRes.json(),
                employeesRes.json()
            ])

            if (zonesRes.ok) {
                setZones(Array.isArray(zonesData) ? zonesData : [])
            }

            if (employeesRes.ok) {
                setEmployees(employeesData.employees || [])
            }
        } catch (error) {
            console.error("Error loading zones settings:", error)
        } finally {
            setIsLoading(false)
        }
    }, [clubId])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const resetCreateState = () => {
        setIsCreating(false)
        setNewZoneName("")
        setNewZoneResponsible(null)
    }

    const handleCreate = async () => {
        if (!newZoneName.trim()) return

        setIsSaving(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/zones`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: newZoneName.trim(),
                    assigned_user_id: newZoneResponsible === "none" ? null : newZoneResponsible
                })
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || "Не удалось создать зону")
            }

            resetCreateState()
            fetchData()
        } catch (error) {
            console.error(error)
            alert(error instanceof Error ? error.message : "Ошибка при создании зоны")
        } finally {
            setIsSaving(false)
        }
    }

    const handleUpdate = async (zoneId: string) => {
        if (!editName.trim()) return

        setIsSaving(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/zones/${zoneId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: editName.trim(),
                    assigned_user_id: editResponsible === "none" ? null : editResponsible
                })
            })

            if (!res.ok) {
                const data = await res.json().catch(() => null)
                throw new Error(data?.error || "Не удалось обновить зону")
            }

            setEditingZoneId(null)
            fetchData()
        } catch (error) {
            console.error(error)
            alert(error instanceof Error ? error.message : "Ошибка при обновлении зоны")
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async (zoneId: string) => {
        if (!confirm("Удалить зону?")) return

        setIsSaving(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/zones/${zoneId}`, {
                method: "DELETE"
            })

            if (!res.ok) {
                const data = await res.json().catch(() => null)
                throw new Error(data?.error || "Не удалось удалить зону")
            }

            fetchData()
        } catch (error) {
            console.error(error)
            alert(error instanceof Error ? error.message : "Ошибка при удалении зоны")
        } finally {
            setIsSaving(false)
        }
    }

    const startEditing = (zone: Zone) => {
        setEditingZoneId(zone.id)
        setEditName(zone.name)
        setEditResponsible(zone.assigned_user_id)
    }

    const moveZone = async (zoneId: string, direction: "UP" | "DOWN") => {
        setIsSaving(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/zones/${zoneId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ move: direction })
            })
            if (!res.ok) {
                const data = await res.json().catch(() => null)
                throw new Error(data?.error || "Не удалось изменить порядок")
            }
            fetchData()
        } catch (error) {
            console.error(error)
            alert(error instanceof Error ? error.message : "Ошибка при изменении порядка")
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <Card className="shadow-sm">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <CardTitle>Зоны клуба</CardTitle>
                    <CardDescription>
                        Здесь настраивается справочник зон. На странице рабочих мест зоны только используются для обзора и группировки.
                    </CardDescription>
                </div>
                <Button onClick={() => setIsCreating(true)} disabled={isCreating || isSaving} className="sm:self-start">
                    <Plus className="mr-2 h-4 w-4" />
                    Добавить зону
                </Button>
            </CardHeader>

            <CardContent className="space-y-4">
                {isCreating && (
                    <div className="rounded-xl border bg-muted p-4">
                        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
                            <Input
                                value={newZoneName}
                                onChange={(e) => setNewZoneName(e.target.value)}
                                placeholder="Название зоны"
                            />
                            <Select
                                value={newZoneResponsible || "none"}
                                onValueChange={(val) => setNewZoneResponsible(val === "none" ? null : val)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Ответственный" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Не назначено</SelectItem>
                                    {employees.map(emp => (
                                        <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <div className="flex gap-2">
                                <Button onClick={handleCreate} disabled={isSaving || !newZoneName.trim()}>
                                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                </Button>
                                <Button variant="ghost" onClick={resetCreateState}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="overflow-x-auto rounded-xl border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Зона</TableHead>
                                <TableHead>Ответственный</TableHead>
                                <TableHead className="text-right">Мест</TableHead>
                                <TableHead className="w-[120px]" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                                        <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                                    </TableCell>
                                </TableRow>
                            ) : zones.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                                        Зон пока нет. Создайте первую зону для схемы клуба.
                                    </TableCell>
                                </TableRow>
                            ) : zones.map((zone, idx) => (
                                <TableRow key={zone.id}>
                                    <TableCell>
                                        {editingZoneId === zone.id ? (
                                            <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <MapPin className="h-4 w-4 text-muted-foreground/70" />
                                                <span className="font-medium">{zone.name}</span>
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {editingZoneId === zone.id ? (
                                            <Select
                                                value={editResponsible || "none"}
                                                onValueChange={(val) => setEditResponsible(val === "none" ? null : val)}
                                            >
                                                <SelectTrigger className="w-[220px]">
                                                    <SelectValue placeholder="Ответственный" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">Не назначено</SelectItem>
                                                    {employees.map(emp => (
                                                        <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <User className="h-4 w-4" />
                                                <span>{zone.assigned_user_name || "Не назначено"}</span>
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                        {zone.workstation_count}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center justify-end gap-2">
                                            {editingZoneId === zone.id ? (
                                                <>
                                                    <Button size="icon" variant="ghost" onClick={() => handleUpdate(zone.id)} disabled={isSaving}>
                                                        <Save className="h-4 w-4 text-green-600" />
                                                    </Button>
                                                    <Button size="icon" variant="ghost" onClick={() => setEditingZoneId(null)}>
                                                        <X className="h-4 w-4 text-muted-foreground/70" />
                                                    </Button>
                                                </>
                                            ) : (
                                                <>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        onClick={() => moveZone(zone.id, "UP")}
                                                        disabled={isSaving || idx === 0}
                                                    >
                                                        <ChevronUp className="h-4 w-4 text-muted-foreground/70 hover:text-slate-900" />
                                                    </Button>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        onClick={() => moveZone(zone.id, "DOWN")}
                                                        disabled={isSaving || idx === zones.length - 1}
                                                    >
                                                        <ChevronDown className="h-4 w-4 text-muted-foreground/70 hover:text-slate-900" />
                                                    </Button>
                                                    <Button size="icon" variant="ghost" onClick={() => startEditing(zone)}>
                                                        <Pencil className="h-4 w-4 text-muted-foreground/70 hover:text-blue-600" />
                                                    </Button>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        onClick={() => handleDelete(zone.id)}
                                                        disabled={zone.workstation_count > 0}
                                                        title={zone.workstation_count > 0 ? "Сначала уберите места из зоны" : "Удалить зону"}
                                                    >
                                                        <Trash2 className={`h-4 w-4 ${zone.workstation_count > 0 ? "text-slate-200" : "text-muted-foreground/70 hover:text-red-600"}`} />
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    )
}
