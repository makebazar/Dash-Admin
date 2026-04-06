"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import {
    LayoutDashboard,
    Users,
    Settings,
    Clock,
    DollarSign,
    Package,
    Wallet,
    ClipboardCheck,
    Briefcase,
    FileText,
    Calendar,
    Monitor,
    Shield,
    Loader2,
    MessageSquare,
    BookOpen,
    Headphones
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Club {
    id: string
    name: string
    address?: string | null
}

interface ClubSidebarProps {
    clubId: string
    club: Club | null
}

interface ClubSidebarContentProps {
    club: Club | null
    clubId: string
    onLinkClick?: () => void
}

export function ClubSidebarContent({ club, clubId, onLinkClick }: ClubSidebarContentProps) {
    const pathname = usePathname()
    const [permissions, setPermissions] = useState<Record<string, boolean>>({})
    const [isFullAccess, setIsFullAccess] = useState(false)
    const [subscriptionStatus, setSubscriptionStatus] = useState<string>("active")
    const [subscriptionIsActive, setSubscriptionIsActive] = useState(true)
    const [isLoading, setIsLoading] = useState(true)
    const [userRole, setUserRole] = useState<string | null>(null)

    useEffect(() => {
        const fetchMyPermissions = async () => {
            try {
                const res = await fetch(`/api/clubs/${clubId}/my-permissions`)
                const data = await res.json()
                if (res.ok) {
                    setPermissions(data.permissions || {})
                    setIsFullAccess(data.isFullAccess || false)
                    setSubscriptionStatus(data.subscription_status || "active")
                    setSubscriptionIsActive(data.subscription_is_active !== false)
                    setUserRole(data.user_role || null)
                }
            } catch (error) {
                console.error('Error fetching permissions:', error)
            } finally {
                setIsLoading(false)
            }
        }
        fetchMyPermissions()
    }, [clubId])

    const isExpiredForOwnerUi = isFullAccess && !subscriptionIsActive
    const hasPermission = (key: string) => isFullAccess || permissions[key] === true

    const mainLinks = [
        { href: `/clubs/${clubId}`, label: 'Дашборд', icon: <LayoutDashboard className="h-4 w-4" />, visible: hasPermission('view_dashboard') || isExpiredForOwnerUi },
        { href: `/clubs/${clubId}/shifts`, label: 'Смены', icon: <Clock className="h-4 w-4" />, visible: !isExpiredForOwnerUi && hasPermission('view_shifts') },
        { href: `/clubs/${clubId}/schedule`, label: 'График работы', icon: <Calendar className="h-4 w-4" />, visible: !isExpiredForOwnerUi && hasPermission('view_schedule') },
        { href: `/clubs/${clubId}/employees`, label: 'Сотрудники', icon: <Users className="h-4 w-4" />, visible: !isExpiredForOwnerUi && hasPermission('manage_employees') },
        { href: `/clubs/${clubId}/salaries`, label: 'Зарплаты', icon: <Wallet className="h-4 w-4" />, visible: !isExpiredForOwnerUi && hasPermission('view_salaries') },
        { href: `/clubs/${clubId}/requests`, label: 'Запросы сотрудников', icon: <MessageSquare className="h-4 w-4" />, visible: hasPermission('manage_employees') || isExpiredForOwnerUi },
        { href: `/clubs/${clubId}/finance`, label: 'Финансы', icon: <DollarSign className="h-4 w-4" />, visible: !isExpiredForOwnerUi && hasPermission('view_finance') },
        { href: `/clubs/${clubId}/inventory`, label: 'Склад', icon: <Package className="h-4 w-4" />, visible: !isExpiredForOwnerUi && hasPermission('manage_inventory') },
        { href: `/clubs/${clubId}/equipment`, label: 'Оборудование', icon: <Monitor className="h-4 w-4" />, visible: !isExpiredForOwnerUi && hasPermission('manage_equipment') },
        { href: `/clubs/${clubId}/kb`, label: 'База знаний', icon: <BookOpen className="h-4 w-4" />, visible: !isExpiredForOwnerUi },
        { href: `/clubs/${clubId}/reviews`, label: 'Центр проверок', icon: <ClipboardCheck className="h-4 w-4" />, visible: !isExpiredForOwnerUi && hasPermission('view_reviews') },
    ]

    const settingsLinks = [
        { href: `/clubs/${clubId}/settings/general`, label: 'Общие', icon: <Settings className="h-4 w-4" />, visible: !isExpiredForOwnerUi && hasPermission('manage_club_settings') },
        { href: `/clubs/${clubId}/settings/salary`, label: 'Зарплаты', icon: <Wallet className="h-4 w-4" />, visible: !isExpiredForOwnerUi && hasPermission('edit_salaries_settings') },
        { href: `/clubs/${clubId}/settings/reports`, label: 'Отчеты', icon: <FileText className="h-4 w-4" />, visible: !isExpiredForOwnerUi && hasPermission('manage_report_template') },
        { href: `/clubs/${clubId}/settings/checklists`, label: 'Чеклисты', icon: <ClipboardCheck className="h-4 w-4" />, visible: !isExpiredForOwnerUi && hasPermission('manage_checklists') },
        { href: `/clubs/${clubId}/settings/access`, label: 'Доступ', icon: <Shield className="h-4 w-4" />, visible: !isExpiredForOwnerUi && isFullAccess },
    ]

    return (
        <div className="flex h-full flex-col">
            {/* Logo */}
            <div className="flex h-16 items-center border-b border-border px-6">
                <Link href="/dashboard" className="flex items-center" onClick={onLinkClick}>
                    <span className="text-lg font-semibold">DashAdmin</span>
                </Link>
            </div>

            {/* Breadcrumb */}
            <div className="border-b border-border px-6 py-3">
                <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground" onClick={onLinkClick}>
                    ← Мои клубы
                </Link>
            </div>

            {/* Club Name */}
            <div className="border-b border-border px-6 py-4">
                <div className="space-y-1">
                    <span className="font-semibold">{club?.name || 'Загрузка...'}</span>
                    {club?.address ? (
                        <p className="text-sm text-muted-foreground">{club.address}</p>
                    ) : null}
                </div>
                {!subscriptionIsActive ? (
                    <p className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                        Подписка закончилась ({subscriptionStatus})
                    </p>
                ) : null}
                {/* Switch to Employee Cabinet Link for Managers */}
                {userRole === 'Управляющий' && (
                    <Link
                        href={`/employee/clubs/${clubId}`}
                        className="mt-2 flex items-center gap-2 rounded-md bg-purple-50 px-2 py-1.5 text-xs font-medium text-purple-600 hover:bg-purple-100 transition-colors"
                    >
                        <Briefcase className="h-3.5 w-3.5" />
                        Рабочий кабинет
                    </Link>
                )}
            </div>

            {/* Navigation */}
            <div className="flex-1 overflow-auto p-4">
                {isLoading ? (
                    <div className="flex items-center justify-center py-10">
                        <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
                    </div>
                ) : (
                    <>
                        <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Меню
                        </div>
                        <nav className="mb-6 space-y-1">
                            {mainLinks.filter(l => l.visible).map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    onClick={onLinkClick}
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

                        {settingsLinks.some(l => l.visible) && (
                            <>
                                <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Настройки
                                </div>
                                <nav className="space-y-1">
                                    {settingsLinks.filter(l => l.visible).map((link) => (
                                        <Link
                                            key={link.href}
                                            href={link.href}
                                            onClick={onLinkClick}
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
                            </>
                        )}

                        <div className="mt-6 border-t border-border pt-4">
                            <Link
                                href="/support"
                                onClick={onLinkClick}
                                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                            >
                                <Headphones className="h-4 w-4" />
                                Поддержка
                            </Link>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

export function useClubData(clubId: string) {
    const [club, setClub] = useState<Club | null>(null)

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

    useEffect(() => {
        fetchClub()
    }, [clubId])

    return { club }
}

export function ClubSidebar({ clubId, club }: ClubSidebarProps) {
    // If club is passed, use it. If not, fetch it (backward compatibility or hybrid)
    // But for now assuming club is passed from Server Component
    const data = club ? { club } : useClubData(clubId)

    return (
        <aside className="w-64 border-r border-border bg-card flex-col hidden md:flex">
            <ClubSidebarContent club={data.club} clubId={clubId} />
        </aside>
    )
}
