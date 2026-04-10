"use client"

import { useState, useTransition } from "react"
import { Plus, Trash2, FileText, ChevronRight, Calculator, Clock, TrendingUp, Copy, FileDown, AlertTriangle, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { generateProcurementList, deleteProcurementList, getProcurementListItems, updateProcurementItem, deleteProcurementItem, addProductToProcurementList, bulkUpdateProcurementItems } from "../actions"
import { useParams } from "next/navigation"
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
    const clubId = params.clubId as string
    
    const [isPending, startTransition] = useTransition()
    const [activeList, setActiveList] = useState<any>(null)
    const [listItems, setListItems] = useState<any[]>([])
    const [isDetailsOpen, setIsDetailsOpen] = useState(false)
    const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false)
    const [procurementMode, setProcurementMode] = useState<"optimized" | "full">("optimized")
    const [selectedNewProductId, setSelectedNewProductId] = useState<string>("")
    const [budgetInput, setBudgetInput] = useState<string>("")
    const { confirmAction, showMessage, Dialogs } = useUiDialogs()

    const handleGenerate = () => {
        startTransition(async () => {
            try {
                await generateProcurementList(clubId, currentUserId, procurementMode)
                setIsGenerateDialogOpen(false)
            } catch (e) {
                console.error(e)
                showMessage({ title: "Ошибка", description: "Ошибка при создании списка" })
            }
        })
    }

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

    const openDetails = async (list: any) => {
        setActiveList(list)
        setIsDetailsOpen(true)
        const items = await getProcurementListItems(clubId, list.id)
        setListItems(items)
        // Reset budget input when opening a new list, round to 0 decimal places
        const total = items.reduce((acc: number, i: any) => acc + (i.actual_quantity * i.cost_price), 0)
        setBudgetInput(Math.round(total).toString())
    }

    const refreshItems = async () => {
        if (activeList) {
            const items = await getProcurementListItems(clubId, activeList.id)
            setListItems(items)
        }
    }

    const handleUpdateQuantity = async (itemId: number, newQty: number) => {
        // Optimistic update
        setListItems(prev => prev.map(i => i.id === itemId ? { ...i, actual_quantity: newQty } : i))
        
        startTransition(async () => {
            await updateProcurementItem(itemId, { quantity: newQty }, clubId)
        })
    }

    const handleUpdateBoxSize = async (itemId: number, newBoxSize: number) => {
        if (newBoxSize < 1) return
        
        // Optimistic update
        setListItems(prev => prev.map(i => {
            if (i.id === itemId) {
                const currentQty = i.actual_quantity
                const boxes = Math.ceil(currentQty / newBoxSize)
                const adjustedQty = Math.max(newBoxSize, boxes * newBoxSize) // At least 1 box
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
        if (!selectedNewProductId || !activeList) return
        try {
            await addProductToProcurementList(activeList.id, Number(selectedNewProductId), clubId)
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

        // Deep copy items to work with
        const newItems = [...listItems].map(item => ({ ...item, actual_quantity: 0 }))
        let remainingBudget = budget

        const fillItems = (filterFn: (i: any) => boolean, targetRatio: number) => {
            newItems.filter(filterFn).forEach(item => {
                if (remainingBudget <= 0) return
                
                const boxSize = item.units_per_box || 1
                const needed = Math.ceil(item.suggested_quantity * targetRatio)
                const currentAllocated = item.actual_quantity
                const toAddRaw = Math.max(0, needed - currentAllocated)
                
                const boxesToBuy = Math.ceil(toAddRaw / boxSize)
                const toAdd = boxesToBuy * boxSize
                
                if (toAdd > 0) {
                    const cost = toAdd * item.cost_price
                    if (cost <= remainingBudget) {
                        item.actual_quantity += toAdd
                        remainingBudget -= cost
                    } else {
                        // Buy as many full boxes as we can afford
                        const boxesAffordable = Math.floor(remainingBudget / (item.cost_price * boxSize))
                        const canBuy = boxesAffordable * boxSize
                        if (canBuy > 0) {
                            item.actual_quantity += canBuy
                            remainingBudget -= canBuy * item.cost_price
                        }
                    }
                }
            })
        }

        // Phase 1: Critical needs
        fillItems(i => (i.days_left !== null && i.days_left < 3), 0.2)
        
        // Phase 2: Group A
        fillItems(i => i.abc_category === 'A', 1.0)
        
        // Phase 3: Group B
        fillItems(i => i.abc_category === 'B', 1.0)
        
        // Phase 4: Everything else
        fillItems(i => true, 1.0)

        // Update local state
        setListItems(newItems)
        
        // Update budget input to remaining rounded value
        setBudgetInput(Math.round(budget - remainingBudget).toString())

        // Save to DB
        startTransition(async () => {
            const updates = newItems.map(i => ({ id: i.id, quantity: i.actual_quantity }))
            await bulkUpdateProcurementItems(updates, clubId)
        })
    }

    const copyToClipboard = () => {
        const text = listItems.map(i => `${i.product_name}: ${i.actual_quantity} шт.`).join('\n')
        navigator.clipboard.writeText(text)
        showMessage({ title: "Готово", description: "Список скопирован в буфер обмена" })
    }

    const totalSum = listItems.reduce((acc, i) => acc + (i.actual_quantity * i.cost_price), 0)
    const itemsCount = listItems.length
    const criticalItems = listItems.filter(i => (i.days_left !== null && i.days_left < 3) || i.abc_category === 'A').length

    // Filter out products already in the list
    const availableProducts = products.filter(p => !listItems.some(li => li.product_id === p.id))

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-card p-6 rounded-2xl border shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-600" />
                <div>
                    <h3 className="text-xl font-black text-foreground">Списки закупок</h3>
                    <p className="text-sm text-muted-foreground mt-1">Автоматическое планирование заказов на основе ABC-анализа и прогнозов остатка.</p>
                </div>
                <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
                    <DialogTrigger asChild>
                        <Button disabled={isPending} className="bg-blue-600 hover:bg-blue-700 shadow-md transition-all active:scale-95">
                            <Calculator className="mr-2 h-4 w-4" />
                            Сформировать заказ
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[560px]">
                        <DialogHeader>
                            <DialogTitle>Режим автозакупки</DialogTitle>
                            <DialogDescription>
                                Выбери стратегию: экономный список только по ключевым позициям или расширенное пополнение всего ассортимента.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3 py-3">
                            <button
                                type="button"
                                onClick={() => setProcurementMode("optimized")}
                                className={cn(
                                    "w-full rounded-2xl border p-4 text-left transition-all",
                                    procurementMode === "optimized" ? "border-blue-500 bg-blue-50" : "border-border bg-card"
                                )}
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="font-bold text-foreground">Жёстко оптимизированная</p>
                                        <p className="mt-1 text-sm text-muted-foreground">Фокус на категориях A/B. Категория C вообще не попадает в автозакупку.</p>
                                    </div>
                                    <Badge className="bg-primary text-primary-foreground">Экономно</Badge>
                                </div>
                            </button>
                            <button
                                type="button"
                                onClick={() => setProcurementMode("full")}
                                className={cn(
                                    "w-full rounded-2xl border p-4 text-left transition-all",
                                    procurementMode === "full" ? "border-blue-500 bg-blue-50" : "border-border bg-card"
                                )}
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="font-bold text-foreground">Полное пополнение</p>
                                        <p className="mt-1 text-sm text-muted-foreground">Шире покрывает категории A/B/C и подходит, когда нужно восстановить ассортимент.</p>
                                    </div>
                                    <Badge variant="outline" className="border-blue-200 bg-card text-blue-700">Шире список</Badge>
                                </div>
                            </button>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsGenerateDialogOpen(false)}>Отмена</Button>
                            <Button onClick={handleGenerate} disabled={isPending}>
                                <Calculator className="mr-2 h-4 w-4" />
                                Создать список
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
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

            {/* Details Dialog */}
            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0 border-none shadow-2xl rounded-3xl">
                    <div className="p-6 md:p-8 bg-primary text-primary-foreground relative overflow-hidden">
                        <div className="relative z-10">
                            <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                                <div>
                                    <Badge className="mb-2 bg-blue-500 text-primary-foreground border-none font-black uppercase tracking-widest text-[10px] px-2 py-0.5">Черновик заказа</Badge>
                                    <DialogTitle className="text-xl md:text-2xl font-black">{activeList?.name}</DialogTitle>
                                    <DialogDescription className="text-muted-foreground/70 mt-1 text-xs md:text-sm">
                                        Автоматический расчет на основе ABC-приоритетов и темпов продаж.
                                    </DialogDescription>
                                </div>
                                <div className="text-left md:text-right">
                                    <p className="text-[10px] md:text-xs text-muted-foreground/70 font-bold uppercase tracking-widest mb-1">Ориентировочная сумма</p>
                                    <p className="text-2xl md:text-3xl font-black text-blue-400">{totalSum.toLocaleString('ru-RU')} ₽</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mt-6 md:mt-8">
                                <div className="bg-card/5 rounded-2xl p-3 md:p-4 border border-white/10 backdrop-blur-sm">
                                    <p className="text-[9px] md:text-[10px] text-muted-foreground/70 font-bold uppercase mb-1 tracking-wider">Всего позиций</p>
                                    <p className="text-lg md:text-xl font-black">{itemsCount}</p>
                                </div>
                                <div className="bg-card/5 rounded-2xl p-3 md:p-4 border border-white/10 backdrop-blur-sm">
                                    <p className="text-[9px] md:text-[10px] text-muted-foreground/70 font-bold uppercase mb-1 tracking-wider">Критический запас</p>
                                    <p className="text-lg md:text-xl font-black text-rose-400">{criticalItems}</p>
                                </div>
                                <div className="bg-card/5 rounded-2xl p-3 md:p-4 border border-white/10 backdrop-blur-sm col-span-2 md:col-span-1">
                                    <p className="text-[9px] md:text-[10px] text-muted-foreground/70 font-bold uppercase mb-1 tracking-wider">Дата плана</p>
                                    <p className="text-lg md:text-xl font-black">{activeList && format(new Date(activeList.created_at), 'dd.MM.yyyy')}</p>
                                </div>
                            </div>
                        </div>
                        {/* Background Decoration */}
                        <div className="absolute -right-20 -bottom-20 w-80 h-84 bg-blue-600/20 rounded-full blur-[100px]" />
                        <div className="absolute -left-20 -top-20 w-64 h-64 bg-purple-600/10 rounded-full blur-[100px]" />
                    </div>

                    <div className="p-4 md:p-8 space-y-6">
                        {/* Budget & Add Item Row */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Budget Distribution */}
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 bg-blue-50 p-4 rounded-2xl border border-blue-100 shadow-sm">
                                <div className="flex-1 space-y-1.5">
                                    <label className="text-[10px] font-black uppercase text-blue-600 ml-1">Распределить бюджет (₽)</label>
                                    <Input 
                                        type="number" 
                                        placeholder="Введите сумму..." 
                                        className="bg-card border-blue-200 focus:ring-blue-500 font-bold"
                                        value={budgetInput}
                                        onChange={(e) => setBudgetInput(e.target.value)}
                                    />
                                </div>
                                <Button 
                                    onClick={handleDistributeBudget} 
                                    className="bg-blue-600 text-primary-foreground hover:bg-blue-700 transition-all active:scale-95 shadow-md px-6 font-bold h-10 md:h-9"
                                >
                                    Распределить
                                </Button>
                            </div>

                            {/* Add Item Bar */}
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 bg-muted p-4 rounded-2xl border border-border/50 shadow-inner">
                                <div className="flex-1 space-y-1.5">
                                    <label className="text-[10px] font-black uppercase text-muted-foreground/70 ml-1">Добавить товар вручную</label>
                                    <Select value={selectedNewProductId} onValueChange={setSelectedNewProductId}>
                                        <SelectTrigger className="bg-card border-border text-xs h-10 md:h-9">
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
                                    className="bg-primary text-primary-foreground hover:bg-primary/90 transition-all active:scale-95 shadow-lg px-6 h-10 md:h-9"
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Добавить
                                </Button>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-border overflow-hidden shadow-sm bg-card">
                            {/* Desktop Table */}
                            <div className="hidden md:block">
                                <Table>
                                    <TableHeader className="bg-muted/50">
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead className="text-[10px] uppercase font-bold text-muted-foreground/70 pl-6">Товар</TableHead>
                                            <TableHead className="text-center text-[10px] uppercase font-bold text-muted-foreground/70">Группа</TableHead>
                                            <TableHead className="text-right text-[10px] uppercase font-bold text-muted-foreground/70">Остаток</TableHead>
                                            <TableHead className="text-right text-[10px] uppercase font-bold text-muted-foreground/70">Запас (дн)</TableHead>
                                            <TableHead className="text-right text-[10px] uppercase font-bold text-muted-foreground/70">План (шт)</TableHead>
                                            <TableHead className="w-[120px] text-right text-[10px] uppercase font-bold text-muted-foreground/70">К заказу</TableHead>
                                            <TableHead className="text-right text-[10px] uppercase font-bold text-muted-foreground/70 pr-6">Сумма</TableHead>
                                            <TableHead className="w-[50px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {listItems.map(item => (
                                            <TableRow key={item.id} className="hover:bg-muted/50 group/row transition-colors">
                                                <TableCell className="pl-6">
                                                    <p className="font-bold text-foreground">{item.product_name}</p>
                                                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                                        <p className="text-[10px] text-muted-foreground/70 font-medium whitespace-nowrap">Закуп: {item.cost_price} ₽</p>
                                                        <Badge variant="outline" className={cn("h-5 border text-[10px] font-bold", procurementPriorityStyles[item.procurement_priority] || procurementPriorityStyles.MANUAL)}>
                                                            {item.procurement_priority === "CRITICAL" ? "Критично" :
                                                                item.procurement_priority === "HIGH" ? "Высокий" :
                                                                item.procurement_priority === "MEDIUM" ? "Средний" : "Вручную"}
                                                        </Badge>
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-[9px] text-muted-foreground/70 font-bold uppercase">В кор:</span>
                                                            <Input 
                                                                type="number" 
                                                                className="h-5 w-12 text-[10px] px-1 text-center font-bold border-blue-100 bg-blue-50/30 text-blue-600 focus:ring-0 focus:border-blue-300" 
                                                                value={item.units_per_box}
                                                                onChange={(e) => handleUpdateBoxSize(item.id, Number(e.target.value))}
                                                                min={1}
                                                            />
                                                        </div>
                                                    </div>
                                                    <p className="mt-1 text-[11px] text-muted-foreground">{item.procurement_reason}</p>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge 
                                                        className={cn(
                                                            "h-5 px-2 text-[10px] font-black uppercase border-none",
                                                            item.abc_category === 'A' ? "bg-green-500 text-primary-foreground" :
                                                            item.abc_category === 'B' ? "bg-amber-500 text-primary-foreground" :
                                                            "bg-slate-400 text-primary-foreground"
                                                        )}
                                                    >
                                                        {item.abc_category || 'C'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right font-medium text-muted-foreground">{item.current_stock}</TableCell>
                                                <TableCell className="text-right">
                                                    {item.days_left !== null ? (
                                                        <Badge variant="outline" className={cn(
                                                            "font-bold border-none h-6 px-2",
                                                            Number(item.days_left) < 3 ? "bg-rose-50 text-rose-600" : 
                                                            Number(item.days_left) < 7 ? "bg-amber-50 text-amber-600" : 
                                                            "bg-muted text-muted-foreground"
                                                        )}>
                                                            <Clock className="h-3 w-3 mr-1" />
                                                            {Math.round(Number(item.days_left))} дн.
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-slate-300">∞</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex flex-col items-end">
                                                        <Badge variant="secondary" className="bg-blue-50 text-blue-600 border-none font-bold">
                                                            {item.suggested_quantity}
                                                        </Badge>
                                                        {item.units_per_box > 1 && (
                                                            <span className="text-[9px] text-muted-foreground/70 mt-0.5">
                                                                {Math.round(item.suggested_quantity / item.units_per_box)} кор.
                                                            </span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex flex-col items-end gap-1">
                                                        <Input 
                                                            type="number" 
                                                            className="text-right h-8 w-[80px] font-black border-blue-100 focus:border-blue-500 focus:ring-blue-500 transition-all" 
                                                            value={item.actual_quantity}
                                                            onChange={(e) => handleUpdateQuantity(item.id, Number(e.target.value))}
                                                        />
                                                        {item.units_per_box > 1 && (
                                                            <span className="text-[9px] text-blue-500 font-bold px-1 bg-blue-50 rounded">
                                                                {Math.round(item.actual_quantity / item.units_per_box)} кор.
                                                            </span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right font-black text-foreground pr-6">
                                                    {(item.actual_quantity * item.cost_price).toLocaleString('ru-RU')} ₽
                                                </TableCell>
                                                <TableCell>
                                                    <Button 
                                                        aria-label={`Удалить товар ${item.product_name} из списка`}
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-8 w-8 text-slate-300 hover:text-red-600 opacity-0 group-hover/row:opacity-100 transition-all"
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
                                    <div key={item.id} className="p-4 flex flex-col gap-3 active:bg-muted transition-colors">
                                        <div className="flex justify-between items-start gap-4">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h4 className="font-bold text-foreground text-sm leading-tight">{item.product_name}</h4>
                                                    <Badge 
                                                        className={cn(
                                                            "h-4 px-1 text-[8px] font-black uppercase border-none",
                                                            item.abc_category === 'A' ? "bg-green-500 text-primary-foreground" :
                                                            item.abc_category === 'B' ? "bg-amber-500 text-primary-foreground" :
                                                            "bg-slate-400 text-primary-foreground"
                                                        )}
                                                    >
                                                        {item.abc_category || 'C'}
                                                    </Badge>
                                                </div>
                                                <div className="flex flex-wrap gap-x-3 gap-y-1">
                                                    <span className="text-[10px] text-muted-foreground/70 font-medium">Закуп: {item.cost_price} ₽</span>
                                                    <span className="text-[10px] text-muted-foreground/70 font-medium">Остаток: {item.current_stock} шт</span>
                                                    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-bold", procurementPriorityStyles[item.procurement_priority] || procurementPriorityStyles.MANUAL)}>
                                                        {item.procurement_priority === "CRITICAL" ? "Критично" :
                                                            item.procurement_priority === "HIGH" ? "Высокий" :
                                                            item.procurement_priority === "MEDIUM" ? "Средний" : "Вручную"}
                                                    </span>
                                                    {item.days_left !== null && (
                                                        <span className={cn(
                                                            "text-[10px] font-bold",
                                                            Number(item.days_left) < 3 ? "text-rose-500" : "text-muted-foreground/70"
                                                        )}>
                                                            Запас: {Math.round(Number(item.days_left))} дн.
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="mt-1 text-[10px] text-muted-foreground">{item.procurement_reason}</p>
                                            </div>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-8 w-8 text-slate-300" 
                                                onClick={() => handleDeleteItem(item.id)}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-50">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[9px] text-muted-foreground/70 uppercase font-black tracking-widest">К заказу</span>
                                                <div className="flex items-center gap-2">
                                                    <Input 
                                                        type="number" 
                                                        className="text-center h-10 w-20 font-black text-lg border-blue-100 bg-blue-50/30 text-blue-700" 
                                                        value={item.actual_quantity}
                                                        onChange={(e) => handleUpdateQuantity(item.id, Number(e.target.value))}
                                                    />
                                                    {item.units_per_box > 1 && (
                                                        <div className="flex flex-col">
                                                            <span className="text-[9px] text-blue-500 font-bold leading-none">
                                                                {Math.round(item.actual_quantity / item.units_per_box)} кор.
                                                            </span>
                                                            <span className="text-[8px] text-muted-foreground/70 font-medium leading-none mt-0.5">по {item.units_per_box} шт</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-right flex flex-col justify-end">
                                                <p className="text-[9px] text-muted-foreground/70 uppercase font-black tracking-widest mb-1">Сумма</p>
                                                <p className="text-lg font-black text-foreground">{(item.actual_quantity * item.cost_price).toLocaleString('ru-RU')} ₽</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="p-6 md:p-8 bg-muted border-t flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
                        <div className="flex gap-3">
                            <Button variant="outline" className="flex-1 sm:flex-none gap-2 border-border bg-card hover:bg-card hover:border-slate-400 transition-all shadow-sm text-xs h-10" onClick={copyToClipboard}>
                                <Copy className="h-4 w-4" />
                                Копировать
                            </Button>
                            <Button variant="outline" className="flex-1 sm:flex-none gap-2 border-border bg-card hover:bg-card hover:border-slate-400 transition-all shadow-sm text-xs h-10" onClick={() => window.print()}>
                                <FileDown className="h-4 w-4" />
                                PDF / Печать
                            </Button>
                        </div>
                        <Button onClick={() => setIsDetailsOpen(false)} className="bg-primary hover:bg-primary/90 text-primary-foreground font-black px-10 h-11 rounded-xl shadow-lg transition-all active:scale-95">
                            Готово
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
            {Dialogs}
        </div>
    )
}
