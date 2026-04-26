import Link from "next/link"
import { PageShell } from "@/components/layout/PageShell"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

export function InventoryErrorState({
    clubId,
    title = "Ошибка склада",
    message,
}: {
    clubId: string
    title?: string
    message: string
}) {
    return (
        <PageShell maxWidth="7xl">
            <div className="mx-auto max-w-2xl py-16">
                <div className="rounded-3xl border border-rose-200 bg-rose-50/60 p-8 text-slate-900">
                    <div className="flex items-start gap-4">
                        <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
                            <AlertTriangle className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h2 className="text-xl font-bold">{title}</h2>
                            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{message}</p>
                            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                                <Button asChild className="rounded-xl bg-slate-900 text-white hover:bg-slate-800">
                                    <Link href={`/clubs/${clubId}/inventory`}>
                                        <RefreshCw className="mr-2 h-4 w-4" />
                                        Обновить страницу
                                    </Link>
                                </Button>
                                <Button asChild variant="outline" className="rounded-xl border-slate-200">
                                    <Link href={`/clubs/${clubId}`}>
                                        В клуб
                                    </Link>
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </PageShell>
    )
}

