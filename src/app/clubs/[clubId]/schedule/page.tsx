"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Loader2, Plus } from "lucide-react"
import { WorkScheduleGrid } from "@/components/schedule/WorkScheduleGrid"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function SchedulePage() {
    const params = useParams()
    const clubId = params.clubId as string

    const [month, setMonth] = useState(new Date().getMonth() + 1)
    const [year, setYear] = useState(new Date().getFullYear())
    const [data, setData] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(true)

    const fetchData = async () => {
        setIsLoading(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/work-schedule?month=${month}&year=${year}`)
            const json = await res.json()
            if (res.ok) {
                setData(json)
            }
        } catch (e) {
            console.error(e)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        if (clubId) fetchData()
    }, [clubId, month, year])

    const handleMonthChange = (move: number) => {
        let newMonth = month + move
        let newYear = year
        if (newMonth > 12) {
            newMonth = 1
            newYear++
        } else if (newMonth < 1) {
            newMonth = 12
            newYear--
        }
        setMonth(newMonth)
        setYear(newYear)
    }

    const monthNames = [
        "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
        "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
    ]

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                        <CalendarIcon className="h-8 w-8 text-purple-600" />
                        График работы
                    </h1>
                    <p className="text-muted-foreground mt-1">Планирование смен сотрудников</p>
                </div>

                <div className="flex items-center gap-3 bg-card p-2 rounded-xl border">
                    <Button variant="ghost" size="icon" onClick={() => handleMonthChange(-1)}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-2 px-2 min-w-[150px] justify-center text-center">
                        <span className="font-bold text-lg">{monthNames[month - 1]}</span>
                        <span className="text-muted-foreground font-medium">{year}</span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleMonthChange(1)}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>

                <Button
                    variant="outline"
                    className="h-14 px-6 border-purple-200 hover:bg-purple-50 hover:text-purple-600 transition-all gap-2"
                    onClick={async () => {
                        if (confirm(`Скопировать график из ${month === 1 ? 'декабря' : monthNames[month - 2]}? Это перезапишет существующие смены на те же числа.`)) {
                            setIsLoading(true);
                            await fetch(`/api/clubs/${clubId}/work-schedule`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ month, year })
                            });
                            fetchData();
                        }
                    }}
                >
                    <Plus className="h-4 w-4" />
                    Копировать из прошлого месяца
                </Button>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-10 w-10 animate-spin text-purple-600" />
                </div>
            ) : (
                <WorkScheduleGrid
                    clubId={clubId}
                    month={month}
                    year={year}
                    initialData={data}
                    refreshData={fetchData}
                />
            )}
        </div>
    )
}
