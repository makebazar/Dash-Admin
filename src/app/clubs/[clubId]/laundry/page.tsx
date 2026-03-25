"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import { ArrowLeft, Loader2, RotateCcw, Shirt, Sparkles, CheckCircle2, XCircle, MapPin, User } from "lucide-react"
import { PageShell, PageHeader, PageToolbar, ToolbarGroup } from "@/components/layout/PageShell"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

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
        <PageShell maxWidth="6xl">
            <PageHeader
                title="Стирка"
                description="Очередь ковриков, которые попали на обработку из обслуживания и центра проверок"
            >
                <Link href={`/clubs/${clubId}/equipment/maintenance`}>
                    <Button variant="outline">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Назад
                    </Button>
                </Link>
            </PageHeader>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <Card className="border-none shadow-sm">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <Shirt className="h-5 w-5 text-slate-500" />
                            <Badge variant="outline">Всего</Badge>
                        </div>
                        <div className="mt-4 text-3xl font-bold">{stats.total}</div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <Sparkles className="h-5 w-5 text-amber-500" />
                            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Новые</Badge>
                        </div>
                        <div className="mt-4 text-3xl font-bold">{stats.newCount}</div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <Loader2 className="h-5 w-5 text-blue-500" />
                            <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">В стирке</Badge>
                        </div>
                        <div className="mt-4 text-3xl font-bold">{stats.inLaundryCount}</div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <CheckCircle2 className="h-5 w-5 text-violet-500" />
                            <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100">Готово</Badge>
                        </div>
                        <div className="mt-4 text-3xl font-bold">{stats.readyCount}</div>
                    </CardContent>
                </Card>
            </div>

            <Tabs value={tab} onValueChange={(value) => setTab(value as 'active' | 'history')} className="w-full">
                <div className="border-b">
                    <TabsList className="bg-transparent h-auto p-0 space-x-6">
                        <TabsTrigger value="active" variant="underline" className="pb-3 rounded-none">
                            Активные
                        </TabsTrigger>
                        <TabsTrigger value="history" variant="underline" className="pb-3 rounded-none">
                            История
                        </TabsTrigger>
                    </TabsList>
                </div>
            </Tabs>

            <PageToolbar>
                <ToolbarGroup>
                    <div className="text-sm text-muted-foreground">
                        Показано: <span className="font-medium text-foreground">{requests.length}</span>
                    </div>
                </ToolbarGroup>
                <ToolbarGroup align="end">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => fetchRequests(tab)}
                        disabled={isLoading}
                    >
                        <RotateCcw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                    </Button>
                </ToolbarGroup>
            </PageToolbar>

            {isLoading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            ) : requests.length === 0 ? (
                <div className="rounded-xl border border-dashed bg-muted/10 py-12 text-center text-muted-foreground">
                    <Shirt className="mx-auto mb-4 h-12 w-12 opacity-40" />
                    <h3 className="text-lg font-medium text-foreground">Пусто</h3>
                    <p>{tab === 'active' ? 'Нет ковриков в активной очереди стирки.' : 'История стирки пока пустая.'}</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {requests.map((item) => (
                        <Card key={item.id} className="border-none shadow-sm">
                            <CardContent className="p-5">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="min-w-0 space-y-3">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="text-lg font-semibold">{item.equipment_name}</h3>
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
                                            <div className="text-xs text-muted-foreground">
                                                Фото: {item.photos.length}
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
                                                    onClick={() => handleStatusUpdate(item.id, 'SENT_TO_LAUNDRY')}
                                                    disabled={updatingId === item.id}
                                                >
                                                    Отправили в стирку
                                                </Button>
                                            )}
                                            {item.status === 'SENT_TO_LAUNDRY' && (
                                                <Button
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
                                                    className="bg-green-600 hover:bg-green-700"
                                                >
                                                    Вернули сотруднику
                                                </Button>
                                            )}
                                            <Button
                                                variant="outline"
                                                className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                                onClick={() => handleStatusUpdate(item.id, 'CANCELLED')}
                                                disabled={updatingId === item.id}
                                            >
                                                <XCircle className="mr-2 h-4 w-4" />
                                                Отменить
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </PageShell>
    )
}
