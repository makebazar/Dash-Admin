"use client"

import { useState, useEffect, useMemo } from "react"
import { cn } from "@/lib/utils"
import { Sun, Moon, Plus, Loader2, GripVertical } from "lucide-react"
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
}

function SortableRow({ emp, days, month, year, localSchedule, isUpdating, toggleShift }: any) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: emp.id });

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
                "group transition-colors",
                isDragging ? "bg-slate-100 dark:bg-slate-800 shadow-lg" : "hover:bg-slate-50/50 dark:hover:bg-slate-800/20"
            )}
        >
            <td className={cn(
                "sticky left-0 z-20 bg-white dark:bg-slate-950 p-0 border-r border-slate-200 dark:border-slate-800",
                isDragging && "shadow-none"
            )}>
                <div className="flex h-full min-h-[52px]">
                    {/* Drag Handle */}
                    <button
                        {...attributes}
                        {...listeners}
                        className="flex items-center justify-center w-8 cursor-grab active:cursor-grabbing hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-300 hover:text-slate-500 transition-colors"
                    >
                        <GripVertical className="h-4 w-4" />
                    </button>

                    <div className={cn("flex flex-col flex-1 justify-center py-2 pr-4", emp.dismissed_at && "opacity-70 grayscale")}>
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-800 dark:text-slate-200 truncate">{emp.full_name}</span>
                            {shiftCount > 0 && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                    {shiftCount}
                                </span>
                            )}
                            {emp.dismissed_at && (
                                <span className="text-[9px] font-bold text-red-500 bg-red-100 dark:bg-red-950/50 px-1 py-0.5 rounded border border-red-200 dark:border-red-900">
                                    УВОЛ
                                </span>
                            )}
                        </div>
                        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-tight">{emp.role}</span>
                    </div>
                </div>
            </td>
            {days.map((d: number) => {
                const dateStr = `${year}-${month.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`
                const type = localSchedule[emp.id]?.[dateStr]
                const cellId = `${emp.id}-${dateStr}`
                const updating = isUpdating === cellId

                return (
                    <td
                        key={d}
                        onClick={() => toggleShift(emp.id, d)}
                        className={cn(
                            "p-0 border-r border-slate-100 dark:border-slate-800 cursor-pointer relative",
                            updating && "opacity-50 pointer-events-none"
                        )}
                    >
                        <div className={cn(
                            "w-full h-14 flex items-center justify-center transition-all duration-200",
                            type === 'DAY' && "bg-emerald-500 text-white shadow-sm",
                            type === 'NIGHT' && "bg-indigo-500 text-white shadow-sm",
                            !type && "bg-transparent text-slate-200 dark:text-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900"
                        )}>
                            {type === 'DAY' && <Sun className="h-5 w-5 animate-in zoom-in-50 duration-200 drop-shadow-sm" />}
                            {type === 'NIGHT' && <Moon className="h-5 w-5 animate-in zoom-in-50 duration-200 drop-shadow-sm" />}
                            {!type && <Plus className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />}
                        </div>
                    </td>
                )
            })}
        </tr>
    );
}

export function WorkScheduleGrid({ clubId, month, year, initialData, refreshData }: WorkScheduleGridProps) {
    if (!initialData) return null

    const { employees: initialEmployees, schedule, clubSettings } = initialData
    const [localSchedule, setLocalSchedule] = useState(schedule || {})
    const [localEmployees, setLocalEmployees] = useState(initialEmployees || [])
    const [isUpdating, setIsUpdating] = useState<string | null>(null)

    // Sync state when props change
    useEffect(() => {
        setLocalSchedule(schedule || {})
    }, [schedule])

    useEffect(() => {
        setLocalEmployees(initialEmployees || [])
    }, [initialEmployees])

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = async (event: DragEndEvent) => {
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
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <table className="w-full border-collapse min-w-[1200px]">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                                <th className="sticky left-0 z-20 bg-slate-50 dark:bg-slate-950 p-0 text-left text-xs font-black uppercase tracking-widest text-slate-500 w-72 border-r border-slate-200 dark:border-slate-800 pl-4 py-4">
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
                                    />
                                ))}
                            </SortableContext>

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
                </DndContext>
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
                    💡 Можно менять порядок сотрудников, перетаскивая их за иконку слева
                </div>
            </div>
        </Card>
    )
}
