"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import {
    AlertTriangle,
    Clock,
    Settings,
    MapPin,
    LayoutGrid,
    ClipboardList,
    ArrowUpRight,
    Shirt
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { PageShell, PageHeader } from "@/components/layout/PageShell"

interface EquipmentStats {
    total: number
    active_issues: number
    overdue_tasks: number
    due_today_tasks: number
    expiring_warranty: number
}

export default function EquipmentDashboard() {
    const { clubId } = useParams()
    const [stats, setStats] = useState<EquipmentStats>({
        total: 0,
        active_issues: 0,
        overdue_tasks: 0,
        due_today_tasks: 0,
        expiring_warranty: 0
    })

    useEffect(() => {
        fetchStats()
    }, [clubId])

    const fetchStats = async () => {
        try {
            const res = await fetch(`/api/clubs/${clubId}/equipment/stats`, { cache: 'no-store' })
            const data = await res.json()

            if (res.ok) {
                setStats({
                    total: data.total || 0,
                    active_issues: data.active_issues || 0,
                    overdue_tasks: data.overdue_tasks || 0,
                    due_today_tasks: data.due_today_tasks || 0,
                    expiring_warranty: data.expiring_warranty || 0
                })
            }
        } catch (error) {
            console.error("Error fetching equipment stats:", error)
        }
    }

    const quickActions = [
        {
            title: "Рабочие места",
            description: "Обзор зон, мест и подключенного оборудования",
            href: `/clubs/${clubId}/equipment/workplaces`,
            icon: <MapPin className="h-6 w-6" />,
            color: "text-violet-500",
            bg: "bg-violet-50"
        },
        {
            title: "Инвентаризация",
            description: "Список всего оборудования и периферии",
            href: `/clubs/${clubId}/equipment/inventory`,
            icon: <LayoutGrid className="h-6 w-6" />,
            color: "text-blue-500",
            bg: "bg-blue-50"
        },
        {
            title: "Инциденты",
            description: "Проблемы, поломки и ремонты",
            href: `/clubs/${clubId}/equipment/issues`,
            icon: <AlertTriangle className="h-6 w-6" />,
            color: "text-amber-500",
            bg: "bg-amber-50"
        },
        {
            title: "График чистки",
            description: "Планирование и регламентные работы",
            href: `/clubs/${clubId}/equipment/maintenance`,
            icon: <ClipboardList className="h-6 w-6" />,
            color: "text-green-500",
            bg: "bg-green-50"
        },
        {
            title: "Стирка",
            description: "Очередь ковриков на стирку и возврат",
            href: `/clubs/${clubId}/laundry`,
            icon: <Shirt className="h-6 w-6" />,
            color: "text-cyan-500",
            bg: "bg-cyan-50"
        },
        {
            title: "Настройки",
            description: "Инструкции и параметры модуля оборудования",
            href: `/clubs/${clubId}/equipment/settings`,
            icon: <Settings className="h-6 w-6" />,
            color: "text-muted-foreground",
            bg: "bg-muted"
        }
    ]

    return (
        <PageShell maxWidth="7xl">
            <PageHeader
                title="Управление оборудованием"
                description="Комплексный контроль техники, периферии и её состояния"
            />

            {/* Key Signals */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Link href={`/clubs/${clubId}/equipment/issues`}>
                    <Card className="group h-full cursor-pointer border-none bg-gradient-to-br from-white to-amber-50/50 shadow-sm transition-all hover:shadow-md">
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div className="rounded-lg bg-amber-100 p-2">
                                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                                </div>
                                <div className="flex items-center gap-2">
                                    {stats.active_issues > 0 ? <Badge className="bg-amber-500 hover:bg-amber-500">Активно</Badge> : null}
                                    <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-all group-hover:opacity-100" />
                                </div>
                            </div>
                            <div className="mt-4">
                                <p className="text-3xl font-bold">{stats.active_issues}</p>
                                <p className="mt-1 text-sm font-medium text-foreground">Открытые инциденты</p>
                                <p className="mt-1 text-xs text-muted-foreground">Переход в раздел поломок, ремонтов и назначений</p>
                            </div>
                        </CardContent>
                    </Card>
                </Link>

                <Link href={`/clubs/${clubId}/equipment/maintenance`}>
                    <Card className="group h-full cursor-pointer border-none bg-gradient-to-br from-white to-rose-50/40 shadow-sm transition-all hover:shadow-md">
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div className="rounded-lg bg-rose-100 p-2">
                                    <Clock className="h-5 w-5 text-rose-600" />
                                </div>
                                <div className="flex items-center gap-2">
                                    {stats.overdue_tasks > 0 ? <Badge className="bg-rose-500 hover:bg-rose-500">Просрочено</Badge> : null}
                                    <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-all group-hover:opacity-100" />
                                </div>
                            </div>
                            <div className="mt-4">
                                <p className="text-3xl font-bold">{stats.overdue_tasks}</p>
                                <p className="mt-1 text-sm font-medium text-foreground">Просроченное обслуживание</p>
                                <p className="mt-1 text-xs text-muted-foreground">Переход к задачам чистки и контролю просрочки</p>
                            </div>
                        </CardContent>
                    </Card>
                </Link>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {quickActions.map((action) => (
                    <Link key={action.href} href={action.href}>
                        <Card className="group hover:border-primary/50 transition-all cursor-pointer h-full border-dashed overflow-hidden">
                            <CardContent className="p-!0">
                                <div className="flex h-full">
                                    <div className={cn("p-6 flex items-center justify-center transition-colors", action.bg, "group-hover:bg-primary/10")}>
                                        <div className={action.color}>{action.icon}</div>
                                    </div>
                                    <div className="p-4 flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <h3 className="font-bold text-sm">{action.title}</h3>
                                            <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-all text-muted-foreground" />
                                        </div>
                                        <p className="text-xs text-muted-foreground leading-relaxed">{action.description}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>

        </PageShell>
    )
}
