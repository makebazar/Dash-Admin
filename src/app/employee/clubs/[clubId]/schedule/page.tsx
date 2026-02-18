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
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 md:p-6 space-y-4 md:space-y-6">
            <h1 className="text-xl md:text-2xl font-bold">График смен</h1>

            <Card className="border-0 shadow-lg bg-white dark:bg-slate-900 overflow-hidden">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-purple-600" />
                        График работы администраторов
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex h-64 items-center justify-center text-muted-foreground">
                            <Loader2 className="h-6 w-6 animate-spin mr-2" />
                            Загрузка графика...
                        </div>
                    ) : (
                        <WorkScheduleGrid
                            clubId={clubId}
                            month={new Date().getMonth() + 1}
                            year={new Date().getFullYear()}
                            initialData={scheduleData}
                            refreshData={() => fetchSchedule(clubId)}
                            readOnly={true}
                        />
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
