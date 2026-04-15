"use client"

import { useState, useTransition, useMemo, useEffect } from "react"
import { Plus, Search, Calendar, User, Package, Trash2, RefreshCw, Eye, Edit, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createSupply, getSupplyItems, deleteSupply, Supply, SupplyItem, Product, Warehouse } from "../actions"
import { useParams, useRouter } from "next/navigation"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { useUiDialogs } from "./useUiDialogs"

interface SuppliesTabProps {
    supplies: Supply[]
    products: Product[]
    warehouses: Warehouse[]
    suppliers: { id: number, name: string }[]
    currentUserId: string
}

export function SuppliesTab({ supplies, products, warehouses, suppliers, currentUserId }: SuppliesTabProps) {
    const params = useParams()
    const router = useRouter()
    const clubId = params.clubId as string
    
    const { confirmAction, showMessage, Dialogs } = useUiDialogs()

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-card p-4 rounded-lg border shadow-sm">
                <div className="flex flex-col">
                    <h3 className="font-bold text-foreground">Поставки</h3>
                    <p className="text-xs text-muted-foreground">Учет прихода товаров и контроль закупочных цен</p>
                </div>
                <Button onClick={() => router.push(`/clubs/${clubId}/inventory/supplies/new`)} className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="mr-2 h-4 w-4" />
                    Оформить поставку
                </Button>
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block rounded-xl border bg-card overflow-hidden shadow-sm">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="text-[10px] uppercase font-bold text-muted-foreground/70">Дата</TableHead>
                            <TableHead className="text-[10px] uppercase font-bold text-muted-foreground/70">Поставщик</TableHead>
                            <TableHead className="text-[10px] uppercase font-bold text-muted-foreground/70">Статус</TableHead>
                            <TableHead className="text-[10px] uppercase font-bold text-muted-foreground/70 text-right">Позиций</TableHead>
                            <TableHead className="text-[10px] uppercase font-bold text-muted-foreground/70 text-right">Сумма</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {supplies.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic">
                                    История поставок пуста
                                </TableCell>
                            </TableRow>
                        ) : supplies.map(supply => (
                            <TableRow key={supply.id} className="hover:bg-muted/50 cursor-pointer group" onClick={() => router.push(`/clubs/${clubId}/inventory/supplies/${supply.id}`)}>
                                <TableCell className="font-medium">
                                    <div className="flex flex-col">
                                        <span className="text-sm text-foreground font-bold">{new Date(supply.created_at).toLocaleDateString('ru-RU')}</span>
                                        <span className="text-[10px] text-muted-foreground/70">{new Date(supply.created_at).toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'})}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-semibold text-foreground">{supply.supplier_name}</span>
                                        <span className="text-[10px] text-muted-foreground/70 flex items-center gap-1">
                                            <User className="h-2.5 w-2.5" /> {supply.created_by_name || "Неизвестно"}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {supply.status === 'DRAFT' ? (
                                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">Черновик</Badge>
                                    ) : (
                                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px]">Проведено</Badge>
                                    )}
                                </TableCell>
                                <TableCell className="text-right text-sm font-medium text-muted-foreground">{supply.items_count}</TableCell>
                                <TableCell className="text-right">
                                    <span className="text-sm font-black text-foreground">{Number(supply.total_cost).toLocaleString('ru-RU')} ₽</span>
                                </TableCell>
                                <TableCell>
                                    <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
                {supplies.length === 0 ? (
                    <div className="h-32 flex flex-col items-center justify-center text-muted-foreground bg-card rounded-xl border border-dashed">
                        <Package className="h-8 w-8 opacity-10 mb-2" />
                        <p className="italic text-sm">История поставок пуста</p>
                    </div>
                ) : supplies.map(supply => (
                    <div 
                        key={supply.id} 
                        className="bg-card rounded-xl border p-4 shadow-sm active:bg-muted transition-colors cursor-pointer"
                        onClick={() => router.push(`/clubs/${clubId}/inventory/supplies/${supply.id}`)}
                    >
                        <div className="flex justify-between items-start mb-3">
                            <div className="flex flex-col">
                                <span className="text-[10px] text-muted-foreground/70 uppercase font-black tracking-widest mb-0.5">
                                    {new Date(supply.created_at).toLocaleDateString('ru-RU')} в {new Date(supply.created_at).toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'})}
                                </span>
                                <h4 className="font-black text-foreground text-base leading-tight">{supply.supplier_name}</h4>
                            </div>
                            {supply.status === 'DRAFT' ? (
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[9px] uppercase font-black">Черновик</Badge>
                            ) : (
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[9px] uppercase font-black">Проведено</Badge>
                            )}
                        </div>
                        
                        <div className="flex justify-between items-end pt-3 border-t border-border/50">
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <User className="h-3.5 w-3.5" />
                                    <span>{supply.created_by_name || "Неизвестно"}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Package className="h-3.5 w-3.5" />
                                    <span>{supply.items_count} поз.</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-muted-foreground/70 uppercase font-black tracking-widest mb-0.5">Сумма</p>
                                <p className="text-xl font-black text-blue-600">{Number(supply.total_cost).toLocaleString('ru-RU')} ₽</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {Dialogs}
        </div>
    )
}
