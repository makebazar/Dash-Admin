"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { cn, formatLocalDate } from "@/lib/utils"
import { Sun, Moon, Plus, Loader2, GripVertical, Calendar as CalendarIcon } from "lucide-react"
import { Card } from "@/components/ui/card"
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface WorkScheduleGridProps {
    clubId: string
    month: number
    year: number
    initialData: any
    refreshData: () => void
    readOnly?: boolean
}

type ScheduleMap = Record<string, Record<string, string>>

function SortableRow({ emp, days, month, year, localSchedule, isUpdating, toggleShift, readOnly, todayStr }: any) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: emp.id, disabled: readOnly });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : "auto",
        position: isDragging ? "relative" as const : "static" as const,
    };

    const shiftCount = useMemo(() => {
        if (!localSchedule[emp.id]) return 0;
        const prefix = `${year}-${month.toString().padStart(2, '0')}`;
        return Object.keys(localSchedule[emp.id]).filter(date => date.startsWith(prefix)).length;
    }, [localSchedule, emp.id, month, year]);

    return (
        <tr
            ref={setNodeRef}
            style={style}
            className={cn(
                "group transition-colors h-14",
                isDragging ? "bg-accent/50 shadow-lg" : "hover:bg-accent/30"
            )}
        >
            <td className={cn(
                "sticky left-0 z-20 bg-card p-0 border-r border-border shadow-[1px_0_0_0_hsl(var(--border))]",
                isDragging && "shadow-none"
            )}>
                <div className="flex h-full min-h-[56px] items-center">
                    {/* Drag Handle */}
                    {!readOnly && (
                        <button
                            {...attributes}
                            {...listeners}
                            className="flex items-center justify-center w-10 h-full cursor-grab active:cursor-grabbing hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <GripVertical className="h-4 w-4" />
                        </button>
                    )}
                    {readOnly && <div className="w-5" />}

                    <div className={cn("flex flex-col flex-1 justify-center py-2 pr-4", emp.dismissed_at && "opacity-70 grayscale")}>
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-foreground truncate">{emp.full_name}</span>
                            {shiftCount > 0 && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-accent text-muted-foreground">
                                    {shiftCount}
                                </span>
                            )}
                            {emp.dismissed_at && (
                                <span className="text-[9px] font-bold text-rose-500 bg-rose-500/10 px-1.5 py-0.5 rounded-md border border-rose-500/20">
                                    УВОЛ
                                </span>
                            )}
                        </div>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{emp.role}</span>
                    </div>
                </div>
            </td>
            {days.map((d: any) => {
                const dateStr = d.dateStr
                const type = localSchedule[emp.id]?.[dateStr]
                const cellId = `${emp.id}-${dateStr}`
                const updating = isUpdating === cellId
                const isToday = dateStr === todayStr

                return (
                    <td
                        key={dateStr}
                        onClick={() => !readOnly && toggleShift(emp.id, dateStr)}
                        className={cn(
                            "p-0 border-r border-border relative group/cell transition-colors",
                            !readOnly && "cursor-pointer hover:bg-accent/50",
                            readOnly && "cursor-default",
                            d.isOutside && "opacity-40",
                            isToday && "bg-primary/5"
                        )}
                    >
                        <div className={cn(
                            "w-full h-14 flex items-center justify-center transition-all duration-200",
                            type === 'DAY' && "bg-amber-500/10 text-amber-500 shadow-sm inset-y-0",
                            type === 'NIGHT' && "bg-indigo-500/10 text-indigo-400 shadow-sm inset-y-0",
                            type === 'FULL' && "bg-slate-900/5 text-slate-700 shadow-sm inset-y-0",
                            !type && "text-muted-foreground/20",
                            updating && "opacity-40 scale-90"
                        )}>
                            {type === 'DAY' && <Sun className="h-5 w-5" />}
                            {type === 'NIGHT' && <Moon className="h-5 w-5" />}
                            {type === 'FULL' && (
                                <div className="flex items-center gap-1">
                                    <Sun className="h-4 w-4 text-amber-500" />
                                    <Moon className="h-4 w-4 text-indigo-400" />
                                </div>
                            )}
                            {!type && !readOnly && <Plus className="h-3 w-3 opacity-0 group-hover/cell:opacity-100 transition-opacity" />}
                        </div>
                        {updating && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <Loader2 className="h-4 w-4 animate-spin text-foreground/50" />
                            </div>
                        )}
                    </td>
                )
            })}
        </tr>
    );
}

export function WorkScheduleGrid({ clubId, month, year, initialData, refreshData, readOnly = false }: WorkScheduleGridProps) {
    if (!initialData) return null

    const { employees: initialEmployees, schedule, clubSettings } = initialData
    const [localSchedule, setLocalSchedule] = useState<ScheduleMap>(schedule || {})
    const [localEmployees, setLocalEmployees] = useState(initialEmployees || [])
    const [isUpdating, setIsUpdating] = useState<string | null>(null)
    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const localScheduleRef = useRef<ScheduleMap>(schedule || {})
    const updateQueueRef = useRef<Map<string, Promise<void>>>(new Map())
    const updateTokenRef = useRef<Map<string, symbol>>(new Map())

    const todayStr = useMemo(() => {
        const d = new Date();
        return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
    }, []);

    // Enable drag-to-scroll
    useEffect(() => {
        const container = scrollContainerRef.current
        if (!container) return

        let isDown = false
        let startX: number
        let scrollLeft: number

        const onMouseDown = (e: MouseEvent) => {
            isDown = true
            container.style.cursor = 'grabbing'
            startX = e.pageX - container.offsetLeft
            scrollLeft = container.scrollLeft
        }

        const onMouseLeave = () => {
            isDown = false
            container.style.cursor = 'grab'
        }

        const onMouseUp = () => {
            isDown = false
            container.style.cursor = 'grab'
        }

        const onMouseMove = (e: MouseEvent) => {
            if (!isDown) return
            e.preventDefault()
            const x = e.pageX - container.offsetLeft
            const walk = (x - startX) * 2 // Scroll-fast
            container.scrollLeft = scrollLeft - walk
        }

        container.addEventListener('mousedown', onMouseDown)
        container.addEventListener('mouseleave', onMouseLeave)
        container.addEventListener('mouseup', onMouseUp)
        container.addEventListener('mousemove', onMouseMove)

        // Keep wheel scroll too
        const handleWheel = (e: WheelEvent) => {
            if (e.deltaY !== 0 && !e.shiftKey) {
                // If horizontal scroll is possible, prevent default vertical scroll
                if (container.scrollWidth > container.clientWidth) {
                    e.preventDefault()
                    container.scrollLeft += e.deltaY
                }
            }
        }
        container.addEventListener('wheel', handleWheel, { passive: false })

        return () => {
            container.removeEventListener('mousedown', onMouseDown)
            container.removeEventListener('mouseleave', onMouseLeave)
            container.removeEventListener('mouseup', onMouseUp)
            container.removeEventListener('mousemove', onMouseMove)
            container.removeEventListener('wheel', handleWheel)
        }
    }, [])

    // Sync state when props change
    useEffect(() => {
        const next = schedule || {}
        localScheduleRef.current = next
        setLocalSchedule(next)
    }, [schedule])

    useEffect(() => {
        setLocalEmployees(initialEmployees || [])
    }, [initialEmployees])

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = async (event: DragEndEvent) => {
        if (readOnly) return;
        const { active, over } = event;
        if (active.id !== over?.id) {
            setLocalEmployees((items: any[]) => {
                const oldIndex = items.findIndex((i) => i.id === active.id);
                const newIndex = items.findIndex((i) => i.id === over?.id);
                const newItems = arrayMove(items, oldIndex, newIndex);

                // Persist order
                const orderData = newItems.map((item, index) => ({ id: item.id, order: index }));
                fetch(`/api/clubs/${clubId}/employees/reorder`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ items: orderData })
                }).catch(console.error);

                return newItems;
            });
        }
    };

    const days = useMemo(() => {
        const result = [];
        // Last 3 days of prev month
        for (let i = 2; i >= 0; i--) {
            const date = new Date(year, month - 1, -i);
            result.push({
                day: date.getDate(),
                month: date.getMonth() + 1,
                year: date.getFullYear(),
                dateStr: formatLocalDate(date),
                isOutside: true
            });
        }
        // Current month days
        const daysInMonth = new Date(year, month, 0).getDate();
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month - 1, d);
            result.push({
                day: d,
                month: month,
                year: year,
                dateStr: formatLocalDate(date),
                isOutside: false
            });
        }
        return result;
    }, [month, year])

    const enqueueShiftUpdate = (cellId: string, payload: { userId: string; date: string; shiftType: string | null }) => {
        const token = Symbol(cellId)
        updateTokenRef.current.set(cellId, token)
        setIsUpdating(cellId)

        const prev = updateQueueRef.current.get(cellId) ?? Promise.resolve()
        const next = prev
            .catch(() => undefined)
            .then(async () => {
                try {
                    const res = await fetch(`/api/clubs/${clubId}/work-schedule`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    })
                    if (!res.ok) throw new Error('Failed to update')
                } catch (e) {
                    console.error(e)
                    refreshData()
                }
            })

        updateQueueRef.current.set(cellId, next)
        next.finally(() => {
            if (updateTokenRef.current.get(cellId) === token) setIsUpdating(null)
        })
    }

    const toggleShift = (userId: string, dateStr: string) => {
        if (readOnly) return;

        const prev = localScheduleRef.current
        const currentType = prev[userId]?.[dateStr]

        let nextType: string | null = null
        if (!currentType) nextType = 'DAY'
        else if (currentType === 'DAY') nextType = 'NIGHT'
        else if (currentType === 'NIGHT') nextType = 'FULL'
        else nextType = null

        const newSchedule: ScheduleMap = { ...prev }
        const prevUserSchedule = newSchedule[userId] || {}
        if (nextType) {
            newSchedule[userId] = { ...prevUserSchedule, [dateStr]: nextType }
        } else {
            const updatedUserSchedule = { ...prevUserSchedule }
            delete updatedUserSchedule[dateStr]
            newSchedule[userId] = updatedUserSchedule
        }

        localScheduleRef.current = newSchedule
        setLocalSchedule(newSchedule)

        const cellId = `${userId}-${dateStr}`
        enqueueShiftUpdate(cellId, { userId, date: dateStr, shiftType: nextType })
    }

    // Calculate coverage
    const coverage = useMemo(() => {
        const counts: Record<string, { DAY: number; NIGHT: number }> = {}
        days.forEach(d => counts[d.dateStr] = { DAY: 0, NIGHT: 0 })

        Object.entries(localSchedule).forEach(([, shifts]: [any, any]) => {
            Object.entries(shifts).forEach(([dateStr, type]: [any, any]) => {
                if (counts[dateStr]) {
                    if (type === 'FULL') {
                        counts[dateStr].DAY++
                        counts[dateStr].NIGHT++
                    } else if (type === 'DAY' || type === 'NIGHT') {
                        counts[dateStr][type]++
                    }
                }
            })
        })
        return counts
    }, [localSchedule, days])

    // Mobile View Component
    const MobileScheduleList = () => (
        <div className="md:hidden space-y-3">
            {days.map(d => {
                const date = new Date(d.year, d.month - 1, d.day)
                const isWeekend = date.getDay() === 0 || date.getDay() === 6
                const dateStr = d.dateStr
                const isToday = dateStr === todayStr
                
                // Find workers for this day
                const dayWorkers = localEmployees.filter((e: any) => localSchedule[e.id]?.[dateStr] === 'DAY')
                const nightWorkers = localEmployees.filter((e: any) => localSchedule[e.id]?.[dateStr] === 'NIGHT')
                const fullWorkers = localEmployees.filter((e: any) => localSchedule[e.id]?.[dateStr] === 'FULL')
                
                return (
                    <div key={dateStr} className={cn(
                        "relative overflow-hidden rounded-xl border p-4 shadow-sm transition-all bg-card",
                        isWeekend ? "bg-rose-500/5 border-rose-500/20" : "border-border",
                        d.isOutside && "opacity-60",
                        isToday && "border-primary/50 bg-primary/5"
                    )}>
                        {isToday && (
                            <div className="absolute -right-4 -top-4 opacity-[0.03]">
                                <CalendarIcon className="h-24 w-24 text-primary rotate-12" />
                            </div>
                        )}
                        <div className="relative z-10 flex items-start justify-between gap-3 mb-4">
                            <div className="min-w-0">
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "text-3xl font-bold tracking-tight",
                                        isWeekend ? "text-rose-500" : "text-foreground",
                                        isToday && "text-primary"
                                    )}>
                                        {d.day}
                                    </div>
                                    <div className="min-w-0">
                                        <div className={cn(
                                            "truncate text-sm font-bold capitalize",
                                            isWeekend ? "text-rose-500/80" : "text-foreground",
                                            isToday && "text-primary/80"
                                        )}>
                                            {new Intl.DateTimeFormat('ru-RU', { weekday: 'long' }).format(date)}
                                        </div>
                                        <div className="text-xs font-medium text-muted-foreground capitalize">
                                            {new Intl.DateTimeFormat('ru-RU', { month: 'long' }).format(date)}
                                            {d.isOutside ? " · другой месяц" : ""}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {isToday ? (
                                <span className="shrink-0 rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary">
                                    Сегодня
                                </span>
                            ) : null}
                        </div>

                        <div className="relative z-10 space-y-2">
                            {/* Day Shift */}
                            <div className="rounded-lg bg-amber-500/10 p-3 border border-amber-500/20">
                                <div className="flex items-center gap-2 mb-2">
                                    <Sun className="h-3.5 w-3.5 text-amber-500" />
                                    <span className="text-[11px] font-bold uppercase tracking-widest text-amber-500">
                                        Дневная смена
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {dayWorkers.length > 0 ? (
                                        dayWorkers.map((w: any) => (
                                            <div key={w.id} className="inline-flex items-center rounded bg-amber-500/10 px-2 py-1 border border-amber-500/20">
                                                <div className="h-1.5 w-1.5 rounded-full bg-amber-500 mr-1.5"></div>
                                                <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                                                    {w.full_name?.split(' ')[0] || 'Без имени'}
                                                </span>
                                            </div>
                                        ))
                                    ) : (
                                        <span className="text-xs font-medium text-amber-500/50 italic">Нет смен</span>
                                    )}
                                </div>
                            </div>

                            {/* Night Shift */}
                            <div className="rounded-lg bg-indigo-500/10 p-3 border border-indigo-500/20">
                                <div className="flex items-center gap-2 mb-2">
                                    <Moon className="h-3.5 w-3.5 text-indigo-400" />
                                    <span className="text-[11px] font-bold uppercase tracking-widest text-indigo-400">
                                        Ночная смена
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {nightWorkers.length > 0 ? (
                                        nightWorkers.map((w: any) => (
                                            <div key={w.id} className="inline-flex items-center rounded bg-indigo-500/10 px-2 py-1 border border-indigo-500/20">
                                                <div className="h-1.5 w-1.5 rounded-full bg-indigo-400 mr-1.5"></div>
                                                <span className="text-xs font-medium text-indigo-400">
                                                    {w.full_name?.split(' ')[0] || 'Без имени'}
                                                </span>
                                            </div>
                                        ))
                                    ) : (
                                        <span className="text-xs font-medium text-indigo-400/50 italic">Нет смен</span>
                                    )}
                                </div>
                            </div>

                            <div className="rounded-lg bg-slate-900/5 p-3 border border-slate-200">
                                <div className="flex items-center gap-2 mb-2">
                                    <Sun className="h-3.5 w-3.5 text-amber-500" />
                                    <Moon className="h-3.5 w-3.5 text-indigo-400 -ml-1" />
                                    <span className="text-[11px] font-bold uppercase tracking-widest text-slate-600">
                                        Сутки
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {fullWorkers.length > 0 ? (
                                        fullWorkers.map((w: any) => (
                                            <div key={w.id} className="inline-flex items-center rounded bg-slate-900/5 px-2 py-1 border border-slate-200">
                                                <div className="h-1.5 w-1.5 rounded-full bg-slate-400 mr-1.5"></div>
                                                <span className="text-xs font-medium text-slate-700">
                                                    {w.full_name?.split(' ')[0] || 'Без имени'}
                                                </span>
                                            </div>
                                        ))
                                    ) : (
                                        <span className="text-xs font-medium text-slate-500/60 italic">Нет смен</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    )

    const content = (
        <div className="hidden md:block">
        <table className="w-full border-collapse min-w-[1200px]">
            <thead>
                <tr className="bg-accent/30 border-b border-border">
                    <th className="sticky left-0 z-20 bg-card p-0 text-left text-xs font-bold uppercase tracking-widest text-muted-foreground w-72 border-r border-border pl-4 py-4 shadow-[1px_0_0_0_hsl(var(--border))]">
                        Сотрудник
                    </th>
                    {days.map(d => {
                        const date = new Date(d.year, d.month - 1, d.day)
                        const isWeekend = date.getDay() === 0 || date.getDay() === 6
                        const isToday = d.dateStr === todayStr
                        return (
                            <th key={d.dateStr} className={cn(
                                "p-2 text-center border-r border-border min-w-[40px] transition-colors relative",
                                isWeekend && "bg-rose-500/5",
                                d.isOutside && "opacity-40",
                                isToday && "bg-primary/10"
                            )}>
                                {isToday && (
                                    <div className="absolute top-0 inset-x-0 h-1 bg-primary mx-1 rounded-b-full" />
                                )}
                                <div className={cn(
                                    "text-[10px] font-bold uppercase tracking-widest leading-none mb-1.5",
                                    isToday ? "text-primary" : "text-muted-foreground"
                                )}>
                                    {new Intl.DateTimeFormat('ru-RU', { weekday: 'short' }).format(date)}
                                </div>
                                <div className={cn(
                                    "text-sm font-bold",
                                    isWeekend ? "text-rose-500" : "text-foreground",
                                    isToday && "text-primary"
                                )}>
                                    {d.day}
                                </div>
                            </th>
                        )
                    })}
                </tr>
            </thead>
            <tbody className="divide-y divide-border">
                <SortableContext
                    items={localEmployees.map((e: any) => e.id)}
                    strategy={verticalListSortingStrategy}
                >
                    {localEmployees.map((emp: any) => (
                        <SortableRow
                            key={emp.id}
                            emp={emp}
                            days={days}
                            month={month}
                            year={year}
                            localSchedule={localSchedule}
                            isUpdating={isUpdating}
                            toggleShift={toggleShift}
                            readOnly={readOnly}
                            todayStr={todayStr}
                        />
                    ))}
                </SortableContext>

                {/* Coverage Row */}
                <tr className="bg-accent/30 font-bold border-t-2 border-border">
                    <td className="sticky left-0 z-20 bg-card p-4 text-xs font-bold uppercase tracking-widest text-muted-foreground border-r border-border shadow-[1px_0_0_0_hsl(var(--border))]">
                        Покрытие (Д / Н)
                    </td>
                    {days.map(d => {
                        const isToday = d.dateStr === todayStr
                        return (
                            <td key={d.dateStr} className={cn(
                                "p-2 border-r border-border text-center",
                                d.isOutside && "opacity-40",
                                isToday && "bg-primary/10"
                            )}>
                                <div className="flex flex-col gap-1">
                                    <span className={cn(
                                        "text-xs font-bold",
                                        coverage[d.dateStr].DAY > 0 ? "text-emerald-500" : "text-muted-foreground/30"
                                    )}>{coverage[d.dateStr].DAY} <Sun className="inline h-3 w-3 -mt-0.5" /></span>
                                    <span className={cn(
                                        "text-xs font-bold",
                                        coverage[d.dateStr].NIGHT > 0 ? "text-indigo-400" : "text-muted-foreground/30"
                                    )}>{coverage[d.dateStr].NIGHT} <Moon className="inline h-3 w-3 -mt-0.5" /></span>
                                </div>
                            </td>
                        )
                    })}
                </tr>
            </tbody>
        </table>
        </div>
    )


    return (
        <div className="overflow-hidden bg-card">
            <div 
                ref={scrollContainerRef}
                className="overflow-x-auto"
            >
                <MobileScheduleList />
                {readOnly ? content : (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        {content}
                    </DndContext>
                )}
            </div>

            <div className="flex flex-col gap-3 border-t border-border bg-accent/30 p-4 text-sm sm:flex-row sm:flex-wrap sm:gap-8 sm:items-center sm:p-6">
                <div className="flex items-center gap-2.5">
                    <div className="w-4 h-4 rounded bg-amber-500/20 border border-amber-500/50" />
                    <span className="font-bold text-foreground">Дневная смена</span>
                    <span className="text-muted-foreground font-medium">({clubSettings?.day_start_hour || '09'}:00 - {clubSettings?.night_start_hour || '21'}:00)</span>
                </div>
                <div className="flex items-center gap-2.5">
                    <div className="w-4 h-4 rounded bg-indigo-500/20 border border-indigo-500/50" />
                    <span className="font-bold text-foreground">Ночная смена</span>
                    <span className="text-muted-foreground font-medium">({clubSettings?.night_start_hour || '21'}:00 - {clubSettings?.day_start_hour || '09'}:00)</span>
                </div>
                <div className="flex items-center gap-2.5">
                    <div className="w-4 h-4 rounded bg-slate-900/10 border border-slate-200" />
                    <span className="font-bold text-foreground">Сутки</span>
                    <span className="text-muted-foreground font-medium">(день + ночь)</span>
                </div>
                {!readOnly && (
                    <div className="flex items-center gap-2.5">
                        <div className="w-4 h-4 rounded border-2 border-border border-dashed" />
                        <span className="font-medium text-muted-foreground">Выходной (Кликните для выбора)</span>
                    </div>
                )}
            </div>
        </div>
    )
}
