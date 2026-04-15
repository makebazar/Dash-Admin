"use client"

import { useState, useTransition, useEffect, useMemo } from "react"
import { 
    ArrowRightLeft, Plus, History, 
    ArrowRight, Package, Warehouse as WarehouseIcon,
    Loader2, Search, CheckCircle2, User, Filter
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle 
} from "@/components/ui/dialog"
import { 
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { 
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table"
import { 
    transferStock, getStockMovements, 
    Warehouse 
} from "../actions"
import { useParams } from "next/navigation"
import { cn } from "@/lib/utils"
import { useUiDialogs } from "./useUiDialogs"

interface TransfersTabProps {
    warehouses: Warehouse[]
    products: any[]
    currentUserId: string
}

export function TransfersTab({ warehouses, products, currentUserId }: TransfersTabProps) {
    const params = useParams()
    const clubId = params.clubId as string
    
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [isPending, startTransition] = useTransition()
    const [movements, setMovements] = useState<any[]>([])
    const [movementSearch, setMovementSearch] = useState("")
    const [movementFilter, setMovementFilter] = useState<"all" | "inventory" | "sales" | "transfers" | "supplies" | "manual" | "writeoffs">("all")
    const [historyPage, setHistoryPage] = useState(1)
    
    // Form State
    const [formData, setFormData] = useState({
        source_warehouse_id: "",
        target_warehouse_id: "",
        product_id: "",
        quantity: "1",
        notes: ""
    })

    const [searchQuery, setSearchQuery] = useState("")
    const { showMessage, Dialogs } = useUiDialogs()

    useEffect(() => {
        refreshMovements()
    }, [])

    const refreshMovements = async () => {
        try {
            const data = await getStockMovements(clubId, 1000)
            setMovements(data)
        } catch (err) {
            console.error(err)
        }
    }

    const handleTransfer = async () => {
        if (!formData.source_warehouse_id || !formData.target_warehouse_id || !formData.product_id) {
            showMessage({ title: "Проверьте данные", description: "Заполните все обязательные поля" })
            return
        }

        startTransition(async () => {
            try {
                await transferStock(clubId, currentUserId, {
                    source_warehouse_id: Number(formData.source_warehouse_id),
                    target_warehouse_id: Number(formData.target_warehouse_id),
                    product_id: Number(formData.product_id),
                    quantity: Number(formData.quantity),
                    notes: formData.notes || undefined
                })
                setIsDialogOpen(false)
                setFormData({
                    source_warehouse_id: "",
                    target_warehouse_id: "",
                    product_id: "",
                    quantity: "1",
                    notes: ""
                })
                refreshMovements()
                showMessage({ title: "Готово", description: "Перемещение успешно оформлено" })
            } catch (err: any) {
                console.error(err)
                showMessage({ title: "Ошибка", description: err.message || "Ошибка при перемещении" })
            }
        })
    }

    const filteredProducts = products.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const getMovementMeta = (movement: any) => {
        if (movement.related_entity_type === "TRANSFER") {
            return {
                label: movement.change_amount > 0 ? "Приход по перемещению" : "Расход по перемещению",
                className: movement.change_amount > 0
                    ? "bg-blue-50 text-blue-700"
                    : "bg-indigo-50 text-indigo-700"
            }
        }

        switch (movement.type) {
            case "SUPPLY":
                return { label: "Поставка", className: "bg-emerald-50 text-emerald-700" }
            case "SALE":
                return { label: "Продажа", className: "bg-red-50 text-red-700" }
            case "RETURN":
                return { label: "Возврат", className: "bg-violet-50 text-violet-700" }
            case "INVENTORY_GAIN":
                return { label: "Излишек инв.", className: "bg-green-50 text-green-700" }
            case "INVENTORY_LOSS":
                return { label: "Недостача инв.", className: "bg-amber-50 text-amber-700" }
            case "INVENTORY_CORRECTION":
                return { label: "Коррекция инв.", className: "bg-orange-50 text-orange-700" }
            case "ADJUSTMENT":
                return { label: "Корректировка", className: "bg-accent text-foreground" }
            case "WRITE_OFF":
                return { label: "Списание", className: "bg-rose-50 text-rose-700" }
            default:
                return { label: movement.type || "Движение", className: "bg-accent text-foreground" }
        }
    }

    const filteredMovements = useMemo(() => {
        return movements.filter((movement) => {
            const haystack = [
                movement.product_name,
                movement.warehouse_name,
                movement.user_name,
                movement.reason,
                getMovementMeta(movement).label
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()

            const matchesSearch = !movementSearch.trim() || haystack.includes(movementSearch.trim().toLowerCase())

            const matchesFilter =
                movementFilter === "all" ||
                (movementFilter === "inventory" && ["INVENTORY_GAIN", "INVENTORY_LOSS", "INVENTORY_CORRECTION"].includes(movement.type)) ||
                (movementFilter === "sales" && ["SALE", "RETURN"].includes(movement.type)) ||
                (movementFilter === "transfers" && movement.related_entity_type === "TRANSFER") ||
                (movementFilter === "supplies" && movement.type === "SUPPLY") ||
                (movementFilter === "manual" && movement.type === "ADJUSTMENT") ||
                (movementFilter === "writeoffs" && movement.type === "WRITE_OFF")

            return matchesSearch && matchesFilter
        })
    }, [movementFilter, movementSearch, movements])

    const HISTORY_PER_PAGE = 20
    const totalHistoryPages = Math.max(1, Math.ceil(filteredMovements.length / HISTORY_PER_PAGE))
    
    const paginatedMovements = useMemo(() => {
        const start = (historyPage - 1) * HISTORY_PER_PAGE
        return filteredMovements.slice(start, start + HISTORY_PER_PAGE)
    }, [filteredMovements, historyPage])

    // Reset page when filters change
    useEffect(() => {
        setHistoryPage(1)
    }, [movementSearch, movementFilter])

    const movementFilterButtons: Array<{ value: typeof movementFilter, label: string }> = [
        { value: "all", label: "Все" },
        { value: "inventory", label: "Инвентаризация" },
        { value: "sales", label: "Продажи" },
        { value: "transfers", label: "Перемещения" },
        { value: "supplies", label: "Поставки" },
        { value: "manual", label: "Коррекции" },
        { value: "writeoffs", label: "Списания" }
    ]

    return (
        <div className="space-y-6">
            {/* Actions Area */}
            <div className="flex items-center justify-between bg-card p-4 sm:p-6 rounded-2xl border shadow-sm gap-4">
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <div className="h-10 w-10 sm:h-12 sm:w-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                        <ArrowRightLeft className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-sm sm:text-lg font-bold truncate">Перемещения</h3>
                        <p className="text-[10px] sm:text-sm text-muted-foreground text-muted-foreground truncate">Между складами клуба</p>
                    </div>
                </div>
                <Button 
                    onClick={() => setIsDialogOpen(true)} 
                    className="bg-blue-600 hover:bg-blue-700 h-10 sm:h-12 rounded-xl shrink-0 px-3 sm:px-6"
                >
                    <Plus className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Новое перемещение</span>
                    <span className="inline sm:hidden text-xs ml-1">Новое</span>
                </Button>
            </div>

            <div className="bg-card border rounded-2xl shadow-sm p-4 space-y-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                    <Filter className="h-4 w-4" />
                    <span className="text-sm font-bold uppercase tracking-wider">Фильтры журнала</span>
                    {filteredMovements.length !== movements.length && (
                        <Badge variant="secondary" className="ml-auto bg-accent text-foreground">
                            Найдено: {filteredMovements.length}
                        </Badge>
                    )}
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground/70" />
                    <Input
                        value={movementSearch}
                        onChange={(e) => setMovementSearch(e.target.value)}
                        placeholder="Поиск по товару, складу, комментарию или пользователю..."
                        className="pl-10 h-11 rounded-xl border-border"
                    />
                </div>

                <div className="flex flex-wrap gap-2">
                    {movementFilterButtons.map((button) => (
                        <Button
                            key={button.value}
                            type="button"
                            variant={movementFilter === button.value ? "default" : "outline"}
                            className={cn(
                                "h-9 rounded-xl text-xs",
                                movementFilter === button.value
                                    ? "bg-primary hover:bg-primary/90"
                                    : "border-border text-muted-foreground hover:bg-muted"
                            )}
                            onClick={() => setMovementFilter(button.value)}
                        >
                            {button.label}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block bg-card border rounded-2xl overflow-hidden shadow-sm">
                <div className="p-4 border-b bg-muted/50 flex items-center gap-2">
                    <History className="h-4 w-4 text-muted-foreground/70" />
                    <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">История движений</span>
                </div>
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="text-[10px] font-bold uppercase text-muted-foreground/70">Дата</TableHead>
                            <TableHead className="text-[10px] font-bold uppercase text-muted-foreground/70">Товар</TableHead>
                            <TableHead className="text-[10px] font-bold uppercase text-muted-foreground/70">Склад</TableHead>
                            <TableHead className="text-[10px] font-bold uppercase text-muted-foreground/70">Тип</TableHead>
                            <TableHead className="text-[10px] font-bold uppercase text-muted-foreground/70">Изменение</TableHead>
                            <TableHead className="text-[10px] font-bold uppercase text-muted-foreground/70">Комментарий</TableHead>
                            <TableHead className="text-[10px] font-bold uppercase text-muted-foreground/70 text-right">Пользователь</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedMovements.map((m) => {
                            const meta = getMovementMeta(m)
                            return (
                            <TableRow key={m.id} className="hover:bg-muted transition-colors">
                                <TableCell className="py-4 text-xs">
                                    {new Date(m.created_at).toLocaleString('ru-RU', { 
                                        day: '2-digit', month: '2-digit', 
                                        hour: '2-digit', minute: '2-digit' 
                                    })}
                                </TableCell>
                                <TableCell className="py-4">
                                    <div className="font-medium text-sm">{m.product_name}</div>
                                </TableCell>
                                <TableCell className="py-4">
                                    <div className="flex items-center gap-1.5">
                                        <WarehouseIcon className="h-3 w-3 text-muted-foreground/70" />
                                        <span className="text-xs">{m.warehouse_name || "Неизвестно"}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="py-4">
                                    <Badge variant="secondary" className={cn("font-bold text-[10px] border-none", meta.className)}>
                                        {meta.label}
                                    </Badge>
                                </TableCell>
                                <TableCell className="py-4">
                                    <Badge 
                                        variant="secondary" 
                                        className={cn(
                                            "font-bold text-xs border-none",
                                            m.change_amount > 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                                        )}
                                    >
                                        {m.change_amount > 0 ? "+" : ""}{m.change_amount} шт
                                    </Badge>
                                </TableCell>
                                <TableCell className="py-4 text-xs text-muted-foreground italic max-w-[200px] truncate">
                                    {m.reason ? m.reason.replace(/\s*\(Смена #[a-f0-9-]+\)/g, '') : "—"}
                                </TableCell>
                                <TableCell className="py-4 text-right text-xs font-medium">
                                    {m.user_name || "Система"}
                                </TableCell>
                            </TableRow>
                        )})}
                        {filteredMovements.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground/70">
                                    По текущим фильтрам ничего не найдено
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
                <div className="flex items-center gap-2 px-1 mb-1">
                    <History className="h-4 w-4 text-muted-foreground/70" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">История движений</span>
                </div>
                {filteredMovements.length === 0 ? (
                    <div className="h-32 flex flex-col items-center justify-center text-muted-foreground bg-card rounded-xl border border-dashed">
                        <Package className="h-8 w-8 opacity-10 mb-2" />
                        <p className="italic text-sm">По текущим фильтрам ничего не найдено</p>
                    </div>
                ) : paginatedMovements.map(m => {
                    const meta = getMovementMeta(m)
                    return (
                    <div key={m.id} className="bg-card rounded-xl border p-4 shadow-sm relative">
                        <div className="flex justify-between items-start mb-3">
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                                    {new Date(m.created_at).toLocaleString('ru-RU', { 
                                        day: '2-digit', month: '2-digit', 
                                        hour: '2-digit', minute: '2-digit' 
                                    })}
                                </span>
                                <h4 className="font-bold text-foreground text-base leading-tight">{m.product_name}</h4>
                            </div>
                            <Badge 
                                variant="secondary" 
                                className={cn(
                                    "font-black text-xs border-none px-2.5 py-1",
                                    m.change_amount > 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                                )}
                            >
                                {m.change_amount > 0 ? "+" : ""}{m.change_amount} шт
                            </Badge>
                        </div>
                        <div className="mb-4">
                            <Badge variant="secondary" className={cn("font-bold text-xs border-none px-2.5 py-1", meta.className)}>
                                {meta.label}
                            </Badge>
                        </div>
                        
                        <div className="flex flex-col gap-2 mt-4 pt-3 border-t border-slate-100">
                            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1.5">
                                    <WarehouseIcon className="h-4 w-4" />
                                    <span>{m.warehouse_name || "???"}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <User className="h-4 w-4" />
                                    <span>{m.user_name?.split(' ')[0] || "Система"}</span>
                                </div>
                            </div>
                            {m.reason && (
                                <div className="flex items-start gap-1.5 text-xs text-muted-foreground/80 mt-1">
                                    <span className="italic leading-relaxed">
                                        {m.reason.replace(/\s*\(Смена #[a-f0-9-]+\)/g, '')}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                )})}
            </div>

            {totalHistoryPages > 1 && (
                <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 text-xs text-slate-600"
                        disabled={historyPage === 1}
                        onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                    >
                        Назад
                    </Button>
                    <span className="text-xs font-medium text-slate-500">
                        {historyPage} из {totalHistoryPages}
                    </span>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 text-xs text-slate-600"
                        disabled={historyPage === totalHistoryPages}
                        onClick={() => setHistoryPage(p => Math.min(totalHistoryPages, p + 1))}
                    >
                        Вперед
                    </Button>
                </div>
            )}

            {/* Transfer Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-md p-0 overflow-hidden bg-card border-none shadow-2xl rounded-3xl">
                    <DialogHeader className="p-6 bg-primary text-primary-foreground">
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            <ArrowRightLeft className="h-5 w-5 text-blue-400" />
                            Оформить перемещение
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground/70">
                            Товар будет списан с одного склада и зачислен на другой.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="p-6 space-y-6">
                        {/* Warehouse Choice */}
                        <div className="grid grid-cols-[1fr,40px,1fr] items-center gap-2">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase text-muted-foreground/70">ОТКУДА</Label>
                                <Select 
                                    value={formData.source_warehouse_id} 
                                    onValueChange={v => setFormData(p => ({ ...p, source_warehouse_id: v }))}
                                >
                                    <SelectTrigger className="h-12 rounded-xl border-border">
                                        <SelectValue placeholder="Склад" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {warehouses.map(w => (
                                            <SelectItem key={w.id} value={w.id.toString()}>{w.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex justify-center pt-6">
                                <ArrowRight className="h-4 w-4 text-slate-300" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase text-muted-foreground/70">КУДА</Label>
                                <Select 
                                    value={formData.target_warehouse_id} 
                                    onValueChange={v => setFormData(p => ({ ...p, target_warehouse_id: v }))}
                                >
                                    <SelectTrigger className="h-12 rounded-xl border-border">
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

                        {/* Product Search */}
                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase text-muted-foreground/70">ТОВАР</Label>
                            <div className="relative">
                                <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground/70" />
                                <Input 
                                    placeholder="Поиск по названию..."
                                    className="pl-10 h-12 rounded-xl border-border"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <div className="max-h-[160px] overflow-y-auto space-y-1 mt-2 pr-1 custom-scrollbar">
                                {filteredProducts.map(p => (
                                    <button
                                        key={p.id}
                                        className={cn(
                                            "w-full text-left p-3 rounded-xl transition-all text-sm border",
                                            formData.product_id === p.id.toString() 
                                                ? "bg-blue-50 border-blue-200 text-blue-600 font-bold" 
                                                : "hover:bg-muted border-transparent text-muted-foreground"
                                        )}
                                        onClick={() => setFormData(prev => ({ ...prev, product_id: p.id.toString() }))}
                                    >
                                        {p.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Qty & Notes */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase text-muted-foreground/70">КОЛИЧЕСТВО</Label>
                                <Input 
                                    type="number"
                                    min="1"
                                    value={formData.quantity}
                                    onChange={e => setFormData(p => ({ ...p, quantity: e.target.value }))}
                                    className="h-12 rounded-xl border-border font-bold text-lg"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase text-muted-foreground/70">ПРИМЕЧАНИЕ</Label>
                                <Input 
                                    placeholder="Необязательно"
                                    value={formData.notes}
                                    onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                                    className="h-12 rounded-xl border-border"
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="p-6 bg-muted border-t flex-row gap-3">
                        <Button 
                            variant="ghost" 
                            className="flex-1 h-12 rounded-xl text-muted-foreground"
                            onClick={() => setIsDialogOpen(false)}
                        >
                            Отмена
                        </Button>
                        <Button 
                            className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 text-primary-foreground font-bold rounded-xl"
                            onClick={handleTransfer}
                            disabled={isPending || !formData.product_id || !formData.source_warehouse_id || !formData.target_warehouse_id}
                        >
                            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                            Переместить
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {Dialogs}
        </div>
    )
}
