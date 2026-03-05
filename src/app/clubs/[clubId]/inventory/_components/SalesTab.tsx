"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Calendar, User, ShoppingCart, Clock, ChevronDown, ChevronRight, Link, Unlink, Trash2, Check, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useState, useMemo, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { assignShiftToMovement, deleteStockMovement, massAssignShiftToMovements } from "../actions"
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { Checkbox } from "@/components/ui/checkbox"

interface SalesTabProps {
    sales: any[]
    shifts: any[]
    clubId: string
}

export function SalesTab({ sales, shifts, clubId }: SalesTabProps) {
    const [expandedShifts, setExpandedShifts] = useState<Record<string, boolean>>({})
    const [isPending, startTransition] = useTransition()
    const [selectedIds, setSelectedIds] = useState<number[]>([])

    // Group sales by shift
    const groupedSales = useMemo(() => {
        const groups: Record<string, { shift: any, items: any[] }> = {
            'unassigned': { shift: null, items: [] }
        }

        sales.forEach(sale => {
            const shiftId = sale.shift_id_raw
            if (!shiftId) {
                groups['unassigned'].items.push(sale)
            } else {
                if (!groups[shiftId]) {
                    groups[shiftId] = {
                        shift: {
                            id: shiftId,
                            start: sale.shift_start,
                            end: sale.shift_end,
                            employee: sale.user_name
                        },
                        items: []
                    }
                }
                groups[shiftId].items.push(sale)
            }
        })

        return groups
    }, [sales])

    const toggleShift = (id: string) => {
        setExpandedShifts(prev => ({ ...prev, [id]: !prev[id] }))
    }

    const handleDelete = async (id: number) => {
        if (!confirm("Вы уверены, что хотите удалить эту запись и вернуть товар на склад?")) return
        startTransition(async () => {
            await deleteStockMovement(id, clubId)
        })
    }

    const handleAssignShift = async (movementId: number, shiftId: number | null) => {
        startTransition(async () => {
            await assignShiftToMovement(movementId, shiftId, clubId)
        })
    }

    const handleMassAssign = async (shiftId: number | null) => {
        if (selectedIds.length === 0) return
        startTransition(async () => {
            await massAssignShiftToMovements(selectedIds, shiftId, clubId)
            setSelectedIds([])
        })
    }

    const toggleSelect = (id: number) => {
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        )
    }

    if (sales.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 border rounded-lg bg-white text-muted-foreground">
                <ShoppingCart className="h-12 w-12 mb-4 text-slate-300" />
                <p className="text-lg font-medium">Продаж пока нет</p>
                <p className="text-sm">Данные о продажах появятся после закрытия инвентаризаций.</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Mass Actions Bar */}
            {selectedIds.length > 0 && (
                <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg flex items-center justify-between animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="bg-blue-200 text-blue-700">{selectedIds.length} выбрано</Badge>
                        <span className="text-sm font-medium text-blue-800">Массовое действие:</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="outline" className="h-8 gap-2 bg-white">
                                    <Link className="h-3 w-3" /> Присвоить смену
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-64 max-h-80 overflow-y-auto">
                                <DropdownMenuItem onClick={() => handleMassAssign(null)}>
                                    <Unlink className="h-3 w-3 mr-2" /> Отвязать от смены
                                </DropdownMenuItem>
                                {shifts.map(s => (
                                    <DropdownMenuItem key={s.id} onClick={() => handleMassAssign(s.id)}>
                                        <div className="flex flex-col text-[10px]">
                                            <span className="font-bold">{s.employee_name}</span>
                                            <span>{new Date(s.check_in).toLocaleString()}</span>
                                        </div>
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])} className="h-8 text-blue-600">Отмена</Button>
                    </div>
                </div>
            )}

            <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead className="w-10"></TableHead>
                            <TableHead className="w-10"></TableHead>
                            <TableHead>Дата и время</TableHead>
                            <TableHead>Товар</TableHead>
                            <TableHead className="text-right">Кол-во</TableHead>
                            <TableHead>Сотрудник</TableHead>
                            <TableHead>Причина / Инвентаризация</TableHead>
                            <TableHead className="text-right">Действия</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {Object.entries(groupedSales).map(([groupId, group]) => {
                            const isUnassigned = groupId === 'unassigned'
                            const isExpanded = expandedShifts[groupId] || false
                            const items = group.items

                            if (items.length === 0 && isUnassigned) return null

                            return (
                                <>
                                    {/* Shift Header Row */}
                                    <TableRow 
                                        className={cn(
                                            "cursor-pointer transition-colors",
                                            isUnassigned ? "bg-amber-50/50" : "bg-slate-50/50",
                                            "hover:bg-slate-100"
                                        )}
                                        onClick={() => toggleShift(groupId)}
                                    >
                                        <TableCell className="p-0"></TableCell>
                                        <TableCell>
                                            {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                                        </TableCell>
                                        <TableCell colSpan={6}>
                                            <div className="flex items-center justify-between w-full">
                                                <div className="flex items-center gap-3">
                                                    {isUnassigned ? (
                                                        <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200 uppercase text-[9px]">Не привязано к смене</Badge>
                                                    ) : (
                                                        <div className="flex items-center gap-2">
                                                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100 uppercase text-[9px]">Смена #{groupId}</Badge>
                                                            <span className="text-xs font-bold text-slate-600">{group.shift.employee}</span>
                                                            <span className="text-[10px] text-slate-400">
                                                                {new Date(group.shift.start).toLocaleDateString()} {new Date(group.shift.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        </div>
                                                    )}
                                                    <span className="text-[10px] text-slate-400 font-medium">({items.length} поз.)</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                    </TableRow>

                                    {/* Shift Items Rows */}
                                    {isExpanded && items.map((sale) => (
                                        <TableRow key={sale.id} className={cn(
                                            "hover:bg-slate-50 transition-colors border-l-2",
                                            isUnassigned ? "border-amber-400" : "border-blue-400"
                                        )}>
                                            <TableCell className="text-center">
                                                <Checkbox 
                                                    checked={selectedIds.includes(sale.id)}
                                                    onCheckedChange={() => toggleSelect(sale.id)}
                                                    className="h-4 w-4"
                                                />
                                            </TableCell>
                                            <TableCell></TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-medium">
                                                        {new Date(sale.created_at).toLocaleDateString()}
                                                    </span>
                                                    <span className="text-[9px] text-muted-foreground uppercase font-bold">
                                                        {new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-semibold text-xs">{sale.product_name}</TableCell>
                                            <TableCell className="text-right">
                                                <Badge variant="secondary" className={cn(
                                                    "text-[10px] border-none px-2 h-5",
                                                    sale.change_amount < 0 ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                                                )}>
                                                    {sale.change_amount > 0 ? "+" : ""}{sale.change_amount} шт
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1.5">
                                                    <User className="h-3 w-3 text-muted-foreground" />
                                                    <span className="text-[11px]">{sale.user_name || "Система"}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-[10px] text-muted-foreground leading-relaxed italic">
                                                    {sale.reason}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-blue-500">
                                                                <Link className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-64 max-h-80 overflow-y-auto">
                                                            <DropdownMenuItem onClick={() => handleAssignShift(sale.id, null)}>
                                                                <Unlink className="h-3 w-3 mr-2" /> Отвязать от смены
                                                            </DropdownMenuItem>
                                                            {shifts.map(s => (
                                                                <DropdownMenuItem key={s.id} onClick={() => handleAssignShift(sale.id, s.id)}>
                                                                    <div className="flex flex-col text-[10px]">
                                                                        <span className="font-bold">{s.employee_name}</span>
                                                                        <span>{new Date(s.check_in).toLocaleString()}</span>
                                                                    </div>
                                                                </DropdownMenuItem>
                                                            ))}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                    <Button 
                                                        size="icon" 
                                                        variant="ghost" 
                                                        onClick={() => handleDelete(sale.id)}
                                                        className="h-7 w-7 text-slate-400 hover:text-red-500"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </>
                            )
                        })}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
