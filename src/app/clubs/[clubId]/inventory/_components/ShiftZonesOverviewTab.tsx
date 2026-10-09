"use client"

import Link from "next/link"
import { ArrowRight, ChevronLeft, ChevronRight, CalendarDays } from "lucide-react"
import { cn } from "@/lib/utils"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import type { ShiftZoneOverview } from "../types"

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
            return { label: "Сдал с расхождениями", className: "text-amber-600" }
        }
        return { label: "Сдал чисто", className: "text-emerald-600" }
    }
    if (status === 'OPEN_ONLY') {
        return { label: "Принял смену (В работе)", className: "text-blue-600" }
    }
    if (status === 'CLOSE_ONLY') {
        return { label: "Сдал без приемки", className: "text-rose-600" }
    }
    return { label: "Передача не завершена", className: "text-slate-500" }
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
    // Выделяем проблемные смены (где есть нерешённые расхождения, либо сдана без приемки)
    if (!overview) {
        return (
            <div className="py-14 text-center text-sm text-slate-400 italic">
                Нет данных о передачах смен за выбранный период.
            </div>
        )
    }
    const problematicShifts = overview.recent_shifts.filter(s => 
        s.unresolved_discrepancy_count > 0 || s.status === 'CLOSE_ONLY'
    )
    
    // Обычные смены — это те, которые не попали в проблемные
    const normalShifts = overview.recent_shifts.filter(s => !problematicShifts.includes(s))

    const activeShiftsCount = overview.recent_shifts.filter(s => s.status === 'OPEN_ONLY').length
    const discrepancyCount = overview.summary.discrepancy_shifts_count

    const getHandoverContext = (shift: typeof overview.recent_shifts[0]) => {
        const acceptedFrom = shift.accepted_from_employee_name || "—"
        let handedOverTo = shift.handed_over_to_employee_name || "—"

        if (!shift.handed_over_to_employee_name) {
            if (shift.status === 'OPEN_ONLY' || shift.status === 'PARTIAL') {
                handedOverTo = "Смена идет"
            }
        }

        return { acceptedFrom, handedOverTo }
    }

    return (
        <div className="space-y-5">
            <h3 className="text-xl font-bold tracking-tight text-slate-900">Журнал передач смен</h3>

            {/* Filter Bar matching Shifts page style */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
                {/* Month Selector Pill */}
                <div className="flex items-center justify-between bg-slate-50 border border-slate-200/80 rounded-xl overflow-hidden shadow-none w-full sm:w-auto">
                    <button 
                        onClick={() => navigateMonth('prev')}
                        className="p-2.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700 px-3 select-none capitalize">
                        <CalendarDays className="h-4 w-4 text-slate-400" />
                        <span>{capitalizedMonth}</span>
                    </div>
                    <button 
                        onClick={() => navigateMonth('next')}
                        className="p-2.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>

                <div className="h-8 w-px bg-slate-200 hidden sm:block" />

                {/* Status Metrics */}
                <div className="flex items-center gap-4 px-2">
                    <div className="flex items-center gap-2 text-sm">
                        <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">С расхождениями</span>
                        <span className="font-bold text-amber-600">{discrepancyCount}</span>
                    </div>
                    <div className="h-4 w-px bg-slate-200" />
                    <div className="flex items-center gap-2 text-sm">
                        <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">В работе</span>
                        <span className="font-bold text-slate-900">{activeShiftsCount}</span>
                    </div>
                </div>
            </div>

            {problematicShifts.length > 0 && (
                <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-rose-500 ml-1">
                        Требуют внимания
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                        {problematicShifts.map(shift => {
                            const hasDiscrepancy = shift.discrepancy_items_count > 0
                            const statusUI = getShiftStatusUi(shift.status, hasDiscrepancy)
                            const { acceptedFrom, handedOverTo } = getHandoverContext(shift)
                            
                            return (
                                <Link key={shift.shift_id} href={`/clubs/${clubId}/inventory/handovers/${shift.shift_id}`} className="block group">
                                    <div className="bg-white rounded-xl border border-rose-100 p-4 shadow-sm hover:shadow-md hover:border-rose-300 transition-all h-full flex flex-col">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider mb-0.5">
                                                    {formatDateTime(shift.check_in)}
                                                </span>
                                                <span className="text-sm font-bold text-slate-900">{shift.employee_name}</span>
                                            </div>
                                            <span className={cn("text-[10px] font-semibold uppercase tracking-wide shrink-0 text-right", statusUI.className)}>
                                                {statusUI.label}
                                            </span>
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
                                                    <p className="text-[10px] uppercase font-semibold tracking-wider text-slate-400 mb-0.5">Расхождения</p>
                                                    <p className="text-xs font-bold text-rose-600">{shift.discrepancy_items_count} поз. ({shift.discrepancy_total_abs} шт)</p>
                                                </div>
                                            ) : (
                                                <div>
                                                    <p className="text-[10px] uppercase font-semibold tracking-wider text-slate-400 mb-0.5">Ошибка передачи</p>
                                                    <p className="text-xs font-medium text-amber-600">Нарушен цикл сдачи</p>
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
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">
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
                            <div className="hidden lg:grid grid-cols-12 gap-4 px-4 py-3 bg-slate-50 border-b border-slate-100 text-[10px] uppercase font-semibold text-slate-400 tracking-wider items-center">
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
                                const { acceptedFrom, handedOverTo } = getHandoverContext(shift)
                                
                                return (
                                    <Link key={shift.shift_id} href={`/clubs/${clubId}/inventory/handovers/${shift.shift_id}`} className="block hover:bg-slate-50 transition-colors group">
                                        {/* Desktop Row */}
                                        <div className="hidden lg:grid grid-cols-12 gap-4 p-4 items-center">
                                            <div className="col-span-3 pl-2">
                                                <p className="font-semibold text-sm text-slate-900">{shift.employee_name}</p>
                                                <p className="text-[10px] text-slate-400 font-normal mt-0.5">{formatDateTime(shift.check_in)}</p>
                                            </div>
                                            <div className="col-span-2 min-w-0">
                                                <p className="font-medium text-sm text-slate-700 truncate" title={acceptedFrom}>{acceptedFrom}</p>
                                            </div>
                                            <div className="col-span-2 min-w-0">
                                                <p className="font-medium text-sm text-slate-700 truncate" title={handedOverTo}>{handedOverTo}</p>
                                            </div>
                                            <div className="col-span-4">
                                                <span className={cn("text-[11px] font-bold uppercase", statusUI.className)}>
                                                    {statusUI.label}
                                                </span>
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
                                                    <p className="font-semibold text-sm text-slate-900">{shift.employee_name}</p>
                                                    <p className="text-[10px] text-slate-400 mt-0.5">{formatDateTime(shift.check_in)}</p>
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
                                                <span className={cn("text-[10px] font-semibold uppercase tracking-wide shrink-0", statusUI.className)}>
                                                    {statusUI.label}
                                                </span>
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
