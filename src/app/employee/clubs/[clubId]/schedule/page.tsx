"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, Loader2 } from "lucide-react"
import { WorkScheduleGrid } from "@/components/schedule/WorkScheduleGrid"

export default function EmployeeSchedulePage({ params }: { params: Promise<{ clubId: string }> }) {
    const [clubId, setClubId] = useState<string>('')
    const [scheduleData, setScheduleData] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        params.then(p => {
            setClubId(p.clubId)
        })
    }, [params])

    useEffect(() => {
        if (clubId) {
            fetchSchedule(clubId)
        }
    }, [clubId])

    const fetchSchedule = async (id: string) => {
        try {
            setLoading(true)
            const res = await fetch(`/api/employee/clubs/${id}/schedule`)
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

    return (
        <div className="w-full max-w-7xl mx-auto px-4 py-8 md:px-8 md:py-12 space-y-8 relative z-0">
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">График смен</h1>
                <p className="text-sm text-muted-foreground">График работы администраторов на текущий месяц</p>
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
                            month={new Date().getMonth() + 1}
                            year={new Date().getFullYear()}
                            initialData={scheduleData}
                            refreshData={() => fetchSchedule(clubId)}
                            readOnly={true}
                        />
                    </div>
                )}
            </div>
        </div>
    )
}
