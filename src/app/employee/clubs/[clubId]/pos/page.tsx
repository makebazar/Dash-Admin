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
    const [isPosEnabled, setIsPosEnabled] = useState(true)
    const [isBlockedByAcceptance, setIsBlockedByAcceptance] = useState(false)

    useEffect(() => {
        const load = async () => {
            try {
                const meRes = await fetch("/api/auth/me")
                const me = await meRes.json()
                const uid = me?.user?.id
                if (uid) setUserId(uid)

                 const currentClub = Array.isArray(me?.employee_clubs)
                    ? me.employee_clubs.find((club: any) => String(club.id) === String(clubId))
                    : null
                if (currentClub?.inventory_settings?.sales_capture_mode && currentClub.inventory_settings.sales_capture_mode !== "SHIFT") {
                    setIsPosEnabled(false)
                    return
                }

                const shiftRes = await fetch(`/api/employee/clubs/${clubId}/active-shift`, { cache: "no-store" })
                const shiftData = await shiftRes.json()
                if (shiftRes.ok && shiftData?.shift?.id) {
                    const shiftId = String(shiftData.shift.id)
                    setActiveShiftId(shiftId)

                    const requiresStartAcceptance = Boolean(
                        currentClub?.inventory_required &&
                        (currentClub?.inventory_settings?.inventory_timing || "END_SHIFT") === "START_SHIFT"
                    )

                    if (requiresStartAcceptance) {
                        const inventoryRes = await fetch(
                            `/api/employee/clubs/${clubId}/shifts/${shiftId}/open-inventory`,
                            { cache: "no-store" }
                        )
                        const inventoryData = await inventoryRes.json().catch(() => ({}))
                        if (!inventoryRes.ok) {
                            throw new Error(inventoryData.error || "Не удалось проверить приемку остатков")
                        }
                        setIsBlockedByAcceptance(Boolean(inventoryData.inventory))
                    } else {
                        setIsBlockedByAcceptance(false)
                    }
                } else {
                    setActiveShiftId(undefined)
                    setIsBlockedByAcceptance(false)
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

    if (!isPosEnabled) {
        return (
            <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6 text-center">
                <div className="text-slate-300">Продажи через POS недоступны для этого клуба.</div>
            </div>
        )
    }

    if (isBlockedByAcceptance) {
        return (
            <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6 text-center">
                <div className="max-w-md space-y-3">
                    <div className="text-lg font-bold text-amber-300">Бар временно заблокирован</div>
                    <div className="text-slate-300">
                        Сначала завершите приемку остатков на старте смены. После подтверждения инвентаризации касса откроется автоматически.
                    </div>
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
