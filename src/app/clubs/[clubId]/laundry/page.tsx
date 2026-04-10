"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import { ArrowLeft, ChevronLeft, Loader2, RotateCcw, Shirt, Sparkles, CheckCircle2, XCircle, MapPin, User } from "lucide-react"
import { PageShell } from "@/components/layout/PageShell"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface LaundryRequest {
    id: string
    equipment_id: string
    equipment_name: string
    equipment_type: string
    equipment_type_name: string | null
    workstation_name: string | null
    zone_name: string | null
    requested_by_name: string | null
    processed_by_name: string | null
    source: 'EMPLOYEE_SERVICE' | 'INSPECTION_CENTER'
    status: 'NEW' | 'SENT_TO_LAUNDRY' | 'READY_FOR_RETURN' | 'RETURNED' | 'CANCELLED'
    title: string
    description: string | null
    photos: string[] | null
    created_at: string
    completed_at: string | null
}

const statusMeta: Record<LaundryRequest["status"], { label: string; className: string }> = {
    NEW: { label: "Новая", className: "bg-amber-100 text-amber-700 border-amber-200" },
    SENT_TO_LAUNDRY: { label: "В стирке", className: "bg-blue-100 text-blue-700 border-blue-200" },
    READY_FOR_RETURN: { label: "Готов к возврату", className: "bg-violet-100 text-violet-700 border-violet-200" },
    RETURNED: { label: "Возвращен", className: "bg-green-100 text-green-700 border-green-200" },
    CANCELLED: { label: "Отменен", className: "bg-slate-100 text-slate-700 border-slate-200" },
}

const sourceLabels: Record<LaundryRequest["source"], string> = {
    EMPLOYEE_SERVICE: "Обслуживание",
    INSPECTION_CENTER: "Центр проверок",
}

export default function LaundryPage() {
    const { clubId } = useParams<{ clubId: string }>()
    const [tab, setTab] = useState<'active' | 'history'>('active')
    const [requests, setRequests] = useState<LaundryRequest[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [updatingId, setUpdatingId] = useState<string | null>(null)
    const [viewingPhotos, setViewingPhotos] = useState<string[] | null>(null)

    const fetchRequests = async (nextTab = tab) => {
        setIsLoading(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/laundry?status=${nextTab}`, { cache: 'no-store' })
            if (res.ok) {
                const data = await res.json()
                setRequests(Array.isArray(data) ? data : [])
            }
        } catch (error) {
            console.error("Error fetching laundry requests:", error)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        if (clubId) {
            fetchRequests(tab)
        }
    }, [clubId, tab])

    const handleStatusUpdate = async (requestId: string, status: LaundryRequest["status"]) => {
        setUpdatingId(requestId)
        try {
            const res = await fetch(`/api/clubs/${clubId}/laundry/${requestId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status })
            })

            if (res.ok) {
                if (tab === 'active' && (status === 'RETURNED' || status === 'CANCELLED')) {
                    setRequests(prev => prev.filter(item => item.id !== requestId))
                } else {
                    const updated = await res.json()
                    setRequests(prev => prev.map(item => item.id === requestId ? { ...item, ...updated } : item))
                }
            } else {
                alert("Не удалось обновить статус")
            }
        } catch (error) {
            console.error("Error updating laundry request:", error)
            alert("Произошла ошибка")
        } finally {
            setUpdatingId(null)
        }
    }

    const stats = useMemo(() => ({
        total: requests.length,
        newCount: requests.filter(item => item.status === 'NEW').length,
        inLaundryCount: requests.filter(item => item.status === 'SENT_TO_LAUNDRY').length,
        readyCount: requests.filter(item => item.status === 'READY_FOR_RETURN').length,
    }), [requests])

    return (
        <PageShell maxWidth="5xl">
            <div className="space-y-8 pb-28 sm:pb-12">
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between mb-8">
                    <div className="min-w-0">
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 truncate">Стирка</h1>
                        <p className="text-slate-500 text-lg mt-2">Очередь ковриков, которые попали на обработку из обслуживания и центра проверок</p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:justify-end">
                        <Button asChild variant="outline" className="hidden md:inline-flex md:w-auto rounded-xl h-11 px-6 font-medium">
                            <Link href={`/clubs/${clubId}/equipment`}>
                                <ChevronLeft className="mr-2 h-4 w-4" />
                                Назад
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6 flex flex-col justify-between h-[140px]">
                    <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-slate-500 leading-tight">Всего</p>
                        <div className="rounded-2xl bg-slate-100 p-2.5 text-slate-700 shrink-0">
                            <Shirt className="h-5 w-5" />
                        </div>
                    </div>
                    <h3 className="text-3xl font-bold text-slate-900">{stats.total}</h3>
                </div>
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6 flex flex-col justify-between h-[140px]">
                    <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-slate-500 leading-tight">Новые</p>
                        <div className="rounded-2xl bg-amber-50 p-2.5 text-amber-600 shrink-0">
                            <Sparkles className="h-5 w-5" />
                        </div>
                    </div>
                    <h3 className="text-3xl font-bold text-amber-600">{stats.newCount}</h3>
                </div>
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6 flex flex-col justify-between h-[140px]">
                    <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-slate-500 leading-tight">В стирке</p>
                        <div className="rounded-2xl bg-blue-50 p-2.5 text-blue-600 shrink-0">
                            <Loader2 className="h-5 w-5" />
                        </div>
                    </div>
                    <h3 className="text-3xl font-bold text-blue-600">{stats.inLaundryCount}</h3>
                </div>
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6 flex flex-col justify-between h-[140px]">
                    <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-slate-500 leading-tight">Готово</p>
                        <div className="rounded-2xl bg-violet-50 p-2.5 text-violet-600 shrink-0">
                            <CheckCircle2 className="h-5 w-5" />
                        </div>
                    </div>
                    <h3 className="text-3xl font-bold text-violet-600">{stats.readyCount}</h3>
                </div>
            </div>

            <div className="flex justify-between items-end mb-6 border-b border-slate-200">
                <Tabs value={tab} onValueChange={(value) => setTab(value as 'active' | 'history')} className="w-full">
                    <TabsList className="flex h-auto w-full justify-start gap-8 overflow-x-auto rounded-none bg-transparent p-0">
                        <TabsTrigger value="active" className="relative shrink-0 rounded-none border-b-2 border-transparent px-0 pb-4 pt-2 font-medium text-slate-500 hover:text-slate-700 data-[state=active]:border-slate-900 data-[state=active]:text-slate-900 data-[state=active]:shadow-none data-[state=active]:bg-transparent transition-all">
                            Активные
                        </TabsTrigger>
                        <TabsTrigger value="history" className="relative shrink-0 rounded-none border-b-2 border-transparent px-0 pb-4 pt-2 font-medium text-slate-500 hover:text-slate-700 data-[state=active]:border-slate-900 data-[state=active]:text-slate-900 data-[state=active]:shadow-none data-[state=active]:bg-transparent transition-all">
                            История
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
                <div className="flex items-center gap-4 mb-2 shrink-0 pl-4">
                    <div className="text-sm text-slate-500 hidden sm:block whitespace-nowrap">
                        Показано: <span className="font-medium text-slate-900">{requests.length}</span>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                        onClick={() => fetchRequests(tab)}
                        disabled={isLoading}
                    >
                        <RotateCcw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                    </Button>
                </div>
            </div>

            

            {isLoading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            ) : requests.length === 0 ? (
                <div className="border-dashed border-2 border-slate-200 rounded-3xl bg-slate-50/50 py-16 text-center text-slate-500">
                    <Shirt className="mx-auto mb-4 h-12 w-12 opacity-40" />
                    <h3 className="text-lg font-bold text-slate-900">Пусто</h3>
                    <p>{tab === 'active' ? 'Нет ковриков в активной очереди стирки.' : 'История стирки пока пустая.'}</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {requests.map((item) => (
                        <div key={item.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="min-w-0 space-y-3">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="text-xl font-bold text-slate-900">{item.equipment_name}</h3>
                                            <Badge variant="outline">{item.equipment_type_name || item.equipment_type}</Badge>
                                            <Badge className={statusMeta[item.status].className}>{statusMeta[item.status].label}</Badge>
                                            <Badge variant="secondary">{sourceLabels[item.source]}</Badge>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                                            {item.workstation_name && (
                                                <span className="inline-flex items-center gap-1">
                                                    <MapPin className="h-3.5 w-3.5" />
                                                    {item.workstation_name}{item.zone_name ? ` · ${item.zone_name}` : ""}
                                                </span>
                                            )}
                                            {item.requested_by_name && (
                                                <span className="inline-flex items-center gap-1">
                                                    <User className="h-3.5 w-3.5" />
                                                    {item.requested_by_name}
                                                </span>
                                            )}
                                            <span>{format(new Date(item.created_at), 'dd.MM.yyyy HH:mm', { locale: ru })}</span>
                                        </div>

                                        <div className="space-y-1">
                                            <div className="text-sm font-medium text-foreground">{item.title}</div>
                                            {item.description && (
                                                <p className="text-sm text-muted-foreground">{item.description}</p>
                                            )}
                                        </div>

                                        {item.photos && item.photos.length > 0 && (
                                            <div className="flex flex-wrap gap-2 pt-2">
                                                {item.photos.map((photo, i) => (
                                                    <button
                                                        key={i}
                                                        type="button"
                                                        onClick={() => setViewingPhotos(item.photos)}
                                                        className="relative h-16 w-16 overflow-hidden rounded-xl border border-slate-200 transition-all hover:ring-2 hover:ring-slate-400 hover:ring-offset-2"
                                                    >
                                                        <img
                                                            src={photo}
                                                            alt={`Фото ${i + 1}`}
                                                            className="h-full w-full object-cover"
                                                        />
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {item.processed_by_name && (
                                            <div className="text-xs text-muted-foreground">
                                                Последнее изменение: {item.processed_by_name}
                                            </div>
                                        )}
                                    </div>

                                    {tab === 'active' && (
                                        <div className="flex flex-col gap-2 lg:w-[220px]">
                                            {item.status === 'NEW' && (
                                                <Button
                                                    className="w-full sm:w-auto rounded-xl h-11 px-6 font-medium bg-slate-900 text-white hover:bg-slate-800"
                                                    onClick={() => handleStatusUpdate(item.id, 'SENT_TO_LAUNDRY')}
                                                    disabled={updatingId === item.id}
                                                >
                                                    Отправили в стирку
                                                </Button>
                                            )}
                                            {item.status === 'SENT_TO_LAUNDRY' && (
                                                <Button
                                                    className="w-full sm:w-auto rounded-xl h-11 px-6 font-medium bg-slate-900 text-white hover:bg-slate-800"
                                                    onClick={() => handleStatusUpdate(item.id, 'READY_FOR_RETURN')}
                                                    disabled={updatingId === item.id}
                                                >
                                                    Готов к возврату
                                                </Button>
                                            )}
                                            {item.status === 'READY_FOR_RETURN' && (
                                                <Button
                                                    onClick={() => handleStatusUpdate(item.id, 'RETURNED')}
                                                    disabled={updatingId === item.id}
                                                    className="w-full sm:w-auto rounded-xl h-11 px-6 font-medium bg-green-600 hover:bg-green-700 text-white"
                                                >
                                                    Вернули сотруднику
                                                </Button>
                                            )}
                                            <Button
                                                variant="outline"
                                                className="w-full sm:w-auto rounded-xl h-11 px-6 font-medium border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                                                onClick={() => handleStatusUpdate(item.id, 'CANCELLED')}
                                                disabled={updatingId === item.id}
                                            >
                                                <XCircle className="mr-2 h-4 w-4" />
                                                Отменить
                                            </Button>
                                        </div>
                                    )}
                                </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Mobile Bottom Back Button */}
            <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/80 p-4 backdrop-blur-xl md:hidden pb-[calc(1rem+env(safe-area-inset-bottom))]">
                <div className="mx-auto flex max-w-[1600px] gap-2">
                    <Button asChild variant="outline" className="flex-1 h-12 rounded-xl border-slate-200 text-slate-700 bg-white font-medium">
                        <Link href={`/clubs/${clubId}/equipment`}>
                            <ChevronLeft className="mr-2 h-4 w-4" />
                            Назад
                        </Link>
                    </Button>
                </div>
            </div>

            <Dialog open={!!viewingPhotos} onOpenChange={(open) => !open && setViewingPhotos(null)}>
                <DialogContent className="sm:max-w-3xl p-0 overflow-hidden bg-black/95 border-none rounded-3xl">
                    <DialogHeader className="absolute top-0 left-0 right-0 z-10 p-4 bg-gradient-to-b from-black/60 to-transparent">
                        <DialogTitle className="text-white">Фотографии</DialogTitle>
                    </DialogHeader>
                    <div className="relative h-[80vh] w-full flex items-center justify-center p-4">
                        {viewingPhotos && (
                            <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory w-full h-full pb-4">
                                {viewingPhotos.map((photo, i) => (
                                    <div key={i} className="relative flex-none w-full h-full snap-center flex items-center justify-center">
                                        <img
                                            src={photo}
                                            alt={`Фото ${i + 1}`}
                                            className="max-w-full max-h-full object-contain rounded-xl"
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

        </div>
        </PageShell>
    )
}
