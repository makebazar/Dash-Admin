"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import {
    LayoutDashboard,
    Users,
    Settings,
    LogOut,
    Building2,
    Briefcase,
    FileText,
    Clock,
    DollarSign,
    Package,
    Wallet
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Club {
    id: string
    name: string
}

interface ClubSidebarProps {
    clubId: string
}

export function ClubSidebar({ clubId }: ClubSidebarProps) {
    const pathname = usePathname()
    const [club, setClub] = useState<Club | null>(null)

    useEffect(() => {
        fetchClub()
    }, [])

    const fetchClub = async () => {
        try {
            const res = await fetch(`/api/clubs/${clubId}`)
            const data = await res.json()
            if (res.ok) {
                setClub(data.club)
            }
        } catch (error) {
            console.error('Error fetching club:', error)
        }
    }

    const mainLinks = [
        { href: `/clubs/${clubId}`, label: 'Дашборд', icon: <LayoutDashboard className="h-4 w-4" /> },
        { href: `/clubs/${clubId}/shifts`, label: 'Смены', icon: <Clock className="h-4 w-4" /> },
        { href: `/clubs/${clubId}/employees`, label: 'Сотрудники', icon: <Users className="h-4 w-4" /> },
        { href: `/clubs/${clubId}/salaries`, label: 'Зарплаты', icon: <Wallet className="h-4 w-4" /> },
        { href: `/clubs/${clubId}/finance`, label: 'Финансы', icon: <DollarSign className="h-4 w-4" /> },
        { href: `/clubs/${clubId}/inventory`, label: 'Склад', icon: <Package className="h-4 w-4" /> },
    ]

    const settingsLinks = [
        { href: `/clubs/${clubId}/settings/general`, label: 'Общие', icon: <Settings className="h-4 w-4" /> },
        { href: `/clubs/${clubId}/settings/salary`, label: 'Зарплаты', icon: <Wallet className="h-4 w-4" /> },
        { href: `/clubs/${clubId}/settings/reports`, label: 'Отчеты', icon: <FileText className="h-4 w-4" /> },
    ]

    return (
        <aside className="fixed left-0 top-0 h-screen w-64 border-r border-border bg-card">
            <div className="flex h-full flex-col">
                {/* Logo */}
                <div className="flex h-16 items-center border-b border-border px-6">
                    <Link href="/dashboard" className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-purple-500 to-blue-500">
                            <Building2 className="h-5 w-5 text-white" />
                        </div>
                        <span className="text-lg font-semibold">DashAdmin</span>
                    </Link>
                </div>

                {/* Breadcrumb */}
                <div className="border-b border-border px-6 py-3">
                    <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
                        ← Мои клубы
                    </Link>
                </div>

                {/* Club Name */}
                <div className="border-b border-border px-6 py-4">
                    <div className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-purple-600" />
                        <span className="font-semibold">{club?.name || 'Загрузка...'}</span>
                    </div>
                </div>

                {/* Navigation */}
                <div className="flex-1 overflow-auto p-4">
                    <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Меню
                    </div>
                    <nav className="mb-6 space-y-1">
                        {mainLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={cn(
                                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                                    pathname === link.href
                                        ? "bg-accent text-accent-foreground"
                                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                )}
                            >
                                {link.icon}
                                {link.label}
                            </Link>
                        ))}
                    </nav>

                    <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Настройки
                    </div>
                    <nav className="space-y-1">
                        {settingsLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={cn(
                                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                                    pathname === link.href
                                        ? "bg-accent text-accent-foreground"
                                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                )}
                            >
                                {link.icon}
                                {link.label}
                            </Link>
                        ))}
                    </nav>
                </div>
            </div>
        </aside>
    )
}
