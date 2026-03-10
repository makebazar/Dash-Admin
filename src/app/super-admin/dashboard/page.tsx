"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, CreditCard, Activity, DollarSign, Loader2 } from "lucide-react"

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
        <div className="p-8 space-y-8">
            <h1 className="text-3xl font-bold tracking-tight text-white">Обзор платформы</h1>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-zinc-900 border-zinc-800">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-zinc-400">Всего клубов</CardTitle>
                        <Activity className="h-4 w-4 text-purple-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-zinc-100">{stats?.total_clubs || 0}</div>
                        <p className="text-xs text-zinc-500">Зарегистрировано в системе</p>
                    </CardContent>
                </Card>

                <Card className="bg-zinc-900 border-zinc-800">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-zinc-400">Пользователей</CardTitle>
                        <Users className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-zinc-100">{stats?.total_users || 0}</div>
                        <p className="text-xs text-zinc-500">Включая владельцев и персонал</p>
                    </CardContent>
                </Card>

                <Card className="bg-zinc-900 border-zinc-800">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-zinc-400">Подписки</CardTitle>
                        <CreditCard className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-zinc-100">{stats?.paid_subscriptions || 0}</div>
                        <p className="text-xs text-zinc-500">{stats?.trial_subscriptions || 0} с временным доступом</p>
                    </CardContent>
                </Card>

                <Card className="bg-zinc-900 border-zinc-800">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-zinc-400">MRR (Эстимейт)</CardTitle>
                        <DollarSign className="h-4 w-4 text-yellow-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-zinc-100">
                            {Number(stats?.estimated_mrr || 0).toLocaleString('ru-RU')} ₽
                        </div>
                        <p className="text-xs text-zinc-500">На основе активных тарифов</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
