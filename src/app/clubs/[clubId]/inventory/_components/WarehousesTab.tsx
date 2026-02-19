"use client"

import { useState, useTransition } from "react"
import { Plus, Pencil, Trash2, Warehouse as WarehouseIcon, MapPin, User, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { createWarehouse, updateWarehouse, Warehouse } from "../actions"
import { useParams } from "next/navigation"

interface WarehousesTabProps {
    warehouses: Warehouse[]
    employees: { id: string, full_name: string, role: string }[]
    currentUserId: string
}

export function WarehousesTab({ warehouses, employees, currentUserId }: WarehousesTabProps) {
    const params = useParams()
    const clubId = params.clubId as string
    
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingWarehouse, setEditingWarehouse] = useState<Partial<Warehouse> | null>(null)
    const [characteristics, setCharacteristics] = useState<{ area?: string, temperature?: string, access_hours?: string }>({})
    const [isPending, startTransition] = useTransition()

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editingWarehouse?.name) return

        startTransition(async () => {
            try {
                const payload = {
                    name: editingWarehouse.name,
                    address: editingWarehouse.address,
                    type: editingWarehouse.type || 'GENERAL',
                    responsible_user_id: editingWarehouse.responsible_user_id,
                    contact_info: editingWarehouse.contact_info,
                    characteristics: characteristics,
                    is_active: editingWarehouse.is_active ?? true
                }

                if (editingWarehouse.id) {
                    await updateWarehouse(editingWarehouse.id, clubId, currentUserId, payload)
                } else {
                    await createWarehouse(clubId, currentUserId, payload)
                }
                setIsDialogOpen(false)
                setEditingWarehouse(null)
                setCharacteristics({})
            } catch (err: any) {
                console.error(err)
                alert("Ошибка при сохранении")
            }
        })
    }

    const openCreate = () => {
        setEditingWarehouse({ name: '', type: 'GENERAL', is_active: true })
        setCharacteristics({})
        setIsDialogOpen(true)
    }

    const openEdit = (wh: Warehouse) => {
        setEditingWarehouse(wh)
        setCharacteristics(wh.characteristics || {})
        setIsDialogOpen(true)
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-white p-4 rounded-lg border shadow-sm">
                <h3 className="font-medium flex items-center gap-2">
                    <WarehouseIcon className="h-4 w-4" />
                    Складские помещения
                </h3>
                <Button onClick={openCreate}>
                    <Plus className="mr-2 h-4 w-4" />
                    Добавить склад
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {warehouses.map(wh => (
                    <div key={wh.id} className="bg-white border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                                    <WarehouseIcon className="h-5 w-5" />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-lg">{wh.name}</h4>
                                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal">
                                        {wh.type}
                                    </Badge>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-700" onClick={() => openEdit(wh)}>
                                <Pencil className="h-4 w-4" />
                            </Button>
                        </div>
                        
                        <div className="space-y-3 text-sm text-slate-600">
                            {wh.address && (
                                <div className="flex items-start gap-2">
                                    <MapPin className="h-4 w-4 mt-0.5 text-slate-400" />
                                    <span>{wh.address}</span>
                                </div>
                            )}
                            {wh.responsible_name && (
                                <div className="flex items-center gap-2">
                                    <User className="h-4 w-4 text-slate-400" />
                                    <span>Отв: {wh.responsible_name}</span>
                                </div>
                            )}
                            {wh.characteristics && Object.keys(wh.characteristics).length > 0 && (
                                <div className="bg-slate-50 p-3 rounded-lg mt-2 text-xs space-y-1">
                                    {wh.characteristics.area && <p>Площадь: <b>{wh.characteristics.area} м²</b></p>}
                                    {wh.characteristics.temperature && <p>Температура: <b>{wh.characteristics.temperature}</b></p>}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                
                {warehouses.length === 0 && (
                    <div className="col-span-full py-12 text-center text-muted-foreground bg-slate-50 rounded-xl border border-dashed">
                        <WarehouseIcon className="h-12 w-12 mx-auto mb-3 opacity-20" />
                        <p>Складов пока нет. Создайте первый склад.</p>
                    </div>
                )}
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editingWarehouse?.id ? 'Редактирование склада' : 'Новый склад'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSave} className="grid grid-cols-2 gap-4 py-4">
                        <div className="col-span-2 space-y-2">
                            <Label>Название склада <span className="text-red-500">*</span></Label>
                            <Input 
                                value={editingWarehouse?.name || ''} 
                                onChange={e => setEditingWarehouse(prev => ({ ...prev!, name: e.target.value }))}
                                required
                                placeholder="Главный склад, Кухня..."
                            />
                        </div>
                        
                        <div className="space-y-2">
                            <Label>Тип помещения</Label>
                            <Select 
                                value={editingWarehouse?.type || "GENERAL"} 
                                onValueChange={v => setEditingWarehouse(prev => ({ ...prev!, type: v }))}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="GENERAL">Общий склад</SelectItem>
                                    <SelectItem value="COLD_STORAGE">Холодильник / Морозильник</SelectItem>
                                    <SelectItem value="KITCHEN">Кухня / Производство</SelectItem>
                                    <SelectItem value="BAR">Бар</SelectItem>
                                    <SelectItem value="RETAIL">Торговый зал</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Ответственное лицо</Label>
                            <Select 
                                value={editingWarehouse?.responsible_user_id || "none"} 
                                onValueChange={v => setEditingWarehouse(prev => ({ ...prev!, responsible_user_id: v === "none" ? undefined : v }))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Не назначено" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Не назначено</SelectItem>
                                    {employees.map(emp => (
                                        <SelectItem key={emp.id} value={emp.id}>{emp.full_name} ({emp.role})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="col-span-2 space-y-2">
                            <Label>Адрес / Локация</Label>
                            <Input 
                                value={editingWarehouse?.address || ''} 
                                onChange={e => setEditingWarehouse(prev => ({ ...prev!, address: e.target.value }))}
                                placeholder="Этаж 1, комната 102"
                            />
                        </div>

                        <div className="col-span-2">
                            <div className="bg-slate-50 p-4 rounded-lg border space-y-4">
                                <h4 className="text-sm font-medium flex items-center gap-2">
                                    <Info className="h-4 w-4" /> Характеристики
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs">Площадь (м²)</Label>
                                        <Input 
                                            value={characteristics.area || ''} 
                                            onChange={e => setCharacteristics(prev => ({ ...prev, area: e.target.value }))}
                                            className="bg-white h-8"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs">Температурный режим</Label>
                                        <Input 
                                            value={characteristics.temperature || ''} 
                                            onChange={e => setCharacteristics(prev => ({ ...prev, temperature: e.target.value }))}
                                            className="bg-white h-8"
                                            placeholder="+18...+22°C"
                                        />
                                    </div>
                                    <div className="col-span-2 space-y-2">
                                        <Label className="text-xs">Часы доступа / Режим работы</Label>
                                        <Input 
                                            value={characteristics.access_hours || ''} 
                                            onChange={e => setCharacteristics(prev => ({ ...prev, access_hours: e.target.value }))}
                                            className="bg-white h-8"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="col-span-2 space-y-2">
                            <Label>Контактная информация</Label>
                            <Textarea 
                                value={editingWarehouse?.contact_info || ''} 
                                onChange={e => setEditingWarehouse(prev => ({ ...prev!, contact_info: e.target.value }))}
                                placeholder="Телефоны, заметки..."
                                className="h-20"
                            />
                        </div>

                        <DialogFooter className="col-span-2">
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Отмена</Button>
                            <Button type="submit" disabled={isPending}>Сохранить</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
