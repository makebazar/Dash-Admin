"use client"

import { type ReactNode, useEffect, useState } from "react"
import { Users, CreditCard, Activity, DollarSign, Loader2 } from "lucide-react"
import { SuperAdminPage } from "../_components/page-shell"

interface AdminStats {
    total_clubs: string
    total_users: string
    paid_subscriptions: string
    trial_subscriptions: string
    estimated_mrr: string
}

export default function SuperAdminDashboard() {
    const [stats, setStats] = useState<AdminStats | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        fetchStats()
    }, [])

    const fetchStats = async () => {
        try {
            const res = await fetch('/api/super-admin/dashboard')
            const data = await res.json()
            if (res.ok) {
                setStats(data)
            }
        } catch (error) {
            console.error('Error fetching admin stats:', error)
        } finally {
            setIsLoading(false)
        }
    }

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-zinc-950">
                <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
            </div>
        )
    }

    return (
        <SuperAdminPage title="Обзор" description="Сводка по платформе (клубы, пользователи, биллинг)">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Stat
                    label="Всего клубов"
                    value={stats?.total_clubs || 0}
                    hint="Зарегистрировано в системе"
                    icon={<Activity className="h-4 w-4 text-red-200" />}
                />
                <Stat
                    label="Пользователей"
                    value={stats?.total_users || 0}
                    hint="Включая владельцев и персонал"
                    icon={<Users className="h-4 w-4 text-red-200" />}
                />
                <Stat
                    label="Платных подписок"
                    value={stats?.paid_subscriptions || 0}
                    hint={`${stats?.trial_subscriptions || 0} с временным доступом`}
                    icon={<CreditCard className="h-4 w-4 text-red-200" />}
                />
                <Stat
                    label="MRR (эстимейт)"
                    value={`${Number(stats?.estimated_mrr || 0).toLocaleString("ru-RU")} ₽`}
                    hint="На основе активных тарифов"
                    icon={<DollarSign className="h-4 w-4 text-red-200" />}
                />
            </div>
        </SuperAdminPage>
    )
}

function Stat({
    label,
    value,
    hint,
    icon,
}: {
    label: string
    value: ReactNode
    hint?: string
    icon?: ReactNode
}) {
    return (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                    <div className="text-xs font-medium tracking-wide text-zinc-400 uppercase">{label}</div>
                    <div className="text-3xl font-semibold tracking-tight text-white">{value}</div>
                    {hint ? <div className="text-xs text-zinc-500">{hint}</div> : null}
                </div>
                {icon ? <div className="h-9 w-9 rounded-lg bg-red-500/10 flex items-center justify-center">{icon}</div> : null}
            </div>
        </div>
    )
}
