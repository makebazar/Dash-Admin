"use client"

import { useState, useTransition } from "react"
import { Plus, Trash2, FileText, ChevronRight, Calculator, Clock, TrendingUp, Copy, FileDown, AlertTriangle, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { deleteProcurementList, getProcurementListItems, updateProcurementItem, deleteProcurementItem, addProductToProcurementList, bulkUpdateProcurementItems } from "../actions"
import { useParams, useRouter } from "next/navigation"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useUiDialogs } from "./useUiDialogs"

const procurementPriorityStyles: Record<string, string> = {
    CRITICAL: "bg-rose-50 text-rose-700 border-rose-200",
    HIGH: "bg-amber-50 text-amber-700 border-amber-200",
    MEDIUM: "bg-blue-50 text-blue-700 border-blue-200",
    MANUAL: "bg-accent text-muted-foreground border-border",
}

interface ProcurementTabProps {
    lists: any[]
    products: any[]
    currentUserId: string
}

export function ProcurementTab({ lists, products, currentUserId }: ProcurementTabProps) {
    const params = useParams()
    const router = useRouter()
    const clubId = params.clubId as string
    
    const [isPending, startTransition] = useTransition()
    const { confirmAction, showMessage, Dialogs } = useUiDialogs()

    const handleDelete = async (id: number) => {
        const confirmed = await confirmAction({
            title: "Удаление списка",
            description: "Удалить этот список?",
            confirmText: "Удалить"
        })
        if (!confirmed) return
        startTransition(async () => {
            await deleteProcurementList(id, clubId)
        })
    }

    const openDetails = (list: any) => {
        router.push(`/clubs/${clubId}/inventory/procurement/${list.id}`)
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-4 sm:p-6 rounded-2xl border shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-600" />
                <div className="pl-2">
                    <h3 className="text-xl font-black text-foreground">Списки закупок</h3>
                    <p className="text-sm text-muted-foreground mt-1 max-w-md">Автоматическое планирование заказов на основе ABC-анализа и прогнозов остатка.</p>
                </div>
                <Button 
                    onClick={() => router.push(`/clubs/${clubId}/inventory/procurement/new`)}
                    disabled={isPending} 
                    className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 shadow-md transition-all active:scale-95"
                >
                    <Calculator className="mr-2 h-4 w-4" />
                    Сформировать заказ
                </Button>
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block bg-card rounded-2xl border overflow-hidden shadow-sm">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="text-[10px] uppercase font-bold text-muted-foreground/70">Название</TableHead>
                            <TableHead className="text-[10px] uppercase font-bold text-muted-foreground/70">Создан</TableHead>
                            <TableHead className="text-[10px] uppercase font-bold text-muted-foreground/70 text-center">Товаров</TableHead>
                            <TableHead className="text-[10px] uppercase font-bold text-muted-foreground/70">Автор</TableHead>
                            <TableHead className="text-right text-[10px] uppercase font-bold text-muted-foreground/70 pr-6">Действия</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {lists.map(list => (
                            <TableRow key={list.id} className="cursor-pointer group hover:bg-muted/50 transition-colors" onClick={() => openDetails(list)}>
                                <TableCell className="font-bold text-foreground flex items-center">
                                    <div className="p-2 bg-accent rounded-lg mr-3 group-hover:bg-card transition-colors">
                                        <FileText className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                    {list.name}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                    {format(new Date(list.created_at), 'dd MMM yyyy HH:mm', { locale: ru })}
                                </TableCell>
                                <TableCell className="text-center">
                                    <Badge variant="secondary" className="bg-accent text-muted-foreground font-bold border-none">
                                        {list.items_count} поз.
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground font-medium">{list.creator_name}</TableCell>
                                <TableCell className="text-right pr-6">
                                    <div className="flex items-center justify-end gap-1">
                                        <Button 
                                            aria-label={`Удалить список ${list.name}`}
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-8 w-8 text-muted-foreground/70 hover:text-red-600 hover:bg-red-50 transition-colors" 
                                            onClick={(e) => { e.stopPropagation(); handleDelete(list.id) }}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                        <Button aria-label={`Открыть список ${list.name}`} variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/70 group-hover:text-blue-600 transition-colors">
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {lists.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground/70 italic">
                                    Списки закупок пока не созданы.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
                {lists.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground italic bg-card rounded-xl border border-dashed">Списков пока нет</div>
                ) : lists.map(list => (
                    <div 
                        key={list.id} 
                        className="bg-card rounded-xl border p-4 shadow-sm active:bg-muted transition-colors"
                        onClick={() => openDetails(list)}
                    >
                        <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                    <FileText className="h-5 w-5" />
                                </div>
                                <div className="flex flex-col">
                                    <h4 className="font-black text-foreground text-base leading-tight">{list.name}</h4>
                                    <span className="text-[10px] text-muted-foreground/70 font-bold uppercase tracking-widest mt-0.5">
                                        {format(new Date(list.created_at), 'dd MMM yyyy', { locale: ru })}
                                    </span>
                                </div>
                            </div>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-red-400" 
                                onClick={(e) => { e.stopPropagation(); handleDelete(list.id) }}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                        
                        <div className="flex justify-between items-center pt-3 border-t border-slate-50">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                                <Clock className="h-3.5 w-3.5" />
                                <span>{list.creator_name?.split(' ')[0]}</span>
                            </div>
                            <Badge variant="secondary" className="bg-accent text-muted-foreground font-black border-none text-[10px]">
                                {list.items_count} ПОЗ.
                            </Badge>
                        </div>
                    </div>
                ))}
            </div>
            {Dialogs}
        </div>
    )
}
