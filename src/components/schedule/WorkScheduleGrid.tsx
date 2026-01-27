"use client"

import { useState, useEffect, useMemo } from "react"
import { cn } from "@/lib/utils"
import { Sun, Moon, Plus, Loader2 } from "lucide-react"
import { Card } from "@/components/ui/card"

interface WorkScheduleGridProps {
    clubId: string
    month: number
    year: number
    initialData: any
    refreshData: () => void
}

export function WorkScheduleGrid({ clubId, month, year, initialData, refreshData }: WorkScheduleGridProps) {
    const { employees, schedule, clubSettings } = initialData
    const [localSchedule, setLocalSchedule] = useState(schedule || {})
    const [isUpdating, setIsUpdating] = useState<string | null>(null)

    useEffect(() => {
        setLocalSchedule(schedule || {})
    }, [schedule])

    const daysInMonth = useMemo(() => new Date(year, month, 0).getDate(), [month, year])
    const days = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth])

    const toggleShift = async (userId: string, day: number) => {
        const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
        const currentType = localSchedule[userId]?.[dateStr]

        let nextType: string | null = null
        if (!currentType) nextType = 'DAY'
        else if (currentType === 'DAY') nextType = 'NIGHT'
        else nextType = null

        // Optimistic update
        const newSchedule = { ...localSchedule }
        if (!newSchedule[userId]) newSchedule[userId] = {}

        if (nextType) newSchedule[userId][dateStr] = nextType
        else delete newSchedule[userId][dateStr]

        setLocalSchedule(newSchedule)

        // API Update
        const cellId = `${userId}-${dateStr}`
        setIsUpdating(cellId)
        try {
            const res = await fetch(`/api/clubs/${clubId}/work-schedule`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, date: dateStr, shiftType: nextType })
            })
            if (!res.ok) throw new Error('Failed to update')
        } catch (e) {
            console.error(e)
            // Revert on error
            setLocalSchedule(localSchedule)
        } finally {
            setIsUpdating(null)
        }
    }

    // Calculate coverage
    const coverage = useMemo(() => {
        const dayCounts: Record<number, { DAY: number; NIGHT: number }> = {}
        days.forEach(d => dayCounts[d] = { DAY: 0, NIGHT: 0 })

        Object.entries(localSchedule).forEach(([userId, shifts]: [any, any]) => {
            Object.entries(shifts).forEach(([dateStr, type]: [any, any]) => {
                const day = parseInt(dateStr.split('-')[2])
                if (dayCounts[day]) {
                    dayCounts[day][type as 'DAY' | 'NIGHT']++
                }
            })
        })
        return dayCounts
    }, [localSchedule, days])

    return (
        <Card className="border-0 shadow-lg bg-white dark:bg-slate-900 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full border-collapse min-w-[1200px]">
                    <thead>
                        <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                            <th className="sticky left-0 z-20 bg-slate-50 dark:bg-slate-950 p-4 text-left text-xs font-black uppercase tracking-widest text-slate-500 w-64 border-r border-slate-200 dark:border-slate-800">
                                Сотрудник
                            </th>
                            {days.map(d => {
                                const date = new Date(year, month - 1, d)
                                const isWeekend = date.getDay() === 0 || date.getDay() === 6
                                return (
                                    <th key={d} className={cn(
                                        "p-2 text-center border-r border-slate-100 dark:border-slate-800 min-w-[40px] transition-colors",
                                        isWeekend && "bg-slate-100/50 dark:bg-slate-800/30"
                                    )}>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-1">
                                            {new Intl.DateTimeFormat('ru-RU', { weekday: 'short' }).format(date)}
                                        </div>
                                        <div className={cn(
                                            "text-sm font-black text-slate-700 dark:text-slate-300",
                                            isWeekend && "text-red-500"
                                        )}>
                                            {d}
                                        </div>
                                    </th>
                                )
                            })}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {employees.map((emp: any) => (
                            <tr key={emp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 group transition-colors">
                                <td className="sticky left-0 z-20 bg-white dark:bg-slate-950 p-4 border-r border-slate-200 dark:border-slate-800">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-sm text-slate-800 dark:text-slate-200 truncate">{emp.full_name}</span>
                                        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-tight">{emp.role}</span>
                                    </div>
                                </td>
                                {days.map(d => {
                                    const dateStr = `${year}-${month.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`
                                    const type = localSchedule[emp.id]?.[dateStr]
                                    const cellId = `${emp.id}-${dateStr}`
                                    const updating = isUpdating === cellId

                                    return (
                                        <td
                                            key={d}
                                            onClick={() => toggleShift(emp.id, d)}
                                            className={cn(
                                                "p-0 border-r border-slate-100 dark:border-slate-800 cursor-pointer transition-all hover:ring-2 hover:ring-inset hover:ring-purple-400 relative",
                                                updating && "opacity-50 pointer-events-none"
                                            )}
                                        >
                                            <div className={cn(
                                                "w-full h-12 flex items-center justify-center transition-all duration-300",
                                                type === 'DAY' && "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20",
                                                type === 'NIGHT' && "bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20",
                                                !type && "bg-transparent text-slate-200 dark:text-slate-800"
                                            )}>
                                                {type === 'DAY' && <Sun className="h-5 w-5 animate-in zoom-in-50 duration-300" />}
                                                {type === 'NIGHT' && <Moon className="h-5 w-5 animate-in zoom-in-50 duration-300" />}
                                                {!type && <Plus className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />}
                                            </div>
                                        </td>
                                    )
                                })}
                            </tr>
                        ))}

                        {/* Coverage Row */}
                        <tr className="bg-slate-50/80 dark:bg-slate-950/80 font-bold border-t-2 border-slate-200 dark:border-slate-800">
                            <td className="sticky left-0 z-20 bg-slate-50 dark:bg-slate-950 p-4 text-xs uppercase tracking-widest text-slate-500 border-r border-slate-200 dark:border-slate-800">
                                Покрытие (Д / Н)
                            </td>
                            {days.map(d => (
                                <td key={d} className="p-2 border-r border-slate-100 dark:border-slate-800 text-center">
                                    <div className="flex flex-col gap-0.5">
                                        <span className={cn(
                                            "text-xs",
                                            coverage[d].DAY > 0 ? "text-emerald-600" : "text-slate-300"
                                        )}>{coverage[d].DAY}🌞</span>
                                        <span className={cn(
                                            "text-xs",
                                            coverage[d].NIGHT > 0 ? "text-indigo-600" : "text-slate-300"
                                        )}>{coverage[d].NIGHT}🌙</span>
                                    </div>
                                </td>
                            ))}
                        </tr>
                    </tbody>
                </table>
            </div>

            <div className="p-6 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-200 dark:border-slate-800 flex flex-wrap gap-8 items-center text-sm">
                <div className="flex items-center gap-2.5">
                    <div className="w-4 h-4 rounded bg-emerald-500" />
                    <span className="font-bold text-slate-700 dark:text-slate-300">Дневная смена</span>
                    <span className="text-slate-400 font-medium tracking-tight">({clubSettings?.day_start_hour || '09'}:00 - {clubSettings?.night_start_hour || '21'}:00)</span>
                </div>
                <div className="flex items-center gap-2.5">
                    <div className="w-4 h-4 rounded bg-indigo-500" />
                    <span className="font-bold text-slate-700 dark:text-slate-300">Ночная смена</span>
                    <span className="text-slate-400 font-medium tracking-tight">({clubSettings?.night_start_hour || '21'}:00 - {clubSettings?.day_start_hour || '09'}:00)</span>
                </div>
                <div className="flex items-center gap-2.5">
                    <div className="w-4 h-4 rounded border-2 border-slate-200 dark:border-slate-800 border-dashed" />
                    <span className="font-medium text-slate-400">Выходной (Кликните для выбора)</span>
                </div>

                <div className="ml-auto text-[11px] text-muted-foreground bg-white dark:bg-slate-900 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-800 shadow-sm animate-pulse">
                    💡 Каждое изменение автоматически обновляет план смен для KPI
                </div>
            </div>
        </Card>
    )
}
