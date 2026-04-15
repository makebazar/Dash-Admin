"use client"

import { useState, useTransition } from "react"
import { ArrowLeft, Clock, Copy, FileDown, Plus, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PageShell } from "@/components/layout/PageShell"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import { useUiDialogs } from "../../_components/useUiDialogs"
import { 
    updateProcurementItem, 
    deleteProcurementItem, 
    addProductToProcurementList, 
    bulkUpdateProcurementItems,
    deleteProcurementList,
    getProcurementListItems
} from "../../actions"

const procurementPriorityStyles: Record<string, string> = {
    CRITICAL: "bg-rose-50 text-rose-700 border-rose-200",
    HIGH: "bg-amber-50 text-amber-700 border-amber-200",
    MEDIUM: "bg-blue-50 text-blue-700 border-blue-200",
    MANUAL: "bg-accent text-muted-foreground border-border",
}

interface ProcurementDetailsClientProps {
    clubId: string
    list: any
    initialItems: any[]
    availableProducts: any[]
}

export function ProcurementDetailsClient({ clubId, list, initialItems, availableProducts }: ProcurementDetailsClientProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const { confirmAction, showMessage } = useUiDialogs()

    const [listItems, setListItems] = useState<any[]>(initialItems)
    const [selectedNewProductId, setSelectedNewProductId] = useState<string>("")
    
    // Default budget = initial total sum
    const initialTotal = initialItems.reduce((acc, i) => acc + (i.actual_quantity * i.cost_price), 0)
    const [budgetInput, setBudgetInput] = useState<string>(Math.round(initialTotal).toString())

    const totalSum = listItems.reduce((acc, i) => acc + (i.actual_quantity * i.cost_price), 0)
    const itemsCount = listItems.length
    const criticalItems = listItems.filter(i => i.procurement_priority === "CRITICAL").length

    const refreshItems = async () => {
        const items = await getProcurementListItems(clubId, list.id)
        setListItems(items)
    }

    const handleDeleteList = async () => {
        const confirmed = await confirmAction({
            title: "Удаление списка",
            description: "Удалить этот список?",
            confirmText: "Удалить"
        })
        if (!confirmed) return
        startTransition(async () => {
            await deleteProcurementList(list.id, clubId)
            router.push(`/clubs/${clubId}/inventory?tab=procurement`)
            router.refresh()
        })
    }

    const handleUpdateQuantity = async (itemId: number, newQty: number) => {
        setListItems(prev => prev.map(i => i.id === itemId ? { ...i, actual_quantity: newQty } : i))
        startTransition(async () => {
            await updateProcurementItem(itemId, { quantity: newQty }, clubId)
        })
    }

    const handleUpdateBoxSize = async (itemId: number, newBoxSize: number) => {
        if (newBoxSize < 1) return
        setListItems(prev => prev.map(i => {
            if (i.id === itemId) {
                const currentQty = i.actual_quantity
                const boxes = Math.ceil(currentQty / newBoxSize)
                const adjustedQty = Math.max(newBoxSize, boxes * newBoxSize)
                return { ...i, units_per_box: newBoxSize, actual_quantity: adjustedQty }
            }
            return i
        }))
        startTransition(async () => {
            const item = listItems.find(i => i.id === itemId)
            if (item) {
                const boxes = Math.ceil(item.actual_quantity / newBoxSize)
                const adjustedQty = Math.max(newBoxSize, boxes * newBoxSize)
                await updateProcurementItem(itemId, { units_per_box: newBoxSize, quantity: adjustedQty }, clubId)
            }
        })
    }

    const handleDeleteItem = async (itemId: number) => {
        const confirmed = await confirmAction({
            title: "Удаление товара",
            description: "Удалить товар из списка?",
            confirmText: "Удалить"
        })
        if (!confirmed) return
        setListItems(prev => prev.filter(i => i.id !== itemId))
        await deleteProcurementItem(itemId, clubId)
    }

    const handleAddItem = async () => {
        if (!selectedNewProductId) return
        try {
            await addProductToProcurementList(list.id, Number(selectedNewProductId), clubId)
            setSelectedNewProductId("")
            await refreshItems()
        } catch (e: any) {
            showMessage({ title: "Ошибка", description: e.message || "Ошибка при добавлении товара" })
        }
    }

    const handleDistributeBudget = () => {
        const budget = parseFloat(budgetInput)
        if (isNaN(budget) || budget <= 0) {
            showMessage({ title: "Проверьте данные", description: "Введите корректную сумму бюджета" })
            return
        }

        const newItems = [...listItems].map(item => ({ ...item, actual_quantity: 0 }))
        let remainingBudget = budget

        const priorityGroups = [
            newItems.filter(i => i.procurement_priority === 'CRITICAL'),
            newItems.filter(i => i.procurement_priority === 'HIGH'),
            newItems.filter(i => i.procurement_priority === 'MEDIUM'),
            newItems.filter(i => i.procurement_priority === 'MANUAL'),
        ]

        for (const group of priorityGroups) {
            group.sort((a, b) => {
                const aAbc = a.abc_category || 'C'
                const bAbc = b.abc_category || 'C'
                if (aAbc !== bAbc) return aAbc.localeCompare(bAbc)
                const aDays = a.days_left ?? Number.POSITIVE_INFINITY
                const bDays = b.days_left ?? Number.POSITIVE_INFINITY
                return aDays - bDays
            })

            let groupSatisfied = false
            while (!groupSatisfied && remainingBudget > 0) {
                groupSatisfied = true
                for (const item of group) {
                    if (item.actual_quantity < item.suggested_quantity) {
                        const costPerUnit = item.cost_price || 0
                        const qtyToAdd = item.units_per_box > 0 ? item.units_per_box : 1
                        const costToAdd = costPerUnit * qtyToAdd

                        if (remainingBudget >= costToAdd) {
                            item.actual_quantity += qtyToAdd
                            remainingBudget -= costToAdd
                            groupSatisfied = false
                        }
                    }
                }
            }
        }

        setListItems(newItems)
        
        startTransition(async () => {
            const updates = newItems.map(i => ({ id: i.id, quantity: i.actual_quantity }))
            await bulkUpdateProcurementItems(updates, clubId)
            showMessage({ title: "Успешно", description: `Бюджет распределен. Остаток: ${Math.round(remainingBudget)} ₽` })
        })
    }

    const copyToClipboard = () => {
        const text = listItems
            .filter(i => i.actual_quantity > 0)
            .map(i => {
                const qtyText = i.units_per_box > 1 
                    ? `${i.actual_quantity} шт (${Math.round(i.actual_quantity / i.units_per_box)} кор)`
                    : `${i.actual_quantity} шт`
                return `${i.product_name} - ${qtyText}`
            })
            .join("\n")
        navigator.clipboard.writeText(`Заказ:\n${text}`)
        showMessage({ title: "Скопировано", description: "Список скопирован в буфер обмена" })
    }

    return (
        <PageShell maxWidth="5xl" className="pb-24 md:pb-8">
            <div className="mb-6 hidden md:block">
                <Link href={`/clubs/${clubId}/inventory?tab=procurement`} className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors mb-4">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Назад к спискам закупок
                </Link>
            </div>

            <div className="bg-slate-900 text-slate-50 rounded-3xl p-6 sm:p-8 mb-8 relative overflow-hidden shadow-xl">
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start gap-6">
                    <div>
                        <Badge className="mb-3 bg-blue-500 hover:bg-blue-500 text-white border-none font-black uppercase tracking-widest text-[10px] px-2.5 py-1">Черновик заказа</Badge>
                        <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white leading-tight mb-2">
                            {list.name}
                        </h1>
                        <p className="text-slate-300/80 text-sm max-w-md leading-relaxed">
                            Автоматический расчет на основе ABC-приоритетов и темпов продаж.
                        </p>
                    </div>
                    <div className="text-left md:text-right shrink-0">
                        <p className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-widest mb-1.5">Ориентировочная сумма</p>
                        <p className="text-3xl sm:text-4xl font-black text-blue-400">{totalSum.toLocaleString('ru-RU')} ₽</p>
                    </div>
                </div>

                <div className="relative z-10 grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mt-8">
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/10 backdrop-blur-md">
                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-1 tracking-wider">Всего позиций</p>
                        <p className="text-xl sm:text-2xl font-black text-white">{itemsCount}</p>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/10 backdrop-blur-md">
                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-1 tracking-wider">Критический запас</p>
                        <p className="text-xl sm:text-2xl font-black text-rose-400">{criticalItems}</p>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/10 backdrop-blur-md col-span-2 md:col-span-1">
                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-1 tracking-wider">Дата плана</p>
                        <p className="text-xl sm:text-2xl font-black text-white">{format(new Date(list.created_at), 'dd.MM.yyyy')}</p>
                    </div>
                </div>

                {/* Background Decoration */}
                <div className="absolute -right-32 -bottom-32 w-[500px] h-[500px] bg-blue-600/30 rounded-full blur-[120px] pointer-events-none" />
                <div className="absolute -left-32 -top-32 w-[400px] h-[400px] bg-purple-600/20 rounded-full blur-[100px] pointer-events-none" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Budget Distribution */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 bg-blue-50/50 p-4 sm:p-5 rounded-2xl border border-blue-100 shadow-sm">
                    <div className="flex-1 space-y-2">
                        <label className="text-[10px] font-black uppercase text-blue-600 tracking-wider">Распределить бюджет (₽)</label>
                        <Input 
                            type="number" 
                            placeholder="Введите сумму..." 
                            className="bg-white border-blue-200 focus:ring-blue-500 font-bold h-11"
                            value={budgetInput}
                            onChange={(e) => setBudgetInput(e.target.value)}
                        />
                    </div>
                    <Button 
                        onClick={handleDistributeBudget} 
                        className="bg-blue-600 text-white hover:bg-blue-700 transition-all active:scale-95 shadow-md px-6 font-bold h-11 shrink-0"
                    >
                        Распределить
                    </Button>
                </div>

                {/* Add Item Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex-1 space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Добавить товар вручную</label>
                        <Select value={selectedNewProductId} onValueChange={setSelectedNewProductId}>
                            <SelectTrigger className="bg-white border-slate-200 text-sm h-11">
                                <SelectValue placeholder="Выберите товар..." />
                            </SelectTrigger>
                            <SelectContent>
                                {availableProducts.map(p => (
                                    <SelectItem key={p.id} value={p.id.toString()}>
                                        {p.name} (Остаток: {p.current_stock})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button 
                        onClick={handleAddItem} 
                        disabled={!selectedNewProductId}
                        className="bg-slate-900 text-white hover:bg-slate-800 transition-all active:scale-95 shadow-md px-6 h-11 shrink-0"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Добавить
                    </Button>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm mb-8">
                {/* Desktop Table */}
                <div className="hidden md:block">
                    <Table>
                        <TableHeader className="bg-slate-50 border-b border-slate-100">
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="text-[10px] uppercase font-bold text-slate-500 pl-6">Товар</TableHead>
                                <TableHead className="text-center text-[10px] uppercase font-bold text-slate-500">Группа</TableHead>
                                <TableHead className="text-right text-[10px] uppercase font-bold text-slate-500">Остаток</TableHead>
                                <TableHead className="text-right text-[10px] uppercase font-bold text-slate-500">Запас (дн)</TableHead>
                                <TableHead className="text-right text-[10px] uppercase font-bold text-slate-500">План (шт)</TableHead>
                                <TableHead className="w-[120px] text-right text-[10px] uppercase font-bold text-slate-500">К заказу</TableHead>
                                <TableHead className="text-right text-[10px] uppercase font-bold text-slate-500 pr-6">Сумма</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {listItems.map(item => (
                                <TableRow key={item.id} className="hover:bg-slate-50/50 group/row transition-colors">
                                    <TableCell className="pl-6 py-4">
                                        <p className="font-bold text-slate-900 text-sm">{item.product_name}</p>
                                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                            <p className="text-[10px] text-slate-500 font-medium whitespace-nowrap">Закуп: {item.cost_price} ₽</p>
                                            <Badge variant="outline" className={cn("h-5 border text-[10px] font-bold px-1.5", procurementPriorityStyles[item.procurement_priority] || procurementPriorityStyles.MANUAL)}>
                                                {item.procurement_priority === "CRITICAL" ? "Критично" :
                                                    item.procurement_priority === "HIGH" ? "Высокий" :
                                                    item.procurement_priority === "MEDIUM" ? "Средний" : "Вручную"}
                                            </Badge>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">В кор:</span>
                                                <Input 
                                                    type="number" 
                                                    className="h-6 w-14 text-[11px] px-1 text-center font-bold border-slate-200 focus:ring-0 focus:border-blue-400 bg-white" 
                                                    value={item.units_per_box}
                                                    onChange={(e) => handleUpdateBoxSize(item.id, Number(e.target.value))}
                                                    min={1}
                                                />
                                            </div>
                                        </div>
                                        <p className="mt-1.5 text-[11px] text-slate-400 leading-tight">{item.procurement_reason}</p>
                                    </TableCell>
                                    <TableCell className="text-center py-4">
                                        <Badge 
                                            className={cn(
                                                "h-6 px-2.5 text-[11px] font-black uppercase border-none",
                                                item.abc_category === 'A' ? "bg-emerald-500 text-white" :
                                                item.abc_category === 'B' ? "bg-amber-500 text-white" :
                                                "bg-slate-400 text-white"
                                            )}
                                        >
                                            {item.abc_category || 'C'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right font-medium text-slate-500 py-4">{item.current_stock}</TableCell>
                                    <TableCell className="text-right py-4">
                                        {item.days_left !== null ? (
                                            <Badge variant="outline" className={cn(
                                                "font-bold border-none h-6 px-2",
                                                Number(item.days_left) < 3 ? "bg-rose-50 text-rose-600" : 
                                                Number(item.days_left) < 7 ? "bg-amber-50 text-amber-600" : 
                                                "bg-slate-100 text-slate-600"
                                            )}>
                                                <Clock className="h-3 w-3 mr-1.5" />
                                                {Math.round(Number(item.days_left))} дн.
                                            </Badge>
                                        ) : (
                                            <span className="text-slate-300">∞</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right py-4">
                                        <div className="flex flex-col items-end">
                                            <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-none font-bold text-xs h-6 px-2">
                                                {item.suggested_quantity}
                                            </Badge>
                                            {item.units_per_box > 1 && (
                                                <span className="text-[10px] text-slate-400 mt-1">
                                                    {Math.round(item.suggested_quantity / item.units_per_box)} кор.
                                                </span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right py-4">
                                        <div className="flex flex-col items-end gap-1">
                                            <Input 
                                                type="number" 
                                                className="text-right h-9 w-[90px] font-black border-slate-200 focus:border-blue-500 focus:ring-blue-500 transition-all text-sm" 
                                                value={item.actual_quantity}
                                                onChange={(e) => handleUpdateQuantity(item.id, Number(e.target.value))}
                                            />
                                            {item.units_per_box > 1 && (
                                                <span className="text-[10px] text-blue-600 font-bold px-1.5 py-0.5 bg-blue-50 rounded">
                                                    {Math.round(item.actual_quantity / item.units_per_box)} кор.
                                                </span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right font-black text-slate-900 pr-6 py-4 text-base">
                                        {(item.actual_quantity * item.cost_price).toLocaleString('ru-RU')} ₽
                                    </TableCell>
                                    <TableCell className="py-4">
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-8 w-8 text-slate-300 hover:text-rose-600 hover:bg-rose-50 opacity-0 group-hover/row:opacity-100 transition-all"
                                            onClick={() => handleDeleteItem(item.id)}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {/* Mobile View */}
                <div className="md:hidden divide-y divide-slate-100">
                    {listItems.map(item => (
                        <div key={item.id} className="p-4 sm:p-5 flex flex-col gap-4">
                            <div className="flex justify-between items-start gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-2">
                                        <h4 className="font-bold text-slate-900 text-sm sm:text-base leading-tight">{item.product_name}</h4>
                                        <Badge 
                                            className={cn(
                                                "h-5 px-1.5 text-[9px] font-black uppercase border-none",
                                                item.abc_category === 'A' ? "bg-emerald-500 text-white" :
                                                item.abc_category === 'B' ? "bg-amber-500 text-white" :
                                                "bg-slate-400 text-white"
                                            )}
                                        >
                                            {item.abc_category || 'C'}
                                        </Badge>
                                    </div>
                                    <div className="flex flex-wrap gap-x-3 gap-y-2">
                                        <span className="text-[11px] text-slate-500 font-medium">Закуп: {item.cost_price} ₽</span>
                                        <span className="text-[11px] text-slate-500 font-medium">Остаток: {item.current_stock} шт</span>
                                        <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-bold", procurementPriorityStyles[item.procurement_priority] || procurementPriorityStyles.MANUAL)}>
                                            {item.procurement_priority === "CRITICAL" ? "Критично" :
                                                item.procurement_priority === "HIGH" ? "Высокий" :
                                                item.procurement_priority === "MEDIUM" ? "Средний" : "Вручную"}
                                        </span>
                                        {item.days_left !== null && (
                                            <span className={cn(
                                                "text-[10px] font-bold",
                                                Number(item.days_left) < 3 ? "text-rose-500" : "text-slate-500"
                                            )}>
                                                Запас: {Math.round(Number(item.days_left))} дн.
                                            </span>
                                        )}
                                    </div>
                                    <p className="mt-2 text-[11px] text-slate-400 leading-tight">{item.procurement_reason}</p>
                                </div>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-slate-300 hover:text-rose-600 hover:bg-rose-50 shrink-0 -mt-1 -mr-2" 
                                    onClick={() => handleDeleteItem(item.id)}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-50">
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest">К заказу</span>
                                    <div className="flex items-center gap-2">
                                        <Input 
                                            type="number" 
                                            className="text-center h-10 w-20 font-black text-base border-blue-200 bg-blue-50/50 text-blue-700" 
                                            value={item.actual_quantity}
                                            onChange={(e) => handleUpdateQuantity(item.id, Number(e.target.value))}
                                        />
                                        {item.units_per_box > 1 && (
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-blue-600 font-bold leading-none">
                                                    {Math.round(item.actual_quantity / item.units_per_box)} кор.
                                                </span>
                                                <span className="text-[9px] text-slate-400 font-medium leading-none mt-1">по {item.units_per_box} шт</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right flex flex-col justify-end">
                                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1.5">Сумма</p>
                                    <p className="text-xl font-black text-slate-900">{(item.actual_quantity * item.cost_price).toLocaleString('ru-RU')} ₽</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Bottom Actions Desktop */}
            <div className="hidden md:flex justify-between items-center gap-4">
                <div className="flex gap-3">
                    <Button variant="outline" className="gap-2 border-slate-200 bg-white hover:bg-slate-50 transition-all shadow-sm h-11 px-6 font-medium" onClick={copyToClipboard}>
                        <Copy className="h-4 w-4 text-slate-400" />
                        Копировать заказ
                    </Button>
                    <Button variant="outline" className="gap-2 border-slate-200 bg-white hover:bg-slate-50 transition-all shadow-sm h-11 px-6 font-medium" onClick={() => window.print()}>
                        <FileDown className="h-4 w-4 text-slate-400" />
                        PDF / Печать
                    </Button>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" className="text-rose-600 border-slate-200 hover:bg-rose-50 hover:border-rose-200 h-11 px-6" onClick={handleDeleteList}>
                        Удалить список
                    </Button>
                    <Button onClick={() => router.push(`/clubs/${clubId}/inventory?tab=procurement`)} className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-10 h-11 shadow-md transition-all active:scale-95">
                        Готово
                    </Button>
                </div>
            </div>

            {/* Bottom Actions Mobile (Sticky) */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] md:hidden z-50 flex flex-col gap-3">
                <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 gap-1.5 text-xs bg-slate-50 border-slate-200" onClick={copyToClipboard}>
                        <Copy className="h-3.5 w-3.5" />
                        Копировать
                    </Button>
                    <Button variant="outline" className="flex-1 gap-1.5 text-xs bg-slate-50 border-slate-200" onClick={() => window.print()}>
                        <FileDown className="h-3.5 w-3.5" />
                        Печать
                    </Button>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" className="text-rose-600 border-slate-200 bg-white hover:bg-rose-50 px-4" onClick={handleDeleteList}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button onClick={() => router.push(`/clubs/${clubId}/inventory?tab=procurement`)} className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold">
                        Готово
                    </Button>
                </div>
            </div>
        </PageShell>
    )
}
