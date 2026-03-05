"use client"

import { useState, useTransition } from "react"
import { Plus, Pencil, Trash2, Warehouse as WarehouseIcon, MapPin, User, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { createWarehouse, updateWarehouse, deleteWarehouse, Warehouse } from "../actions"
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
    const [isPending, startTransition] = useTransition()

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editingWarehouse) return
        const name = editingWarehouse.name?.trim() || ''
        if (!name) return

        startTransition(async () => {
            try {
                if (editingWarehouse.id) {
                    const payload = {
                        name,
                        address: editingWarehouse.address || undefined,
                        type: editingWarehouse.type || 'GENERAL',
                        contact_info: editingWarehouse.contact_info || undefined,
                        characteristics: editingWarehouse.characteristics || undefined,
                        is_active: editingWarehouse.is_active ?? true
                    }
                    await updateWarehouse(editingWarehouse.id, clubId, currentUserId, payload)
                } else {
                    const payload = {
                        name,
                        address: editingWarehouse.address || undefined,
                        type: editingWarehouse.type || 'GENERAL',
                        contact_info: editingWarehouse.contact_info || undefined,
                        characteristics: editingWarehouse.characteristics || undefined
                    }
                    await createWarehouse(clubId, currentUserId, payload)
                }
                setIsDialogOpen(false)
                setEditingWarehouse(null)
            } catch (err: any) {
                console.error(err)
                alert("Ошибка при сохранении")
            }
        })
    }

    const handleDelete = async (id: number) => {
        if (!confirm('Вы уверены, что хотите удалить этот склад? Это действие нельзя отменить.')) return

        startTransition(async () => {
            try {
                await deleteWarehouse(id, clubId, currentUserId)
                alert('Склад удален')
            } catch (err: any) {
                console.error(err)
                alert(err.message || "Ошибка при удалении")
            }
        })
    }

    const openCreate = () => {
        setEditingWarehouse({ name: '', is_active: true })
        setIsDialogOpen(true)
    }

    const openEdit = (wh: Warehouse) => {
        setEditingWarehouse(wh)
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
                    <div key={wh.id} className="bg-white border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow group">
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                                    <WarehouseIcon className="h-5 w-5" />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-lg">{wh.name}</h4>
                                    {wh.is_default && <Badge variant="secondary" className="text-[10px] py-0 px-1 bg-blue-100 text-blue-700 border-none">Основной</Badge>}
                                </div>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-700" onClick={() => openEdit(wh)}>
                                    <Pencil className="h-4 w-4" />
                                </Button>
                                {!wh.is_default && (
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => handleDelete(wh.id)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </div>
                        
                        <div className="space-y-3 text-sm text-slate-600">
                            <div className="flex items-center gap-2">
                                <Info className="h-4 w-4 text-slate-400" />
                                <span>Тип: {wh.type === 'GENERAL' ? 'Общий' : wh.type}</span>
                            </div>
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
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editingWarehouse?.id ? 'Редактирование склада' : 'Новый склад'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSave} className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Название склада <span className="text-red-500">*</span></Label>
                            <Input 
                                value={editingWarehouse?.name || ''} 
                                onChange={e => setEditingWarehouse(prev => ({ ...prev!, name: e.target.value }))}
                                required
                                placeholder="Например: Бар"
                            />
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Отмена</Button>
                            <Button type="submit" disabled={isPending}>Сохранить</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
