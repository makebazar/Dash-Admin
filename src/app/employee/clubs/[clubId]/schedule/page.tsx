"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { WorkScheduleGrid } from "@/components/schedule/WorkScheduleGrid"

export default function EmployeeSchedulePage({ params }: { params: Promise<{ clubId: string }> }) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [clubId, setClubId] = useState<string>('')
    const [scheduleData, setScheduleData] = useState<any>(null)
    const [loading, setLoading] = useState(true)

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

    useEffect(() => {
        params.then(p => {
            setClubId(p.clubId)
        })
    }, [params])

    useEffect(() => {
        setMonth(initialMonth)
        setYear(initialYear)
    }, [initialMonth, initialYear])

    useEffect(() => {
        if (!monthParam || !yearParam) {
            router.replace(`?month=${initialMonth}&year=${initialYear}`)
        }
    }, [monthParam, yearParam, router, initialMonth, initialYear])

    useEffect(() => {
        if (clubId) fetchSchedule(clubId, month, year)
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

    const fetchSchedule = async (id: string, m: number, y: number) => {
        try {
            setLoading(true)
            const res = await fetch(`/api/employee/clubs/${id}/schedule?month=${m}&year=${y}`)
            const data = await res.json()
            if (res.ok) {
                setScheduleData(data)
            }
        } catch (error) {
            console.error('Error fetching schedule:', error)
        } finally {
            setLoading(false)
        }
    }

    if (!clubId) return null

    const monthNames = [
        "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
        "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
    ]

    return (
        <div className="w-full max-w-7xl mx-auto px-4 py-8 md:px-8 md:py-12 space-y-8 relative z-0">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex flex-col gap-2">
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">График смен</h1>
                    <p className="text-sm text-muted-foreground">График работы администраторов по месяцам</p>
                </div>

                <div className="flex w-full sm:w-auto items-center justify-between gap-3 bg-card border border-border rounded-xl p-2 shadow-sm">
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-lg shrink-0 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" onClick={() => handleMonthChange(-1)}>
                        <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex min-w-[160px] items-center justify-center gap-2 px-4 text-center">
                        <span className="text-base font-bold tracking-tight text-foreground capitalize">
                            {monthNames[month - 1]}
                        </span>
                        <span className="text-base font-medium text-muted-foreground">{year}</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-lg shrink-0 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" onClick={() => handleMonthChange(1)}>
                        <ChevronRight className="h-5 w-5" />
                    </Button>
                </div>
            </div>

            <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
                {loading ? (
                    <div className="flex h-64 flex-col items-center justify-center text-muted-foreground gap-3">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <span className="text-sm">Загрузка графика...</span>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <WorkScheduleGrid
                            clubId={clubId}
                            month={month}
                            year={year}
                            initialData={scheduleData}
                            refreshData={() => fetchSchedule(clubId, month, year)}
                            readOnly={true}
                        />
                    </div>
                )}
            </div>
        </div>
    )
}
