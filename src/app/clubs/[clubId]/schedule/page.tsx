"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { WorkScheduleGrid } from "@/components/schedule/WorkScheduleGrid"

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
        <div className="space-y-5 p-4 sm:space-y-6 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0 space-y-2">
                    <h1 className="text-[2rem] font-semibold tracking-[-0.04em] text-slate-900 sm:text-3xl sm:tracking-tight">
                        График работы
                    </h1>
                    <p className="max-w-xl text-[15px] leading-6 text-muted-foreground sm:text-base">
                        Планирование смен сотрудников по дням месяца
                    </p>
                </div>

                <div className="flex w-full items-center justify-between gap-2 rounded-2xl border bg-card p-1.5 sm:w-auto sm:gap-3 sm:p-2">
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl shrink-0" onClick={() => handleMonthChange(-1)}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex min-w-0 flex-1 items-center justify-center gap-2 px-2 text-center sm:min-w-[150px] sm:flex-none">
                        <span className="truncate text-xl font-semibold tracking-[-0.03em] text-slate-900 sm:text-lg sm:tracking-normal">
                            {monthNames[month - 1]}
                        </span>
                        <span className="shrink-0 text-lg font-medium text-muted-foreground sm:text-base">{year}</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl shrink-0" onClick={() => handleMonthChange(1)}>
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
