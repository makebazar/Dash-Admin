"use client"

import Link from "next/link"
import { ArrowRight, AlertTriangle, AlertCircle, CheckCircle2, Clock, FileText, ChevronLeft, ChevronRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import type { ShiftZoneOverview } from "../actions"

type ShiftZonesOverviewTabProps = {
    clubId: string
    overview: ShiftZoneOverview
    currentMonth?: string
}

function formatDateTime(value: string | null) {
    if (!value) return "—"
    return new Date(value).toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    })
}

function getShiftStatusUi(status: string, hasDiscrepancy: boolean) {
    if (status === 'COMPLETE') {
        if (hasDiscrepancy) {
            return { label: "Сдал с расхождениями", className: "bg-amber-50 text-amber-700 border-amber-200", icon: AlertTriangle }
        }
        return { label: "Сдал чисто", className: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 }
    }
    if (status === 'OPEN_ONLY') {
        return { label: "Принял смену (В работе)", className: "bg-blue-50 text-blue-700 border-blue-200", icon: Clock }
    }
    if (status === 'CLOSE_ONLY') {
        return { label: "Сдал без приемки", className: "bg-rose-50 text-rose-700 border-rose-200", icon: AlertCircle }
    }
    return { label: "Передача не завершена", className: "bg-slate-50 text-slate-700 border-slate-200", icon: FileText }
}

export function ShiftZonesOverviewTab({ clubId, overview, currentMonth }: ShiftZonesOverviewTabProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    // Determine current display month
    const defaultMonth = (() => {
        const now = new Date()
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    })()
    const displayMonth = currentMonth || defaultMonth

    const [yearStr, monthStr] = displayMonth.split('-')
    const displayDate = new Date(Number(yearStr), Number(monthStr) - 1)
    const formattedMonth = displayDate.toLocaleString('ru-RU', { month: 'long', year: 'numeric' })
    const capitalizedMonth = formattedMonth.charAt(0).toUpperCase() + formattedMonth.slice(1)

    const navigateMonth = (direction: 'prev' | 'next') => {
        const date = new Date(Number(yearStr), Number(monthStr) - 1)
        if (direction === 'prev') {
            date.setMonth(date.getMonth() - 1)
        } else {
            date.setMonth(date.getMonth() + 1)
        }
        const newVal = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        
        const newParams = new URLSearchParams(searchParams.toString())
        newParams.set('month', newVal)
        newParams.set('tab', 'zones')
        router.push(`${pathname}?${newParams.toString()}`, { scroll: false })
    }
    // Выделяем проблемные смены (где есть расхождения, либо сдана без приемки, либо передача сломана)
    const problematicShifts = overview.recent_shifts.filter(s => 
        s.discrepancy_items_count > 0 || s.status === 'CLOSE_ONLY' || s.status === 'PARTIAL'
    )
    
    // Обычные смены — это те, которые не попали в проблемные
    const normalShifts = overview.recent_shifts.filter(s => !problematicShifts.includes(s))

    const activeShiftsCount = overview.recent_shifts.filter(s => s.status === 'OPEN_ONLY').length
    const discrepancyCount = overview.summary.discrepancy_shifts_count

    const getHandoverContext = (shift: typeof overview.recent_shifts[0]) => {
        const index = overview.recent_shifts.findIndex(s => s.shift_id === shift.shift_id)
        const prevShift = overview.recent_shifts[index + 1]
        const nextShift = overview.recent_shifts[index - 1]

        const acceptedFrom = prevShift ? prevShift.employee_name : "—"
        let handedOverTo = "—"
        
        if (shift.status === 'OPEN_ONLY' || shift.status === 'PARTIAL') {
            handedOverTo = "Смена идет"
        } else if (shift.status === 'COMPLETE' || shift.status === 'CLOSE_ONLY') {
            handedOverTo = nextShift ? nextShift.employee_name : "Ожидает приемки"
        }

        return { acceptedFrom, handedOverTo }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card p-4 sm:p-6 rounded-2xl border shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500" />
                <div className="pl-2">
                    <h3 className="text-xl font-black text-foreground">Журнал передач смен</h3>
                    <p className="text-sm text-muted-foreground mt-1 max-w-md">Контроль приемки и сдачи остатков. Кто дежурил, когда сдал, и какие были расхождения.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto items-stretch sm:items-center">
                    <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-sm flex-1 sm:flex-none w-full sm:w-[200px]">
                        <button 
                            onClick={() => navigateMonth('prev')}
                            className="p-2.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none focus:bg-slate-100 active:bg-slate-200"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <span className="text-sm font-bold text-slate-700 px-2 select-none">
                            {capitalizedMonth}
                        </span>
                        <button 
                            onClick={() => navigateMonth('next')}
                            className="p-2.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none focus:bg-slate-100 active:bg-slate-200"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                    <div className="flex gap-3 w-full sm:w-auto">
                        <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-2 flex flex-col items-end flex-1 sm:flex-none">
                            <span className="text-[10px] uppercase font-black tracking-widest text-amber-600 mb-0.5">С расхождениями</span>
                            <span className="text-xl font-black text-amber-700">{discrepancyCount}</span>
                        </div>
                        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2 flex flex-col items-end flex-1 sm:flex-none">
                            <span className="text-[10px] uppercase font-black tracking-widest text-blue-600 mb-0.5">В работе</span>
                            <span className="text-xl font-black text-blue-700">{activeShiftsCount}</span>
                        </div>
                    </div>
                </div>
            </div>

            {problematicShifts.length > 0 && (
                <div className="space-y-3">
                    <h4 className="text-sm font-bold uppercase tracking-widest text-rose-600 flex items-center gap-2 ml-1">
                        <AlertCircle className="h-4 w-4" />
                        Требуют внимания
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {problematicShifts.map(shift => {
                            const hasDiscrepancy = shift.discrepancy_items_count > 0
                            const statusUI = getShiftStatusUi(shift.status, hasDiscrepancy)
                            const StatusIcon = statusUI.icon
                            const { acceptedFrom, handedOverTo } = getHandoverContext(shift)
                            
                            return (
                                <Link key={shift.shift_id} href={`/clubs/${clubId}/inventory/handovers/${shift.shift_id}`} className="block group">
                                    <div className="bg-white rounded-2xl border border-rose-100 p-4 shadow-sm hover:shadow-md hover:border-rose-300 transition-all relative overflow-hidden h-full flex flex-col">
                                        <div className="absolute top-0 left-0 w-1 h-full bg-rose-500" />
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">
                                                    {formatDateTime(shift.check_in)}
                                                </span>
                                                <span className="text-base font-black text-slate-900">{shift.employee_name}</span>
                                            </div>
                                            <Badge variant="outline" className={cn("text-[10px] px-2 border-none font-bold uppercase shrink-0 text-right", statusUI.className)}>
                                                <StatusIcon className="h-3 w-3 mr-1" />
                                                {statusUI.label}
                                            </Badge>
                                        </div>

                                        <div className="flex flex-col gap-1.5 mb-4 mt-2">
                                            <div className="flex justify-between items-center bg-slate-50 rounded-md px-3 py-1.5">
                                                <span className="text-[10px] text-slate-500 font-bold uppercase">Принял от:</span>
                                                <span className="text-xs font-black text-slate-700">{acceptedFrom}</span>
                                            </div>
                                            <div className="flex justify-between items-center bg-slate-50 rounded-md px-3 py-1.5">
                                                <span className="text-[10px] text-slate-500 font-bold uppercase">Передал:</span>
                                                <span className="text-xs font-black text-slate-700">{handedOverTo}</span>
                                            </div>
                                        </div>
                                        
                                        <div className="mt-auto pt-3 border-t border-slate-50 flex justify-between items-end">
                                            {hasDiscrepancy ? (
                                                <div>
                                                    <p className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-1">Расхождения</p>
                                                    <p className="text-sm font-black text-rose-600">{shift.discrepancy_items_count} поз. ({shift.discrepancy_total_abs} шт)</p>
                                                </div>
                                            ) : (
                                                <div>
                                                    <p className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-1">Ошибка передачи</p>
                                                    <p className="text-xs font-bold text-amber-600">Нарушен цикл сдачи</p>
                                                </div>
                                            )}
                                            <div className="h-8 w-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-rose-50 transition-colors">
                                                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-rose-600" />
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            )
                        })}
                    </div>
                </div>
            )}

            <div className="space-y-3">
                <h4 className="text-sm font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2 ml-1">
                    <FileText className="h-4 w-4" />
                    История смен
                </h4>
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    {normalShifts.length === 0 && problematicShifts.length === 0 ? (
                        <div className="px-6 py-14 text-center text-sm text-muted-foreground italic">
                            Пока нет ни одной записи о передаче остатков.
                        </div>
                    ) : normalShifts.length === 0 ? (
                        <div className="px-6 py-14 text-center text-sm text-muted-foreground italic bg-slate-50/50">
                            Все недавние смены отображены в блоке "Требуют внимания".
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {/* Desktop Header */}
                            <div className="hidden lg:grid grid-cols-12 gap-4 p-4 bg-slate-50 border-b border-slate-100 text-[10px] uppercase font-black text-slate-500 tracking-wider items-center">
                                <div className="col-span-3 pl-2">Сотрудник (Смена)</div>
                                <div className="col-span-2">Принял от</div>
                                <div className="col-span-2">Передал</div>
                                <div className="col-span-4">Статус</div>
                                <div className="col-span-1 text-right pr-2">Детали</div>
                            </div>
                            
                            {/* Rows */}
                            {normalShifts.map(shift => {
                                const hasDiscrepancy = shift.discrepancy_items_count > 0
                                const statusUI = getShiftStatusUi(shift.status, hasDiscrepancy)
                                const StatusIcon = statusUI.icon
                                const { acceptedFrom, handedOverTo } = getHandoverContext(shift)
                                
                                return (
                                    <Link key={shift.shift_id} href={`/clubs/${clubId}/inventory/handovers/${shift.shift_id}`} className="block hover:bg-slate-50 transition-colors group">
                                        {/* Desktop Row */}
                                        <div className="hidden lg:grid grid-cols-12 gap-4 p-4 items-center">
                                            <div className="col-span-3 pl-2">
                                                <p className="font-bold text-sm text-slate-900">{shift.employee_name}</p>
                                                <p className="text-[10px] text-slate-500 font-medium mt-0.5">{formatDateTime(shift.check_in)}</p>
                                            </div>
                                            <div className="col-span-2 min-w-0">
                                                <p className="font-medium text-sm text-slate-700 truncate" title={acceptedFrom}>{acceptedFrom}</p>
                                            </div>
                                            <div className="col-span-2 min-w-0">
                                                <p className="font-medium text-sm text-slate-700 truncate" title={handedOverTo}>{handedOverTo}</p>
                                            </div>
                                            <div className="col-span-4">
                                                <Badge variant="outline" className={cn("text-[10px] px-2.5 py-1 border-none font-bold uppercase", statusUI.className)}>
                                                    <StatusIcon className="h-3 w-3 mr-1.5" />
                                                    {statusUI.label}
                                                </Badge>
                                            </div>
                                            <div className="col-span-1 flex justify-end pr-2">
                                                <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                                                    <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600" />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Mobile Row */}
                                        <div className="lg:hidden p-4 flex flex-col gap-3">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="font-black text-base text-slate-900">{shift.employee_name}</p>
                                                    <p className="text-xs text-slate-500 font-medium mt-0.5">{formatDateTime(shift.check_in)}</p>
                                                </div>
                                            </div>
                                            
                                            <div className="flex flex-col gap-1 bg-slate-50 rounded-md p-2 mt-1">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[10px] text-slate-500 font-bold uppercase">Принял от:</span>
                                                    <span className="text-xs font-bold text-slate-700">{acceptedFrom}</span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[10px] text-slate-500 font-bold uppercase">Передал:</span>
                                                    <span className="text-xs font-bold text-slate-700">{handedOverTo}</span>
                                                </div>
                                            </div>

                                            <div className="flex justify-between items-center mt-1">
                                                <Badge variant="outline" className={cn("text-[9px] px-2 py-0.5 border-none font-bold uppercase shrink-0", statusUI.className)}>
                                                    <StatusIcon className="h-3 w-3 mr-1" />
                                                    {statusUI.label}
                                                </Badge>
                                                <div className="text-[11px] font-bold text-blue-600 flex items-center gap-1">
                                                    Смотреть детали <ArrowRight className="h-3 w-3" />
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
