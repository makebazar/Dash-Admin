"use client"

import { useState, useTransition } from "react"
import { Plus, Trash2, FileText, ChevronRight, Calculator } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { generateProcurementList, deleteProcurementList, getProcurementListItems, updateProcurementItem } from "../actions"
import { useParams } from "next/navigation"
import { format } from "date-fns"
import { ru } from "date-fns/locale"

interface ProcurementTabProps {
    lists: any[]
    currentUserId: string
}

export function ProcurementTab({ lists, currentUserId }: ProcurementTabProps) {
    const params = useParams()
    const clubId = params.clubId as string
    
    const [isPending, startTransition] = useTransition()
    const [activeList, setActiveList] = useState<any>(null)
    const [listItems, setListItems] = useState<any[]>([])
    const [isDetailsOpen, setIsDetailsOpen] = useState(false)

    const handleGenerate = () => {
        startTransition(async () => {
            try {
                await generateProcurementList(clubId, currentUserId)
            } catch (e) {
                console.error(e)
                alert("Ошибка при создании списка")
            }
        })
    }

    const handleDelete = (id: number) => {
        if (!confirm("Удалить этот список?")) return
        startTransition(async () => {
            await deleteProcurementList(id, clubId)
        })
    }

    const openDetails = async (list: any) => {
        setActiveList(list)
        setIsDetailsOpen(true)
        const items = await getProcurementListItems(list.id)
        setListItems(items)
    }

    const handleUpdateQuantity = async (itemId: number, newQty: number) => {
        // Optimistic update
        setListItems(prev => prev.map(i => i.id === itemId ? { ...i, actual_quantity: newQty } : i))
        
        startTransition(async () => {
            await updateProcurementItem(itemId, newQty, clubId)
        })
    }

    const copyToClipboard = () => {
        const text = listItems.map(i => `${i.product_name}: ${i.actual_quantity} шт.`).join('\n')
        navigator.clipboard.writeText(text)
        alert("Список скопирован в буфер обмена")
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-white p-4 rounded-lg border shadow-sm">
                <div>
                    <h3 className="text-lg font-medium">Списки закупок</h3>
                    <p className="text-sm text-muted-foreground">Автоматически сгенерированные черновики заказов на основе остатков.</p>
                </div>
                <Button onClick={handleGenerate} disabled={isPending}>
                    <Calculator className="mr-2 h-4 w-4" />
                    Сформировать новый заказ
                </Button>
            </div>

            <div className="bg-white rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Название</TableHead>
                            <TableHead>Дата создания</TableHead>
                            <TableHead>Позиций</TableHead>
                            <TableHead>Автор</TableHead>
                            <TableHead className="text-right">Действия</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {lists.map(list => (
                            <TableRow key={list.id} className="cursor-pointer hover:bg-slate-50" onClick={() => openDetails(list)}>
                                <TableCell className="font-medium flex items-center">
                                    <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
                                    {list.name}
                                </TableCell>
                                <TableCell>
                                    {format(new Date(list.created_at), 'dd MMM yyyy HH:mm', { locale: ru })}
                                </TableCell>
                                <TableCell>{list.items_count}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{list.creator_name}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDelete(list.id) }}>
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                    <Button variant="ghost" size="icon">
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                        {lists.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                    Нет списков закупок. Нажмите "Сформировать", чтобы создать первый.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Details Dialog */}
            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{activeList?.name}</DialogTitle>
                        <DialogDescription>
                            Проверьте и скорректируйте список перед отправкой поставщику.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Товар</TableHead>
                                    <TableHead className="text-right">Текущий остаток</TableHead>
                                    <TableHead className="text-right">Продажи (в день)</TableHead>
                                    <TableHead className="text-right">Реком. кол-во</TableHead>
                                    <TableHead className="w-[120px] text-right">К заказу</TableHead>
                                    <TableHead className="text-right">Примерная стоимость</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {listItems.map(item => (
                                    <TableRow key={item.id}>
                                        <TableCell className="font-medium">{item.product_name}</TableCell>
                                        <TableCell className="text-right text-muted-foreground">{item.current_stock}</TableCell>
                                        <TableCell className="text-right text-muted-foreground">
                                            {Number(item.sales_velocity).toFixed(1)}
                                        </TableCell>
                                        <TableCell className="text-right text-muted-foreground">
                                            {item.suggested_quantity}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Input 
                                                type="number" 
                                                className="text-right h-8" 
                                                value={item.actual_quantity}
                                                onChange={(e) => handleUpdateQuantity(item.id, Number(e.target.value))}
                                            />
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            {(item.actual_quantity * item.cost_price).toLocaleString()} ₽
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {listItems.length > 0 && (
                                    <TableRow className="bg-slate-50 font-bold">
                                        <TableCell colSpan={5} className="text-right">Итого:</TableCell>
                                        <TableCell className="text-right">
                                            {listItems.reduce((acc, i) => acc + (i.actual_quantity * i.cost_price), 0).toLocaleString()} ₽
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button variant="secondary" onClick={copyToClipboard}>Копировать</Button>
                        <Button variant="outline" onClick={() => window.print()}>Печать / PDF</Button>
                        <Button onClick={() => setIsDetailsOpen(false)}>Сохранить и закрыть</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}