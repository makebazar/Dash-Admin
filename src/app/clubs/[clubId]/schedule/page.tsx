"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { WorkScheduleGrid } from "@/components/schedule/WorkScheduleGrid"

export default function SchedulePage() {
    const params = useParams()
    const router = useRouter()
    const searchParams = useSearchParams()
    const clubId = params.clubId as string

    const now = useMemo(() => new Date(), [])
    const monthParam = searchParams.get("month")
    const yearParam = searchParams.get("year")

    const initialMonth = useMemo(() => {
        const m = monthParam ? parseInt(monthParam, 10) : NaN
        if (!Number.isFinite(m) || m < 1 || m > 12) return now.getMonth() + 1
        return m
    }, [monthParam, now])

    const initialYear = useMemo(() => {
        const y = yearParam ? parseInt(yearParam, 10) : NaN
        if (!Number.isFinite(y) || y < 1970 || y > 3000) return now.getFullYear()
        return y
    }, [yearParam, now])

    const [month, setMonth] = useState(initialMonth)
    const [year, setYear] = useState(initialYear)
    const [data, setData] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        setMonth(initialMonth)
        setYear(initialYear)
    }, [initialMonth, initialYear])

    useEffect(() => {
        if (!monthParam || !yearParam) {
            router.replace(`?month=${initialMonth}&year=${initialYear}`)
        }
    }, [monthParam, yearParam, router, initialMonth, initialYear])

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
        router.replace(`?month=${newMonth}&year=${newYear}`)
    }

    const monthNames = [
        "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
        "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
    ]

    return (
        <div className="flex min-h-screen bg-[#FAFAFA] flex-col font-sans text-slate-900 selection:bg-black/10">
            <main className="mx-auto max-w-6xl w-full flex-1 px-4 sm:px-6 md:px-8 py-8 md:py-12 lg:py-20">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between mb-12">
                    <div className="space-y-3">
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900">
                            График работы
                        </h1>
                        <p className="text-slate-500 text-lg">
                            Планирование смен сотрудников по дням месяца
                        </p>
                    </div>

                    <div className="flex w-full sm:w-auto items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl p-2 shadow-sm">
                        <Button variant="ghost" size="icon" className="h-12 w-12 rounded-xl shrink-0 text-slate-500 hover:text-black hover:bg-slate-50 transition-colors" onClick={() => handleMonthChange(-1)}>
                            <ChevronLeft className="h-5 w-5" />
                        </Button>
                        <div className="flex min-w-[160px] items-center justify-center gap-2 px-4 text-center">
                            <span className="text-lg font-bold tracking-tight text-slate-900 capitalize">
                                {monthNames[month - 1]}
                            </span>
                            <span className="text-lg font-medium text-slate-400">{year}</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-12 w-12 rounded-xl shrink-0 text-slate-500 hover:text-black hover:bg-slate-50 transition-colors" onClick={() => handleMonthChange(1)}>
                            <ChevronRight className="h-5 w-5" />
                        </Button>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-32">
                        <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
                    </div>
                ) : data?.error ? (
                    <div className="py-20 bg-white rounded-3xl border border-slate-200 border-dashed text-center p-8">
                        <div className="text-rose-500 font-bold mb-3 text-lg">Произошла ошибка при загрузке</div>
                        <p className="text-slate-500 mb-6">{data.error}</p>
                        <Button variant="outline" className="h-12 rounded-xl px-6 border-slate-200 text-slate-700 hover:bg-slate-50 font-medium" onClick={fetchData}>
                            Попробовать снова
                        </Button>
                    </div>
                ) : !data || !data.employees ? (
                    <div className="py-32 bg-white rounded-3xl border border-slate-200 border-dashed text-center">
                        <p className="text-slate-500 text-lg">Данные не найдены или отсутствуют сотрудники</p>
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
            </main>
        </div>
    )
}
