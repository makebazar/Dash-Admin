"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
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
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-10 w-10 animate-spin text-purple-600" />
                </div>
            ) : data?.error ? (
                <Card className="p-12 text-center border-dashed">
                    <div className="text-red-500 font-bold mb-2">Произошла ошибка при загрузке</div>
                    <p className="text-muted-foreground">{data.error}</p>
                    <Button variant="outline" className="mt-4" onClick={fetchData}>Попробовать снова</Button>
                </Card>
            ) : !data || !data.employees ? (
                <Card className="p-12 text-center border-dashed">
                    <p className="text-muted-foreground">Данные не найдены или отсутствуют сотрудники</p>
                </Card>
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
