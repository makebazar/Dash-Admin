"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Loader2, Calendar, Clock, DollarSign, ChevronLeft } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface Shift {
    id: string
    check_in: string
    check_out: string
    total_hours: number
    earnings: number
    status: string
    shift_type: string
}

export default function ShiftHistoryPage() {
    const params = useParams()
    const clubId = params.clubId as string
    const [shifts, setShifts] = useState<Shift[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        if (clubId) {
            fetchHistory()
        }
    }, [clubId])

    const fetchHistory = async () => {
        try {
            const res = await fetch(`/api/employee/clubs/${clubId}/history`)
            const data = await res.json()
            if (res.ok) {
                setShifts(data.shifts)
            }
        } catch (error) {
            console.error('Error fetching history:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('ru-RU', {
            style: 'decimal',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount) + ' ₽'
    }

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        })
    }

    const formatTime = (dateStr: string) => {
        return new Date(dateStr).toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'PAID':
                return <Badge className="bg-emerald-500 hover:bg-emerald-600">Оплачено</Badge>
            case 'VERIFIED':
                return <Badge className="bg-blue-500 hover:bg-blue-600">Проверено</Badge>
            case 'CLOSED':
                return <Badge variant="outline" className="border-slate-400">Закрыта</Badge>
            default:
                return <Badge variant="secondary">{status}</Badge>
        }
    }

    if (isLoading) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
            </div>
        )
    }

    return (
        <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <Link
                        href={`/employee/clubs/${clubId}`}
                        className="text-sm text-muted-foreground flex items-center hover:text-purple-600 transition-colors mb-2"
                    >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Вернуться в кабинет
                    </Link>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                        История смен
                    </h1>
                    <p className="text-muted-foreground">Просмотр всех завершенных рабочих сессий</p>
                </div>
            </div>

            {/* Content */}
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
                            <Calendar className="h-5 w-5 text-purple-600" />
                            Последние 50 смен
                        </CardTitle>
                        <div className="text-xs text-muted-foreground font-medium">
                            Всего: {shifts.length}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent border-slate-100">
                                    <TableHead className="w-[180px] font-bold text-slate-800">Дата</TableHead>
                                    <TableHead className="w-[150px] font-bold text-slate-800">Время</TableHead>
                                    <TableHead className="font-bold text-slate-800">Часы</TableHead>
                                    <TableHead className="font-bold text-slate-800">Заработано</TableHead>
                                    <TableHead className="font-bold text-slate-800">Статус</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {shifts.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                                            У вас еще нет завершенных смен
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    shifts.map((shift) => (
                                        <TableRow key={shift.id} className="group border-slate-50 hover:bg-slate-50/50 transition-colors">
                                            <TableCell className="font-medium">
                                                <div className="flex flex-col">
                                                    <span className="text-slate-900">{formatDate(shift.check_in)}</span>
                                                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">
                                                        {shift.shift_type === 'night' ? 'Ночная смена' : 'Дневная смена'}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1.5 text-slate-600">
                                                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                                                    <span className="text-sm">
                                                        {formatTime(shift.check_in)} – {shift.check_out ? formatTime(shift.check_out) : '...'}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className="font-bold text-slate-700">
                                                    {shift.total_hours ? shift.total_hours.toFixed(1) : '–'} ч
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1">
                                                    <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                                                    <span className="font-black text-emerald-600">
                                                        {formatCurrency(shift.earnings || 0)}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {getStatusBadge(shift.status)}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
