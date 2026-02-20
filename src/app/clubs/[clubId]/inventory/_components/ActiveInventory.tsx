"use client"

import { useState, useEffect, useTransition } from "react"
import { ArrowLeft, Save, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { getInventory, getInventoryItems, updateInventoryItem, closeInventory, Inventory, InventoryItem } from "../actions"
import { useParams } from "next/navigation"

interface ActiveInventoryProps {
    inventoryId: number
    onClose: () => void
    isOwner: boolean
}

export function ActiveInventory({ inventoryId, onClose, isOwner }: ActiveInventoryProps) {
    const params = useParams()
    const clubId = params.clubId as string

    const [inventory, setInventory] = useState<Inventory | null>(null)
    const [items, setItems] = useState<InventoryItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [isPending, startTransition] = useTransition()

    // Close Dialog State
    const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false)
    const [reportedRevenue, setReportedRevenue] = useState("")

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true)
            try {
                const [inv, invItems] = await Promise.all([
                    getInventory(inventoryId),
                    getInventoryItems(inventoryId)
                ])
                setInventory(inv)
                setItems(invItems)
            } catch (e) {
                console.error(e)
            } finally {
                setIsLoading(false)
            }
        }
        loadData()
    }, [inventoryId])

    const handleStockChange = (itemId: number, val: string) => {
        const numVal = val === "" ? null : parseInt(val)
        setItems(prev => prev.map(i => i.id === itemId ? { ...i, actual_stock: numVal } : i))
    }

    // Saves to server only when user leaves the field
    const handleBlur = async (itemId: number, val: number | null) => {
        try {
            await updateInventoryItem(itemId, val, clubId)
        } catch (e) {
            console.error("Failed to save item", e)
        }
    }

    const handleCloseInventory = async () => {
        // If owner didn't select a metric (metric is null), we don't need reported revenue
        const metricRequired = !!inventory?.target_metric_key
        if (metricRequired && !reportedRevenue) return

        startTransition(async () => {
            try {
                await closeInventory(inventoryId, clubId, metricRequired ? Number(reportedRevenue) : 0)
                setIsCloseDialogOpen(false)
                onClose() // Go back to list
            } catch (e) {
                console.error(e)
                alert("Ошибка при закрытии инвентаризации")
            }
        })
    }

    if (isLoading) {
        return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
    }

    if (!inventory) return <div>Инвентаризация не найдена</div>

    const isClosed = inventory.status === 'CLOSED'

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            Инвентаризация #{inventory.id}
                            {isClosed ? <Badge className="bg-green-500">Завершено</Badge> : <Badge className="bg-amber-500">В процессе</Badge>}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Начата: {new Date(inventory.started_at).toLocaleString()} 
                            {inventory.target_metric_key && (
                                <> | Метрика: <code className="bg-slate-100 px-1 rounded">{inventory.target_metric_key}</code></>
                            )}
                        </p>
                    </div>
                </div>
                {!isClosed && (
                    <Button onClick={() => setIsCloseDialogOpen(true)} variant="default" className="bg-green-600 hover:bg-green-700">
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        {inventory.target_metric_key ? "Завершить и сверить" : "Завершить подсчет"}
                    </Button>
                )}
            </div>

            {/* Main Content */}
            <Card>
                <CardHeader>
                    <CardTitle>Список товаров</CardTitle>
                    <CardDescription>
                        {isClosed 
                            ? "Результаты инвентаризации" 
                            : isOwner 
                                ? "Введите фактическое количество. Ожидаемый остаток показан для сверки."
                                : "Введите фактическое количество товара на полках. Система скрывает ожидаемый остаток для чистоты проверки."}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[40%]">Товар</TableHead>
                                <TableHead className="text-right">Цена продажи</TableHead>
                                {(isClosed || isOwner) && <TableHead className="text-right text-muted-foreground">Ожидалось</TableHead>}
                                <TableHead className="text-right w-[150px]">Фактический остаток</TableHead>
                                {isClosed && (
                                    <>
                                        <TableHead className="text-right">Разница (шт)</TableHead>
                                        {inventory.target_metric_key && <TableHead className="text-right">Разница (₽)</TableHead>}
                                    </>
                                )}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {items.map(item => {
                                const difference = (item.expected_stock || 0) - (item.actual_stock || 0) // Positive means sold/missing
                                const revenue = difference * item.selling_price_snapshot
                                
                                return (
                                    <TableRow key={item.id} className={isClosed && difference !== 0 ? "bg-slate-50" : ""}>
                                        <TableCell className="font-medium">{item.product_name}</TableCell>
                                        <TableCell className="text-right">{item.selling_price_snapshot} ₽</TableCell>
                                        
                                        {(isClosed || isOwner) && (
                                            <TableCell className="text-right text-muted-foreground">
                                                {item.expected_stock}
                                            </TableCell>
                                        )}

                                        <TableCell className="text-right">
                                            {isClosed ? (
                                                <span className="font-bold">{item.actual_stock}</span>
                                            ) : (
                                                <Input 
                                                    type="number" 
                                                    className="text-right w-24 ml-auto"
                                                    value={item.actual_stock === null ? "" : item.actual_stock}
                                                    onChange={(e) => handleStockChange(item.id, e.target.value)}
                                                    onBlur={(e) => handleBlur(item.id, e.target.value === "" ? null : Number(e.target.value))}
                                                    placeholder="0"
                                                />
                                            )}
                                        </TableCell>

                                        {isClosed && (
                                            <>
                                                <TableCell className="text-right">
                                                    <span className={difference > 0 ? "text-green-600" : difference < 0 ? "text-red-600" : "text-gray-400"}>
                                                        {difference > 0 ? `-${difference}` : `+${Math.abs(difference)}`} 
                                                    </span>
                                                </TableCell>
                                                {inventory.target_metric_key && (
                                                    <TableCell className="text-right font-bold">
                                                        {revenue.toLocaleString()} ₽
                                                    </TableCell>
                                                )}
                                            </>
                                        )}
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Close Dialog */}
            <Dialog open={isCloseDialogOpen} onOpenChange={setIsCloseDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Завершение инвентаризации</DialogTitle>
                        <DialogDescription>
                            {inventory.target_metric_key 
                                ? `Введите сумму из отчета (поле: ${inventory.target_metric_key}) для сверки.` 
                                : "Подтвердите обновление остатков на складе."}
                        </DialogDescription>
                    </DialogHeader>
                    
                    {inventory.target_metric_key && (
                        <div className="space-y-4 py-4">
                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                                <p className="text-sm text-blue-800 font-medium">Как это работает?</p>
                                <p className="text-xs text-blue-600 mt-1">
                                    Мы посчитаем разницу остатков (Было - Стало) и умножим на цену продажи.
                                    Полученная сумма должна совпасть с тем, что в кассе/отчете.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label>Сумма по отчету (₽)</Label>
                                <Input 
                                    type="number" 
                                    placeholder="0.00"
                                    value={reportedRevenue}
                                    onChange={e => setReportedRevenue(e.target.value)}
                                    className="text-lg font-bold"
                                />
                            </div>
                        </div>
                    )}

                    {!inventory.target_metric_key && (
                        <div className="py-4">
                            <p className="text-sm text-muted-foreground">
                                Остатки на складе будут обновлены в соответствии с введенными фактическими значениями.
                            </p>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCloseDialogOpen(false)}>Отмена</Button>
                        <Button onClick={handleCloseInventory} disabled={(!!inventory.target_metric_key && !reportedRevenue) || isPending} className="bg-green-600 hover:bg-green-700">
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {inventory.target_metric_key ? "Сверить и закрыть" : "Обновить остатки"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
