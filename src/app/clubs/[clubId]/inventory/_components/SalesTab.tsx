"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Calendar, User, ShoppingCart, Clock } from "lucide-react"
import { cn } from "@/lib/utils"

interface SalesTabProps {
    sales: any[]
}

export function SalesTab({ sales }: SalesTabProps) {
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
        <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
            <Table>
                <TableHeader className="bg-slate-50">
                    <TableRow>
                        <TableHead>Дата и время</TableHead>
                        <TableHead>Товар</TableHead>
                        <TableHead className="text-right">Кол-во</TableHead>
                        <TableHead>Сотрудник</TableHead>
                        <TableHead>Смена</TableHead>
                        <TableHead>Причина / Инвентаризация</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sales.map((sale) => (
                        <TableRow key={sale.id} className="hover:bg-slate-50 transition-colors">
                            <TableCell>
                                <div className="flex flex-col">
                                    <span className="font-medium">
                                        {new Date(sale.created_at).toLocaleDateString()}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground uppercase font-bold">
                                        {new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </TableCell>
                            <TableCell className="font-semibold">{sale.product_name}</TableCell>
                            <TableCell className="text-right">
                                <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none">
                                    {Math.abs(sale.change_amount)} шт
                                </Badge>
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2">
                                    <User className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-sm">{sale.user_name || "Система"}</span>
                                </div>
                            </TableCell>
                            <TableCell>
                                {sale.shift_id ? (
                                    <div className="flex flex-col text-[11px] leading-tight text-muted-foreground">
                                        <div className="flex items-center gap-1">
                                            <Clock className="h-2 w-2" />
                                            <span>С {new Date(sale.shift_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        {sale.shift_end && (
                                            <div className="flex items-center gap-1">
                                                <div className="w-2" />
                                                <span>До {new Date(sale.shift_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <span className="text-xs text-slate-400">—</span>
                                )}
                            </TableCell>
                            <TableCell>
                                <span className="text-xs text-muted-foreground leading-relaxed">
                                    {sale.reason}
                                </span>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
