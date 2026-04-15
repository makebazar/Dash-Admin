"use client"

import { useState, useTransition } from "react"
import { ArrowLeft, Calculator, Package, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PageShell } from "@/components/layout/PageShell"
import { useRouter } from "next/navigation"
import { generateProcurementList } from "../../actions"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { useUiDialogs } from "../../_components/useUiDialogs"

interface NewProcurementClientProps {
    clubId: string
    currentUserId: string
}

export function NewProcurementClient({ clubId, currentUserId }: NewProcurementClientProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const { showMessage } = useUiDialogs()

    const [procurementMode, setProcurementMode] = useState<"optimized" | "full">("optimized")

    const handleGenerate = async () => {
        startTransition(async () => {
            try {
                const listId = await generateProcurementList(clubId, currentUserId, procurementMode)
                // Optionally redirect to the newly created list details page if we have one. 
                // For now we go back to the procurement tab, and user can click it.
                router.push(`/clubs/${clubId}/inventory?tab=procurement`)
                router.refresh()
            } catch (e) {
                console.error(e)
                showMessage({ title: "Ошибка", description: "Ошибка при создании списка" })
            }
        })
    }

    return (
        <PageShell maxWidth="3xl" className="pb-24 md:pb-8">
            <div className="mb-6">
                <Link href={`/clubs/${clubId}/inventory?tab=procurement`} className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors mb-4">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Назад к спискам закупок
                </Link>
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                        Сформировать заказ
                    </h1>
                    <p className="text-sm text-slate-500 max-w-xl">
                        Выбери стратегию: экономный список только по ключевым позициям или расширенное пополнение всего ассортимента.
                    </p>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6 p-4 sm:p-6 space-y-4">
                <button
                    type="button"
                    onClick={() => setProcurementMode("optimized")}
                    className={cn(
                        "w-full rounded-2xl border p-5 sm:p-6 text-left transition-all relative overflow-hidden",
                        procurementMode === "optimized" ? "border-blue-500 bg-blue-50/50 shadow-sm" : "border-slate-200 bg-white hover:bg-slate-50"
                    )}
                >
                    {procurementMode === "optimized" && (
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500" />
                    )}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="pr-4">
                            <p className="font-bold text-slate-900 text-lg">Жёстко оптимизированная</p>
                            <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">
                                Фокус на категориях A/B. Категория C вообще не попадает в автозакупку.
                            </p>
                        </div>
                        <Badge className="bg-blue-100 text-blue-700 border-none font-bold text-xs uppercase px-3 py-1 self-start sm:self-center shrink-0">
                            Экономно
                        </Badge>
                    </div>
                </button>

                <button
                    type="button"
                    onClick={() => setProcurementMode("full")}
                    className={cn(
                        "w-full rounded-2xl border p-5 sm:p-6 text-left transition-all relative overflow-hidden",
                        procurementMode === "full" ? "border-blue-500 bg-blue-50/50 shadow-sm" : "border-slate-200 bg-white hover:bg-slate-50"
                    )}
                >
                    {procurementMode === "full" && (
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500" />
                    )}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="pr-4">
                            <p className="font-bold text-slate-900 text-lg">Полное пополнение</p>
                            <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">
                                Шире покрывает категории A/B/C и подходит, когда нужно восстановить ассортимент.
                            </p>
                        </div>
                        <Badge className="bg-slate-100 text-slate-700 border-none font-bold text-xs uppercase px-3 py-1 self-start sm:self-center shrink-0">
                            Шире список
                        </Badge>
                    </div>
                </button>
            </div>

            {/* Desktop Actions */}
            <div className="hidden md:flex justify-end gap-3">
                <Button variant="outline" onClick={() => router.push(`/clubs/${clubId}/inventory?tab=procurement`)} className="h-12 px-6 border-slate-200">Отмена</Button>
                <Button onClick={handleGenerate} disabled={isPending} className="h-12 px-8 bg-blue-600 hover:bg-blue-700 text-base font-medium">
                    {isPending ? <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> : <Calculator className="mr-2 h-5 w-5" />}
                    Создать список
                </Button>
            </div>

            {/* Mobile Bottom Actions (Sticky) */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] md:hidden z-50 flex items-center gap-3">
                <Button variant="outline" className="flex-1 bg-slate-50 border-slate-200 h-12" onClick={() => router.push(`/clubs/${clubId}/inventory?tab=procurement`)}>
                    Отмена
                </Button>
                <Button onClick={handleGenerate} disabled={isPending} className="flex-[2] bg-blue-600 hover:bg-blue-700 h-12 text-base">
                    {isPending ? <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> : <Calculator className="mr-2 h-5 w-5" />}
                    Создать
                </Button>
            </div>
        </PageShell>
    )
}
