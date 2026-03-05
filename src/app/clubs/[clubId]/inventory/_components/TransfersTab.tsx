"use client"

import { useState, useTransition, useEffect } from "react"
import { 
    ArrowRightLeft, Plus, History, 
    ArrowRight, Package, Warehouse as WarehouseIcon,
    Loader2, Search, CheckCircle2
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
    Warehouse, Category 
} from "../actions"
import { useParams } from "next/navigation"
import { cn } from "@/lib/utils"

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
    
    // Form State
    const [formData, setFormData] = useState({
        source_warehouse_id: "",
        target_warehouse_id: "",
        product_id: "",
        quantity: "1",
        notes: ""
    })

    const [searchQuery, setSearchQuery] = useState("")

    useEffect(() => {
        refreshMovements()
    }, [])

    const refreshMovements = async () => {
        try {
            const data = await getStockMovements(clubId, 50)
            setMovements(data)
        } catch (err) {
            console.error(err)
        }
    }

    const handleTransfer = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.source_warehouse_id || !formData.target_warehouse_id || !formData.product_id) {
            alert("Заполните все обязательные поля")
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
                alert("Перемещение успешно оформлено")
            } catch (err: any) {
                console.error(err)
                alert(err.message || "Ошибка при перемещении")
            }
        })
    }

    const filteredProducts = products.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className="space-y-6">
            {/* Actions Area */}
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl border shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                        <ArrowRightLeft className="h-6 w-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold">Перемещения</h3>
                        <p className="text-sm text-muted-foreground text-slate-500">Между складами клуба</p>
                    </div>
                </div>
                <Button onClick={() => setIsDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700 h-12 rounded-xl">
                    <Plus className="mr-2 h-4 w-4" />
                    Новое перемещение
                </Button>
            </div>

            {/* History Table */}
            <div className="bg-white border rounded-2xl overflow-hidden shadow-sm">
                <div className="p-4 border-b bg-slate-50/50 flex items-center gap-2">
                    <History className="h-4 w-4 text-slate-400" />
                    <span className="text-sm font-bold uppercase tracking-wider text-slate-500">История движений</span>
                </div>
                <Table>
                    <TableHeader className="bg-slate-50/50">
                        <TableRow>
                            <TableHead className="text-[10px] font-bold uppercase text-slate-400">Дата</TableHead>
                            <TableHead className="text-[10px] font-bold uppercase text-slate-400">Товар</TableHead>
                            <TableHead className="text-[10px] font-bold uppercase text-slate-400">Склад</TableHead>
                            <TableHead className="text-[10px] font-bold uppercase text-slate-400">Изменение</TableHead>
                            <TableHead className="text-[10px] font-bold uppercase text-slate-400">Комментарий</TableHead>
                            <TableHead className="text-[10px] font-bold uppercase text-slate-400 text-right">Пользователь</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {movements.map((m) => (
                            <TableRow key={m.id} className="hover:bg-slate-50 transition-colors">
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
                                        <WarehouseIcon className="h-3 w-3 text-slate-400" />
                                        <span className="text-xs">{m.warehouse_name || "Неизвестно"}</span>
                                    </div>
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
                                <TableCell className="py-4 text-xs text-slate-500 italic max-w-[200px] truncate">
                                    {m.reason || "—"}
                                </TableCell>
                                <TableCell className="py-4 text-right text-xs font-medium">
                                    {m.user_name || "Система"}
                                </TableCell>
                            </TableRow>
                        ))}
                        {movements.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="h-32 text-center text-slate-400">
                                    Движений пока не зафиксировано
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Transfer Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-md p-0 overflow-hidden bg-white border-none shadow-2xl rounded-3xl">
                    <DialogHeader className="p-6 bg-slate-900 text-white">
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            <ArrowRightLeft className="h-5 w-5 text-blue-400" />
                            Оформить перемещение
                        </DialogTitle>
                        <DialogDescription className="text-slate-400">
                            Товар будет списан с одного склада и зачислен на другой.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="p-6 space-y-6">
                        {/* Warehouse Choice */}
                        <div className="grid grid-cols-[1fr,40px,1fr] items-center gap-2">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase text-slate-400">ОТКУДА</Label>
                                <Select 
                                    value={formData.source_warehouse_id} 
                                    onValueChange={v => setFormData(p => ({ ...p, source_warehouse_id: v }))}
                                >
                                    <SelectTrigger className="h-12 rounded-xl border-slate-200">
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
                                <Label className="text-[10px] font-bold uppercase text-slate-400">КУДА</Label>
                                <Select 
                                    value={formData.target_warehouse_id} 
                                    onValueChange={v => setFormData(p => ({ ...p, target_warehouse_id: v }))}
                                >
                                    <SelectTrigger className="h-12 rounded-xl border-slate-200">
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
                            <Label className="text-[10px] font-bold uppercase text-slate-400">ТОВАР</Label>
                            <div className="relative">
                                <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                                <Input 
                                    placeholder="Поиск по названию..."
                                    className="pl-10 h-12 rounded-xl border-slate-200"
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
                                                : "hover:bg-slate-50 border-transparent text-slate-600"
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
                                <Label className="text-[10px] font-bold uppercase text-slate-400">КОЛИЧЕСТВО</Label>
                                <Input 
                                    type="number"
                                    min="1"
                                    value={formData.quantity}
                                    onChange={e => setFormData(p => ({ ...p, quantity: e.target.value }))}
                                    className="h-12 rounded-xl border-slate-200 font-bold text-lg"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase text-slate-400">ПРИМЕЧАНИЕ</Label>
                                <Input 
                                    placeholder="Необязательно"
                                    value={formData.notes}
                                    onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                                    className="h-12 rounded-xl border-slate-200"
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="p-6 bg-slate-50 border-t flex-row gap-3">
                        <Button 
                            variant="ghost" 
                            className="flex-1 h-12 rounded-xl text-slate-500"
                            onClick={() => setIsDialogOpen(false)}
                        >
                            Отмена
                        </Button>
                        <Button 
                            className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl"
                            onClick={handleTransfer}
                            disabled={isPending || !formData.product_id || !formData.source_warehouse_id || !formData.target_warehouse_id}
                        >
                            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                            Переместить
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
