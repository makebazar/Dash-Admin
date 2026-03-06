"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Calendar, User, ShoppingCart, Clock, ChevronDown, ChevronRight, Link, Unlink, Trash2, Check, X, Pencil, Save, Plus, AlertCircle, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { useState, useMemo, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { assignShiftToMovement, deleteStockMovement, massAssignShiftToMovements, correctStockMovement, createManualSale, Warehouse, Product } from "../actions"
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface SalesTabProps {
    sales: any[]
    shifts: any[]
    clubId: string
    warehouses: Warehouse[]
    products: Product[]
    currentUserId: string
}

export function SalesTab({ sales, shifts, clubId, warehouses, products, currentUserId }: SalesTabProps) {
    const [expandedShifts, setExpandedShifts] = useState<Record<string, boolean>>({})
    const [isPending, startTransition] = useTransition()
    const [selectedIds, setSelectedIds] = useState<number[]>([])
    
    // Редактирование
    const [editingId, setEditingId] = useState<number | null>(null)
    const [editValue, setEditValue] = useState<string>("")
    const [editReason, setEditReason] = useState<string>("")

    // Удаление с выбором
    const [deleteConfig, setDeleteId] = useState<{ id: number, productName: string } | null>(null)
    const [revertMode, setRevertMode] = useState<'none' | 'revert'>('none')
    const [selectedRevertWarehouse, setSelectedRevertWarehouse] = useState<string>("")

    // Ручное добавление
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [newSale, setNewSale] = useState({
        product_id: "",
        quantity: "1",
        warehouse_id: warehouses.find(w => w.is_default)?.id.toString() || (warehouses[0]?.id.toString() || ""),
        shift_id: "none",
        notes: ""
    })

    const handleStartEdit = (sale: any) => {
        setEditingId(sale.id)
        setEditValue(Math.abs(sale.change_amount).toString())
        setEditReason(sale.reason || "")
    }

    const handleSaveEdit = async (id: number) => {
        const val = parseInt(editValue)
        if (isNaN(val)) return
        
        startTransition(async () => {
            const res = await correctStockMovement(id, val, editReason)
            if (res.success) {
                setEditingId(null)
            } else {
                alert("Ошибка при сохранении: " + res.error)
            }
        })
    }

    const handleDeleteConfirm = async () => {
        if (!deleteConfig) return
        
        startTransition(async () => {
            try {
                await deleteStockMovement(deleteConfig.id, clubId, {
                    revertToWarehouseId: revertMode === 'revert' ? Number(selectedRevertWarehouse) : undefined
                })
                setDeleteId(null)
                setRevertMode('none')
            } catch (e) {
                alert("Ошибка при удалении")
            }
        })
    }

    const handleCreateManualSale = async () => {
        if (!newSale.product_id || !newSale.quantity || !newSale.warehouse_id) return
        
        startTransition(async () => {
            try {
                await createManualSale(clubId, currentUserId, {
                    product_id: Number(newSale.product_id),
                    quantity: Number(newSale.quantity),
                    warehouse_id: Number(newSale.warehouse_id),
                    shift_id: newSale.shift_id === "none" ? undefined : newSale.shift_id,
                    notes: newSale.notes
                })
                setIsAddDialogOpen(false)
                setNewSale({
                    product_id: "",
                    quantity: "1",
                    warehouse_id: warehouses.find(w => w.is_default)?.id.toString() || (warehouses[0]?.id.toString() || ""),
                    shift_id: "none",
                    notes: ""
                })
            } catch (e: any) {
                alert("Ошибка: " + e.message)
            }
        })
    }

    // Group sales by shift
    const groupedSales = useMemo(() => {
        const groups: Record<string, { shift: any, items: any[], totalAmount: number, totalRevenue: number }> = {
            'unassigned': { shift: null, items: [], totalAmount: 0, totalRevenue: 0 }
        }

        sales.forEach(sale => {
            const shiftId = sale.shift_id_raw
            const amount = Math.abs(sale.change_amount)
            const isSalaryDeduction = sale.reason?.toLowerCase().includes('в счет зп')
            const price = Number(sale.price_at_time || sale.current_price || 0)
            
            // Расчет выручки (пропускаем если в счет ЗП)
            const itemRevenue = isSalaryDeduction ? 0 : (amount * price)
            
            if (!shiftId) {
                groups['unassigned'].items.push(sale)
                groups['unassigned'].totalAmount += amount
                groups['unassigned'].totalRevenue += itemRevenue
            } else {
                if (!groups[shiftId]) {
                    groups[shiftId] = {
                        shift: {
                            id: shiftId,
                            start: sale.shift_start,
                            end: sale.shift_end,
                            employee: sale.shift_employee_name || sale.user_name,
                            reported: Number(sale.shift_reported_revenue || 0),
                            calculated: Number(sale.shift_calculated_revenue || 0),
                            difference: Number(sale.shift_revenue_difference || 0)
                        },
                        items: [],
                        totalAmount: 0,
                        totalRevenue: 0
                    }
                }
                groups[shiftId].items.push(sale)
                groups[shiftId].totalAmount += amount
                groups[shiftId].totalRevenue += itemRevenue
            }
        })

        return groups
    }, [sales])

    const sortedGroups = useMemo(() => {
        return Object.entries(groupedSales)
            .sort((a, b) => {
                if (a[0] === 'unassigned') return -1
                if (b[0] === 'unassigned') return 1
                return new Date(b[1].shift.start).getTime() - new Date(a[1].shift.start).getTime()
            })
    }, [groupedSales])

    const toggleShift = (id: string) => {
        setExpandedShifts(prev => ({ ...prev, [id]: !prev[id] }))
    }

    const handleDelete = async (id: number, name: string) => {
        setDeleteId({ id, productName: name })
        setRevertMode('none')
        const defaultWh = warehouses.find(w => w.is_default) || warehouses[0]
        if (defaultWh) setSelectedRevertWarehouse(defaultWh.id.toString())
    }

    const handleAssignShift = async (movementId: number, shiftId: number | null) => {
        startTransition(async () => {
            try {
                await assignShiftToMovement(movementId, shiftId, clubId)
            } catch (e) {
                alert("Ошибка при привязке")
            }
        })
    }

    const handleMassAssign = async (shiftId: number | null) => {
        if (selectedIds.length === 0) return
        startTransition(async () => {
            try {
                await massAssignShiftToMovements(selectedIds, shiftId, clubId)
                setSelectedIds([])
            } catch (e) {
                alert("Ошибка при массовой привязке")
            }
        })
    }

    const toggleSelect = (id: number) => {
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        )
    }

    if (sales.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 border rounded-lg bg-white text-muted-foreground shadow-sm">
                <ShoppingCart className="h-12 w-12 mb-4 text-slate-200" />
                <p className="text-lg font-medium">Продаж пока нет</p>
                <p className="text-sm">Они появятся после закрытия инвентаризаций.</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl border shadow-sm">
                <div className="flex flex-col">
                    <h3 className="font-bold text-slate-900">Управление продажами</h3>
                    <p className="text-xs text-slate-500">Ручное добавление и корректировка истории</p>
                </div>
                <Button onClick={() => setIsAddDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="h-4 w-4 mr-2" /> Добавить продажу
                </Button>
            </div>

            {/* Mass Actions Bar */}
            {selectedIds.length > 0 && (
                <div className="bg-slate-900 text-white p-3 rounded-xl flex items-center justify-between shadow-lg sticky top-0 z-10 animate-in fade-in slide-in-from-top-4">
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                            {selectedIds.length} выбрано
                        </div>
                        <span className="text-sm font-medium">Привязать к смене:</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="secondary" className="h-9 gap-2">
                                    <Link className="h-3.5 w-3.5" /> Выбрать смену
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-72 max-h-[400px] overflow-y-auto p-1">
                                <DropdownMenuItem onClick={() => handleMassAssign(null)} className="flex items-center gap-2 text-red-600 focus:text-red-700 focus:bg-red-50">
                                    <Unlink className="h-4 w-4" /> 
                                    <span>Отвязать от всех смен</span>
                                </DropdownMenuItem>
                                <div className="h-px bg-slate-100 my-1" />
                                {shifts.map(s => (
                                    <DropdownMenuItem key={s.id} onClick={() => handleMassAssign(s.id)} className="flex flex-col items-start gap-1 py-2">
                                        <div className="flex justify-between w-full">
                                            <span className="font-bold text-xs">{s.employee_name}</span>
                                            <span className="text-[10px] text-slate-400">#{s.id}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                            <Calendar className="h-3 w-3" />
                                            <span>{new Date(s.check_in).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])} className="h-9 text-slate-400 hover:text-white">Отмена</Button>
                    </div>
                </div>
            )}

            <div className="space-y-3">
                {sortedGroups.map(([groupId, group]) => {
                    const isUnassigned = groupId === 'unassigned'
                    const isExpanded = expandedShifts[groupId] || false
                    const items = group.items

                    if (items.length === 0 && isUnassigned) return null

                    return (
                        <div key={groupId} className={cn(
                            "border rounded-xl overflow-hidden transition-all",
                            isUnassigned ? "border-amber-200 bg-amber-50/20" : "border-slate-200 bg-white",
                            isExpanded ? "shadow-md" : "hover:border-slate-300 shadow-sm"
                        )}>
                            {/* Shift Header */}
                            <div 
                                className={cn(
                                    "px-4 py-4 flex items-center justify-between cursor-pointer select-none",
                                    isExpanded ? "border-b bg-slate-50/50" : ""
                                )}
                                onClick={() => toggleShift(groupId)}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={cn(
                                        "p-2 rounded-xl transition-all",
                                        isUnassigned ? "bg-amber-100 text-amber-600" : "bg-blue-50 text-blue-600",
                                        isExpanded ? "rotate-90" : ""
                                    )}>
                                        <ChevronRight className="h-5 w-5" />
                                    </div>
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            {isUnassigned ? (
                                                <span className="text-sm font-bold text-amber-700">Продажи без привязки</span>
                                            ) : (
                                                <span className="text-sm font-bold text-slate-900">{group.shift.employee}</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 text-[10px] text-slate-500 mt-1">
                                            {!isUnassigned && (
                                                <div className="flex items-center gap-1">
                                                    <Calendar className="h-3.5 w-3.5 opacity-60" />
                                                    <span className="font-medium">
                                                        {new Date(group.shift.start).toLocaleDateString('ru-RU')} {new Date(group.shift.start).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            )}
                                            <div className="flex items-center gap-1">
                                                <ShoppingCart className="h-3.5 w-3.5 opacity-60" />
                                                <span className="font-medium">{items.length} поз.</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-6">
                                        <div className="flex gap-4 border-r pr-6 border-slate-100">
                                            {isUnassigned ? (
                                                <div className="text-right">
                                                    <div className="text-[9px] text-amber-600 uppercase font-bold tracking-wider leading-none mb-1">Сумма</div>
                                                    <div className="text-sm font-bold text-amber-600 leading-none">{group.totalRevenue.toLocaleString()} ₽</div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="text-right">
                                                        <div className="text-[9px] text-slate-400 uppercase font-bold tracking-wider leading-none mb-1">По складу</div>
                                                        <div className="text-sm font-bold text-blue-600 leading-none">{group.totalRevenue.toLocaleString()} ₽</div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-[9px] text-slate-400 uppercase font-bold tracking-wider leading-none mb-1">По кассе</div>
                                                        <div className="text-sm font-bold text-slate-700 leading-none">{group.shift.reported.toLocaleString()} ₽</div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-[9px] text-slate-400 uppercase font-bold tracking-wider leading-none mb-1">Разница</div>
                                                        <div className={cn(
                                                            "text-sm font-black leading-none",
                                                            (group.shift.reported - group.totalRevenue) === 0 ? "text-green-500" : 
                                                            (group.shift.reported - group.totalRevenue) > 0 ? "text-amber-500" : "text-red-500"
                                                        )}>
                                                            {(group.shift.reported - group.totalRevenue) > 0 ? "+" : ""}{(group.shift.reported - group.totalRevenue).toLocaleString()} ₽
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                    {isUnassigned && items.length > 0 && (
                                        <Badge variant="destructive" className="bg-amber-500 text-white border-none text-[10px] px-2 py-0.5 animate-pulse">
                                            Требует привязки
                                        </Badge>
                                    )}
                                    <div className="text-right min-w-[60px]">
                                        <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider leading-none mb-1">Кол-во</div>
                                        <div className="text-lg font-black text-slate-700 leading-none">{group.totalAmount}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Shift Items */}
                            {isExpanded && (
                                <div className="divide-y">
                                    <Table>
                                        <TableHeader className="bg-slate-50/50">
                                            <TableRow className="hover:bg-transparent h-10">
                                                <TableHead className="w-10 text-center"></TableHead>
                                                <TableHead className="text-[10px] uppercase font-bold text-slate-400">Товар</TableHead>
                                                <TableHead className="text-right text-[10px] uppercase font-bold text-slate-400">Цена</TableHead>
                                                <TableHead className="text-right text-[10px] uppercase font-bold text-slate-400">Кол-во</TableHead>
                                                <TableHead className="text-right text-[10px] uppercase font-bold text-slate-400">Итого</TableHead>
                                                <TableHead className="text-right text-[10px] uppercase font-bold text-slate-400">Время</TableHead>
                                                <TableHead className="text-right text-[10px] uppercase font-bold text-slate-400">Действия</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {items.map((sale) => (
                                                <TableRow key={sale.id} className="hover:bg-slate-50/50 group h-12">
                                                    <TableCell className="text-center p-0">
                                                        <Checkbox 
                                                            checked={selectedIds.includes(sale.id)}
                                                            onCheckedChange={() => toggleSelect(sale.id)}
                                                            className="h-4 w-4"
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="py-2">
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm font-semibold text-slate-800">{sale.product_name}</span>
                                                                {sale.shift_employee_name && sale.user_name !== sale.shift_employee_name && (
                                                                    <Badge variant="outline" className="text-[9px] h-4 px-1 border-slate-200 text-slate-400 font-normal">
                                                                        от {sale.user_name.split(' ')[0]}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            {editingId === sale.id ? (
                                                                <Input 
                                                                    value={editReason} 
                                                                    onChange={e => setEditReason(e.target.value)}
                                                                    className="h-6 text-[10px] mt-1"
                                                                    placeholder="Причина корректировки..."
                                                                />
                                                            ) : (
                                                                <span className="text-[10px] text-slate-400 truncate max-w-[200px] italic">{sale.reason}</span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right py-2">
                                                        <span className="text-xs font-medium text-slate-600">
                                                            {Number(sale.price_at_time || sale.current_price || 0).toLocaleString()} ₽
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-right py-2">
                                                        {editingId === sale.id ? (
                                                            <div className="flex items-center justify-end gap-1">
                                                                <Input 
                                                                    type="number"
                                                                    value={editValue}
                                                                    onChange={e => setEditValue(e.target.value)}
                                                                    className="h-7 w-16 text-right text-xs"
                                                                />
                                                                <span className="text-[10px] text-slate-400">шт</span>
                                                            </div>
                                                        ) : (
                                                            <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-100 font-mono text-xs">
                                                                {Math.abs(sale.change_amount)} шт
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right py-2">
                                                        <span className="text-sm font-bold text-slate-900">
                                                            {(Math.abs(sale.change_amount) * Number(sale.price_at_time || sale.current_price || 0)).toLocaleString()} ₽
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-right py-2">
                                                        <span className="text-[11px] text-slate-500">
                                                            {new Date(sale.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-right py-2">
                                                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            {editingId === sale.id ? (
                                                                <>
                                                                    <Button 
                                                                        size="icon" 
                                                                        variant="ghost" 
                                                                        onClick={() => handleSaveEdit(sale.id)}
                                                                        className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                                                                        disabled={isPending}
                                                                    >
                                                                        <Check className="h-4 w-4" />
                                                                    </Button>
                                                                    <Button 
                                                                        size="icon" 
                                                                        variant="ghost" 
                                                                        onClick={() => setEditingId(null)}
                                                                        className="h-8 w-8 text-slate-400 hover:text-slate-600"
                                                                    >
                                                                        <X className="h-4 w-4" />
                                                                    </Button>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Button 
                                                                        size="icon" 
                                                                        variant="ghost" 
                                                                        onClick={() => handleStartEdit(sale)}
                                                                        className="h-8 w-8 text-slate-400 hover:text-blue-500"
                                                                    >
                                                                        <Pencil className="h-4 w-4" />
                                                                    </Button>
                                                                    <DropdownMenu>
                                                                        <DropdownMenuTrigger asChild>
                                                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-blue-500">
                                                                                <Link className="h-4 w-4" />
                                                                            </Button>
                                                                        </DropdownMenuTrigger>
                                                                        <DropdownMenuContent align="end" className="w-72 max-h-[400px] overflow-y-auto p-1">
                                                                            <DropdownMenuItem onClick={() => handleAssignShift(sale.id, null)} className="flex items-center gap-2 text-red-600 focus:text-red-700 focus:bg-red-50">
                                                                                <Unlink className="h-4 w-4" /> 
                                                                                <span>Отвязать от смены</span>
                                                                            </DropdownMenuItem>
                                                                            <div className="h-px bg-slate-100 my-1" />
                                                                                {shifts.map(s => (
                                                                                <DropdownMenuItem key={s.id} onClick={() => handleAssignShift(sale.id, s.id)} className="flex flex-col items-start gap-1 py-2">
                                                                                    <div className="flex justify-between w-full">
                                                                                        <span className="font-bold text-xs">{s.employee_name}</span>
                                                                                        <span className="text-[10px] text-slate-400">#{s.id}</span>
                                                                                    </div>
                                                                                    <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                                                                        <Calendar className="h-3 w-3" />
                                                                                        <span>{new Date(s.check_in).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                                                                    </div>
                                                                                </DropdownMenuItem>
                                                                            ))}
                                                                        </DropdownMenuContent>
                                                                    </DropdownMenu>
                                                                    <Button 
                                                                        size="icon" 
                                                                        variant="ghost" 
                                                                        onClick={() => handleDelete(sale.id, sale.product_name)}
                                                                        className="h-8 w-8 text-slate-400 hover:text-red-500"
                                                                    >
                                                                        <Trash2 className="h-4 w-4" />
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
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Manual Sale Dialog */}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Добавить продажу вручную</DialogTitle>
                        <DialogDescription>
                            Зафиксируйте продажу товара со склада. Это действие уменьшит остаток.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Товар</Label>
                            <Select value={newSale.product_id} onValueChange={v => setNewSale(prev => ({ ...prev, product_id: v }))}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Выберите товар" />
                                </SelectTrigger>
                                <SelectContent className="max-h-[300px]">
                                    {products.map(p => (
                                        <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Количество</Label>
                                <Input 
                                    type="number" 
                                    min="1"
                                    value={newSale.quantity}
                                    onChange={e => setNewSale(prev => ({ ...prev, quantity: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Склад списания</Label>
                                <Select value={newSale.warehouse_id} onValueChange={v => setNewSale(prev => ({ ...prev, warehouse_id: v }))}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Склад" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {warehouses.map(w => (
                                            <SelectItem key={w.id} value={w.id.toString()}>{w.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Привязать к смене (опционально)</Label>
                            <Select value={newSale.shift_id} onValueChange={v => setNewSale(prev => ({ ...prev, shift_id: v }))}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Без привязки" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Без привязки к смене</SelectItem>
                                    {shifts.map(s => (
                                        <SelectItem key={s.id} value={s.id}>
                                            {s.employee_name} ({new Date(s.check_in).toLocaleDateString()})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Комментарий</Label>
                            <Input 
                                placeholder="Например: Ошибка в кассе, ручное списание..."
                                value={newSale.notes}
                                onChange={e => setNewSale(prev => ({ ...prev, notes: e.target.value }))}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Отмена</Button>
                        <Button onClick={handleCreateManualSale} disabled={isPending || !newSale.product_id} className="bg-blue-600 hover:bg-blue-700">
                            {isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                            Зафиксировать продажу
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!deleteConfig} onOpenChange={(open) => !open && setDeleteId(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Удаление продажи</DialogTitle>
                        <DialogDescription>
                            Вы удаляете запись о продаже: <span className="font-bold text-slate-900">{deleteConfig?.productName}</span>.
                            Выберите, что сделать с товаром.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="py-4 space-y-4">
                        <div className="flex flex-col gap-3">
                            <div 
                                className={cn(
                                    "p-3 border rounded-xl cursor-pointer transition-all flex items-start gap-3",
                                    revertMode === 'none' ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500" : "hover:bg-slate-50"
                                )}
                                onClick={() => setRevertMode('none')}
                            >
                                <div className={cn("mt-1 p-1 rounded-full border", revertMode === 'none' ? "bg-blue-500 border-blue-500" : "border-slate-300")}>
                                    <div className="w-2 h-2 bg-white rounded-full" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-900">Просто удалить запись</p>
                                    <p className="text-xs text-slate-500">Товар НЕ вернется на склад. Полезно для исправления старых ошибок.</p>
                                </div>
                            </div>

                            <div 
                                className={cn(
                                    "p-3 border rounded-xl cursor-pointer transition-all flex flex-col gap-3",
                                    revertMode === 'revert' ? "border-green-500 bg-green-50 ring-1 ring-green-500" : "hover:bg-slate-50"
                                )}
                                onClick={() => setRevertMode('revert')}
                            >
                                <div className="flex items-start gap-3">
                                    <div className={cn("mt-1 p-1 rounded-full border", revertMode === 'revert' ? "bg-green-500 border-green-500" : "border-slate-300")}>
                                        <div className="w-2 h-2 bg-white rounded-full" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-900">Удалить и вернуть на склад</p>
                                        <p className="text-xs text-slate-500">Количество товара на выбранном складе увеличится.</p>
                                    </div>
                                </div>

                                {revertMode === 'revert' && (
                                    <div className="pl-8 pb-1 animate-in fade-in slide-in-from-top-2">
                                        <Label className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 block">Выберите склад для возврата</Label>
                                        <Select value={selectedRevertWarehouse} onValueChange={setSelectedRevertWarehouse}>
                                            <SelectTrigger className="h-8 text-xs bg-white">
                                                <SelectValue placeholder="Склад" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {warehouses.map(w => (
                                                    <SelectItem key={w.id} value={w.id.toString()}>{w.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl flex items-start gap-3">
                            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
                            <p className="text-[10px] text-amber-700 leading-tight">
                                В обоих случаях финансовый отчет смены (выручка) будет пересчитан автоматически.
                            </p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteId(null)}>Отмена</Button>
                        <Button variant="destructive" onClick={handleDeleteConfirm} disabled={isPending}>
                            {isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                            Подтвердить удаление
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
