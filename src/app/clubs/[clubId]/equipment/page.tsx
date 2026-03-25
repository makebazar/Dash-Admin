"use client"

import { useEffect, useState, useMemo } from "react"
import { useParams } from "next/navigation"
import {
    Monitor,
    AlertTriangle,
    CheckCircle2,
    Clock,
    Plus,
    Settings,
    LayoutGrid,
    ClipboardList,
    History,
    ChevronRight,
    ArrowUpRight,
    Search,
    CheckSquare,
    Shirt
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
    const [isLoading, setIsLoading] = useState(true)
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
        } finally {
            setIsLoading(false)
        }
    }

    const quickActions = [
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
            title: "Мои задачи",
            description: "Список ваших задач на сегодня",
            href: `/clubs/${clubId}/equipment/my-tasks`,
            icon: <CheckCircle2 className="h-6 w-6" />,
            color: "text-indigo-500",
            bg: "bg-indigo-50"
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
            title: "Зоны и места",
            description: "Управление игровыми местами и залами",
            href: `/clubs/${clubId}/equipment/workplaces`,
            icon: <Settings className="h-6 w-6" />,
            color: "text-violet-500",
            bg: "bg-violet-50"
        },
        {
            title: "Проверка отчетов",
            description: "Верификация выполненных работ и фотоотчетов",
            href: `/clubs/${clubId}/checklists`,
            icon: <CheckSquare className="h-6 w-6" />,
            color: "text-rose-500",
            bg: "bg-rose-50"
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
            title: "История",
            description: "Лог перемещений и изменений",
            href: `/clubs/${clubId}/equipment/history`,
            icon: <History className="h-6 w-6" />,
            color: "text-slate-500",
            bg: "bg-slate-50"
        }
    ]

    return (
        <PageShell maxWidth="7xl">
            <PageHeader
                title="🖥 Управление оборудованием"
                description="Комплексный контроль техники, периферии и её состояния"
            >
                <Link href={`/clubs/${clubId}/equipment/inventory?action=new`}>
                    <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                        <Plus className="mr-2 h-4 w-4" />
                        Добавить технику
                    </Button>
                </Link>
            </PageHeader>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-none shadow-sm bg-gradient-to-br from-white to-slate-50">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <Monitor className="h-5 w-5 text-blue-600" />
                            </div>
                            <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider">Всего</Badge>
                        </div>
                        <div className="mt-4">
                            <p className="text-3xl font-bold">{stats.total}</p>
                            <p className="text-xs text-muted-foreground mt-1">единиц оборудования</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-gradient-to-br from-white to-slate-50">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div className="p-2 bg-amber-100 rounded-lg">
                                <AlertTriangle className="h-5 w-5 text-amber-600" />
                            </div>
                            {stats.active_issues > 0 && <Badge className="bg-amber-500 hover:bg-amber-600">Активно</Badge>}
                        </div>
                        <div className="mt-4">
                            <p className="text-3xl font-bold">{stats.active_issues}</p>
                            <p className="text-xs text-muted-foreground mt-1">открытых инцидентов</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-gradient-to-br from-white to-slate-50">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div className="p-2 bg-rose-100 rounded-lg">
                                <Clock className="h-5 w-5 text-rose-600" />
                            </div>
                            {stats.overdue_tasks > 0 && <Badge className="bg-rose-500">Просрочено</Badge>}
                        </div>
                        <div className="mt-4">
                            <p className="text-3xl font-bold">{stats.overdue_tasks}</p>
                            <p className="text-xs text-muted-foreground mt-1">задач вне графика</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-gradient-to-br from-white to-slate-50">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div className="p-2 bg-indigo-100 rounded-lg">
                                <Settings className="h-5 w-5 text-indigo-600" />
                            </div>
                            {stats.due_today_tasks > 0 && <Badge className="bg-indigo-500">На сегодня</Badge>}
                        </div>
                        <div className="mt-4">
                            <p className="text-3xl font-bold">{stats.due_today_tasks}</p>
                            <p className="text-xs text-muted-foreground mt-1">чисток запланировано</p>
                        </div>
                    </CardContent>
                </Card>
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

            {/* Bottom Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Recent Issues or Critical Alerts */}
                <Card className="lg:col-span-2 border-none shadow-sm overflow-hidden">
                    <CardHeader className="bg-slate-50/50">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-lg">Критическое состояние</CardTitle>
                                <CardDescription>Оборудование требующее немедленного внимания</CardDescription>
                            </div>
                            <Link href={`/clubs/${clubId}/equipment/issues`}>
                                <Button variant="ghost" size="sm" className="text-xs">
                                    Все проблемы
                                    <ChevronRight className="ml-1 h-3 w-3" />
                                </Button>
                            </Link>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-slate-100">
                            {stats.active_issues === 0 ? (
                                <div className="p-12 text-center">
                                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-100 mb-4">
                                        <CheckCircle2 className="h-6 w-6 text-green-600" />
                                    </div>
                                    <h3 className="text-sm font-semibold">Все чисто!</h3>
                                    <p className="text-xs text-muted-foreground mt-1">На данный момент нет открытых проблем с оборудованием.</p>
                                </div>
                            ) : (
                                <div className="p-8 text-muted-foreground text-center italic text-sm">
                                    Здесь будет список последних инцидентов...
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Right: Warranty Sidebar */}
                <Card className="border-none shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <ClipboardList className="h-5 w-5 text-indigo-500" />
                            Гарантии
                        </CardTitle>
                        <CardDescription>Ближайшие сроки истечения</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {stats.expiring_warranty > 0 ? (
                            <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 flex items-start gap-4">
                                <div className="p-2 bg-amber-200 rounded-lg text-amber-700">
                                    <AlertTriangle className="h-4 w-4" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-amber-800">{stats.expiring_warranty} девайсов</p>
                                    <p className="text-xs text-amber-700/80 mt-1">Гарантия истекает в ближайшие 30 дней.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="p-4 rounded-xl bg-slate-50 text-center">
                                <p className="text-xs text-muted-foreground">Нет оборудования с истекающей гарантией.</p>
                            </div>
                        )}

                        <Button variant="outline" className="w-full text-xs" disabled>
                            Проверить по реестру
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </PageShell>
    )
}
