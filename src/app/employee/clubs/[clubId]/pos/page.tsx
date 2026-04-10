"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { SSEProvider } from "@/hooks/usePOSWebSocket"
import { EmployeeSalesWizard } from "../_components/EmployeeSalesWizard"
import { normalizeInventorySettings } from "@/lib/inventory-settings"

export default function EmployeePosPage() {
    const { clubId } = useParams<{ clubId: string }>()
    const [userId, setUserId] = useState<string>("")
    const [activeShiftId, setActiveShiftId] = useState<string | undefined>(undefined)
    const [isLoading, setIsLoading] = useState(true)
    const [isBlockedByAcceptance, setIsBlockedByAcceptance] = useState(false)
    const [isCashboxEnabled, setIsCashboxEnabled] = useState(true)

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
                const inventorySettings = normalizeInventorySettings(currentClub?.inventory_settings)
                setIsCashboxEnabled(Boolean(inventorySettings.stock_enabled && inventorySettings.cashbox_enabled && inventorySettings.cashbox_warehouse_id))

                const shiftRes = await fetch(`/api/employee/clubs/${clubId}/active-shift`, { cache: "no-store" })
                const shiftData = await shiftRes.json()
                if (shiftRes.ok && shiftData?.shift?.id) {
                    const shiftId = String(shiftData.shift.id)
                    setActiveShiftId(shiftId)
                    setIsBlockedByAcceptance(false)
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
            <div className="min-h-[100dvh] bg-background text-foreground flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <p className="text-sm font-medium">Загрузка кассы...</p>
                </div>
            </div>
        )
    }

    if (isBlockedByAcceptance) {
        return (
            <div className="min-h-[100dvh] bg-background text-foreground flex items-center justify-center p-6 text-center">
                <div className="max-w-md space-y-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-6 shadow-sm">
                    <div className="text-lg font-bold text-amber-500">Бар временно заблокирован</div>
                    <div className="text-sm text-muted-foreground">
                        Сначала завершите приемку остатков на старте смены. После подтверждения инвентаризации касса откроется автоматически.
                    </div>
                </div>
            </div>
        )
    }

    if (!isCashboxEnabled) {
        return (
            <div className="min-h-[100dvh] bg-background text-foreground flex items-center justify-center p-6 text-center">
                <div className="max-w-md space-y-3 rounded-xl border border-border bg-card p-6 shadow-sm">
                    <div className="text-lg font-bold text-foreground">Касса отключена</div>
                    <div className="text-sm text-muted-foreground">
                        Этот клуб не использует кассу DashAdmin. Если продажи пробиваются во внешней системе, здесь касса недоступна.
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
