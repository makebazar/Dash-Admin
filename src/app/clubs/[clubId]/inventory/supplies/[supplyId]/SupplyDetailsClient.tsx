"use client"

import { useTransition } from "react"
import { ArrowLeft, Trash2, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PageShell } from "@/components/layout/PageShell"
import { useRouter } from "next/navigation"
import { deleteSupply, type Supply, type SupplyItem } from "../../actions"
import { useUiDialogs } from "../../_components/useUiDialogs"
import Link from "next/link"

interface SupplyDetailsProps {
    clubId: string
    supply: Supply
    items: SupplyItem[]
}

export function SupplyDetailsClient({ clubId, supply, items }: SupplyDetailsProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const { confirmAction, showMessage, Dialogs } = useUiDialogs()

    const handleDelete = async () => {
        const confirmed = await confirmAction({
            title: "Удаление поставки",
            description: "Вы уверены? Остатки товаров будут откатаны назад.",
            confirmText: "Удалить"
        })
        if (!confirmed) return
        
        startTransition(async () => {
            try {
                await deleteSupply(supply.id, clubId)
                router.push(`/clubs/${clubId}/inventory?tab=supplies`)
            } catch (e) {
                showMessage({ title: "Ошибка", description: e instanceof Error ? e.message : "Ошибка при удалении" })
            }
        })
    }

    return (
        <PageShell maxWidth="5xl" className="pb-24 md:pb-8">
            {/* Desktop Header */}
            <div className="mb-6 hidden md:block">
                <Link href={`/clubs/${clubId}/inventory?tab=supplies`} className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors mb-4">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Назад к поставкам
                </Link>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                                Поставка #{supply.id}
                            </h1>
                            {supply.status === 'DRAFT' ? (
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs px-2 py-0.5 uppercase font-black">Черновик</Badge>
                            ) : (
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs px-2 py-0.5 uppercase font-black">Проведено</Badge>
                            )}
                        </div>
                        <p className="text-sm text-slate-500">
                            {new Date(supply.created_at).toLocaleString('ru-RU')}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200" onClick={handleDelete} disabled={isPending}>
                            <Trash2 className="h-4 w-4 mr-2" /> Удалить
                        </Button>
                    </div>
                </div>
            </div>

            {/* Mobile Header */}
            <div className="mb-6 md:hidden">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                            Поставка #{supply.id}
                        </h1>
                        {supply.status === 'DRAFT' ? (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] px-2 py-0.5 uppercase font-black">Черновик</Badge>
                        ) : (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] px-2 py-0.5 uppercase font-black">Проведено</Badge>
                        )}
                    </div>
                    <p className="text-sm text-slate-500">
                        {new Date(supply.created_at).toLocaleString('ru-RU')}
                    </p>
                </div>
            </div>

            {/* Summary Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm">
                <div className="space-y-1">
                    <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Поставщик</p>
                    <p className="text-base sm:text-sm font-bold text-slate-900">{supply.supplier_name || "—"}</p>
                </div>
                <div className="space-y-1">
                    <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Сотрудник</p>
                    <p className="text-base sm:text-sm font-bold text-slate-900">{supply.created_by_name || "—"}</p>
                </div>
                <div className="space-y-1 sm:text-right">
                    <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Итоговая сумма</p>
                    <p className="text-2xl sm:text-xl font-black text-blue-600">{Number(supply.total_cost).toLocaleString('ru-RU')} ₽</p>
                </div>
                {supply.notes && (
                    <div className="col-span-1 sm:col-span-3 space-y-1 pt-2 mt-2 sm:mt-0 border-t border-slate-100 sm:border-t-0">
                        <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Заметки</p>
                        <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-xl italic border border-slate-100">
                            "{supply.notes.replace(/\s*\(Смена #[a-f0-9-]+\)/g, '')}"
                        </p>
                    </div>
                )}
            </div>

            {/* Items Table */}
            <div>
                <h4 className="font-bold text-base sm:text-sm mb-4 flex items-center gap-2 text-slate-900">
                    <Package className="h-5 w-5 sm:h-4 sm:w-4 text-slate-400" /> Состав поставки
                </h4>
                <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm bg-white">
                    {/* Desktop View */}
                    <div className="hidden sm:block">
                        <Table>
                            <TableHeader className="bg-slate-50 border-b border-slate-100">
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="text-[10px] uppercase font-bold text-slate-500">Товар</TableHead>
                                    <TableHead className="text-right text-[10px] uppercase font-bold text-slate-500">Кол-во</TableHead>
                                    <TableHead className="text-right text-[10px] uppercase font-bold text-slate-500">Цена за ед.</TableHead>
                                    <TableHead className="text-right text-[10px] uppercase font-bold text-slate-500">Сумма</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.map(item => (
                                    <TableRow key={item.id} className="hover:bg-slate-50/50">
                                        <TableCell className="font-bold text-slate-900 text-sm py-4">{item.product_name}</TableCell>
                                        <TableCell className="text-right py-4">
                                            <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-none font-mono font-bold">
                                                {item.quantity} шт
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right text-sm text-slate-500 font-medium py-4">{Number(item.cost_price).toLocaleString('ru-RU')} ₽</TableCell>
                                        <TableCell className="text-right font-black text-slate-900 py-4">{Number(item.total_cost).toLocaleString('ru-RU')} ₽</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Mobile View */}
                    <div className="sm:hidden divide-y divide-slate-100">
                        {items.map(item => (
                            <div key={item.id} className="p-4 flex flex-col gap-3">
                                <div className="flex justify-between items-start">
                                    <h5 className="font-bold text-slate-900 leading-tight">{item.product_name}</h5>
                                    <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-none font-mono font-bold whitespace-nowrap ml-2">
                                        {item.quantity} шт
                                    </Badge>
                                </div>
                                <div className="flex justify-between items-end mt-1">
                                    <div className="space-y-0.5">
                                        <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Цена за ед.</p>
                                        <p className="text-sm font-medium text-slate-500">{Number(item.cost_price).toLocaleString('ru-RU')} ₽</p>
                                    </div>
                                    <div className="text-right space-y-0.5">
                                        <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Сумма</p>
                                        <p className="text-base font-black text-slate-900">{Number(item.total_cost).toLocaleString('ru-RU')} ₽</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Mobile Bottom Actions (Sticky) */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] md:hidden z-50 flex items-center justify-between gap-3">
                <Button variant="outline" className="flex-1 bg-slate-50 border-slate-200" onClick={() => router.push(`/clubs/${clubId}/inventory?tab=supplies`)}>
                    <ArrowLeft className="h-4 w-4 mr-2" /> Назад
                </Button>
                <Button variant="outline" className="flex-1 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 bg-white" onClick={handleDelete} disabled={isPending}>
                    <Trash2 className="h-4 w-4 mr-2" /> Удалить
                </Button>
            </div>
            {Dialogs}
        </PageShell>
    )
}
