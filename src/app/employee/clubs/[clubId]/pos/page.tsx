"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { SSEProvider } from "@/hooks/usePOSWebSocket"
import { EmployeeSalesWizard } from "../_components/EmployeeSalesWizard"

export default function EmployeePosPage() {
    const { clubId } = useParams<{ clubId: string }>()
    const [userId, setUserId] = useState<string>("")
    const [activeShiftId, setActiveShiftId] = useState<string | undefined>(undefined)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const load = async () => {
            try {
                const meRes = await fetch("/api/auth/me")
                const me = await meRes.json()
                const uid = me?.user?.id
                if (uid) setUserId(uid)

                const shiftRes = await fetch(`/api/employee/clubs/${clubId}/active-shift`, { cache: "no-store" })
                const shiftData = await shiftRes.json()
                if (shiftRes.ok && shiftData?.shift?.id) {
                    setActiveShiftId(String(shiftData.shift.id))
                } else {
                    setActiveShiftId(undefined)
                }
            } finally {
                setIsLoading(false)
            }
        }

        if (clubId) load().catch(console.error)
    }, [clubId])

    if (isLoading || !clubId || !userId) {
        return (
            <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
                <div className="flex items-center gap-2 text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Загрузка...
                </div>
            </div>
        )
    }

    return (
        <SSEProvider clubId={clubId} userId={userId}>
            <EmployeeSalesWizard
                clubId={clubId}
                userId={userId}
                activeShiftId={activeShiftId}
                onExit={() => {
                    try {
                        window.close()
                    } catch {}
                    window.location.href = `/employee/clubs/${clubId}`
                }}
            />
        </SSEProvider>
    )
}

