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
        const groups: Record<string, { shift: any, items: any[], totalAmount: number }> = {
            'unassigned': { shift: null, items: [], totalAmount: 0 }
        }

        sales.forEach(sale => {
            const shiftId = sale.shift_id_raw
            const amount = Math.abs(sale.change_amount)
            
            if (!shiftId) {
                groups['unassigned'].items.push(sale)
                groups['unassigned'].totalAmount += amount
            } else {
                if (!groups[shiftId]) {
                    groups[shiftId] = {
                        shift: {
                            id: shiftId,
                            start: sale.shift_start,
                            end: sale.shift_end,
                            employee: sale.user_name,
                            reported: Number(sale.shift_reported_revenue || 0),
                            calculated: Number(sale.shift_calculated_revenue || 0),
                            difference: Number(sale.shift_revenue_difference || 0)
                        },
                        items: [],
                        totalAmount: 0
                    }
                }
                groups[shiftId].items.push(sale)
                groups[shiftId].totalAmount += amount
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

    const handleDelete = async (id: number) => {
        if (!confirm("Удалить эту продажу и вернуть товар на склад?")) return
        startTransition(async () => {
            try {
                await deleteStockMovement(id, clubId)
            } catch (e) {
                alert("Ошибка при удалении")
            }
        })
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
                                            <span>{new Date(s.check_in).toLocaleString()}</span>
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
                                                    <span className="font-medium">{new Date(group.shift.start).toLocaleDateString()} {new Date(group.shift.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
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
                                    {!isUnassigned && (
                                        <div className="flex gap-4 border-r pr-6 border-slate-100">
                                            <div className="text-right">
                                                <div className="text-[9px] text-slate-400 uppercase font-bold tracking-wider leading-none mb-1">По складу</div>
                                                <div className="text-sm font-bold text-blue-600 leading-none">{group.shift.calculated.toLocaleString()} ₽</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[9px] text-slate-400 uppercase font-bold tracking-wider leading-none mb-1">По кассе</div>
                                                <div className="text-sm font-bold text-slate-700 leading-none">{group.shift.reported.toLocaleString()} ₽</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[9px] text-slate-400 uppercase font-bold tracking-wider leading-none mb-1">Расхождение</div>
                                                <div className={cn(
                                                    "text-sm font-black leading-none",
                                                    group.shift.difference === 0 ? "text-green-500" : 
                                                    group.shift.difference > 0 ? "text-amber-500" : "text-red-500"
                                                )}>
                                                    {group.shift.difference > 0 ? "+" : ""}{group.shift.difference.toLocaleString()} ₽
                                                </div>
                                            </div>
                                        </div>
                                    )}

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
                                                <TableHead className="text-right text-[10px] uppercase font-bold text-slate-400">Кол-во</TableHead>
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
                                                            <span className="text-sm font-semibold text-slate-800">{sale.product_name}</span>
                                                            <span className="text-[10px] text-slate-400 truncate max-w-[200px] italic">{sale.reason}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right py-2">
                                                        <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-100 font-mono text-xs">
                                                            {Math.abs(sale.change_amount)} шт
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right py-2">
                                                        <span className="text-[11px] text-slate-500">
                                                            {new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-right py-2">
                                                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
                                                                className="h-8 w-8 text-slate-400 hover:text-red-500"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
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
        </div>
    )
}
