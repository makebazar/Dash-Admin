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
    TrendingUp,
    Package,
    Wallet,
    ClipboardCheck,
    Briefcase,
    FileText,
    Calendar,
    Monitor,
    Tv,
    Shield,
    Trophy,
    Loader2,
    MessageSquare,
    BookOpen,
    Headphones,
    PanelLeftClose,
    PanelLeftOpen
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
    isCollapsed?: boolean
    onToggle?: () => void
}

export function ClubSidebarContent({ club, clubId, onLinkClick, isCollapsed = false, onToggle }: ClubSidebarContentProps) {
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
        { href: `/clubs/${clubId}`, label: 'Дашборд', icon: <LayoutDashboard className={cn("shrink-0", isCollapsed ? "h-5 w-5" : "h-4 w-4")} />, visible: hasPermission('view_dashboard') || isExpiredForOwnerUi },
        { href: `/clubs/${clubId}/shifts`, label: 'Смены', icon: <Clock className={cn("shrink-0", isCollapsed ? "h-5 w-5" : "h-4 w-4")} />, visible: !isExpiredForOwnerUi && hasPermission('view_shifts') },
        { href: `/clubs/${clubId}/sales-plan`, label: 'План продаж', icon: <TrendingUp className={cn("shrink-0", isCollapsed ? "h-5 w-5" : "h-4 w-4")} />, visible: !isExpiredForOwnerUi && hasPermission('view_shifts') },
        { href: `/clubs/${clubId}/schedule`, label: 'График работы', icon: <Calendar className={cn("shrink-0", isCollapsed ? "h-5 w-5" : "h-4 w-4")} />, visible: !isExpiredForOwnerUi && hasPermission('view_schedule') },
        { href: `/clubs/${clubId}/employees`, label: 'Сотрудники', icon: <Users className={cn("shrink-0", isCollapsed ? "h-5 w-5" : "h-4 w-4")} />, visible: !isExpiredForOwnerUi && hasPermission('manage_employees') },
        { href: `/clubs/${clubId}/salaries`, label: 'Зарплаты', icon: <Wallet className={cn("shrink-0", isCollapsed ? "h-5 w-5" : "h-4 w-4")} />, visible: !isExpiredForOwnerUi && hasPermission('view_salaries') },
        { href: `/clubs/${clubId}/requests`, label: 'Запросы сотрудников', icon: <MessageSquare className={cn("shrink-0", isCollapsed ? "h-5 w-5" : "h-4 w-4")} />, visible: hasPermission('manage_employees') || isExpiredForOwnerUi },
        { href: `/clubs/${clubId}/finance`, label: 'Финансы', icon: <DollarSign className={cn("shrink-0", isCollapsed ? "h-5 w-5" : "h-4 w-4")} />, visible: !isExpiredForOwnerUi && hasPermission('view_finance') },
        { href: `/clubs/${clubId}/inventory`, label: 'Склад', icon: <Package className={cn("shrink-0", isCollapsed ? "h-5 w-5" : "h-4 w-4")} />, visible: !isExpiredForOwnerUi && hasPermission('manage_inventory') },
        { href: `/clubs/${clubId}/equipment`, label: 'Оборудование', icon: <Monitor className={cn("shrink-0", isCollapsed ? "h-5 w-5" : "h-4 w-4")} />, visible: !isExpiredForOwnerUi && hasPermission('manage_equipment') },
        { href: `/clubs/${clubId}/tournaments`, label: 'Турниры', icon: <Trophy className={cn("shrink-0", isCollapsed ? "h-5 w-5" : "h-4 w-4")} />, visible: !isExpiredForOwnerUi && isFullAccess },
        { href: `/clubs/${clubId}/signage`, label: 'Экраны', icon: <Tv className={cn("shrink-0", isCollapsed ? "h-5 w-5" : "h-4 w-4")} />, visible: !isExpiredForOwnerUi && isFullAccess },
        { href: `/clubs/${clubId}/kb`, label: 'База знаний', icon: <BookOpen className={cn("shrink-0", isCollapsed ? "h-5 w-5" : "h-4 w-4")} />, visible: !isExpiredForOwnerUi },
        { href: `/clubs/${clubId}/reviews`, label: 'Центр проверок', icon: <ClipboardCheck className={cn("shrink-0", isCollapsed ? "h-5 w-5" : "h-4 w-4")} />, visible: !isExpiredForOwnerUi && hasPermission('view_reviews') },
    ]

    const settingsLinks = [
        { href: `/clubs/${clubId}/settings/general`, label: 'Общие', icon: <Settings className={cn("shrink-0", isCollapsed ? "h-5 w-5" : "h-4 w-4")} />, visible: !isExpiredForOwnerUi && hasPermission('manage_club_settings') },
        { href: `/clubs/${clubId}/settings/salary`, label: 'Зарплаты', icon: <Wallet className={cn("shrink-0", isCollapsed ? "h-5 w-5" : "h-4 w-4")} />, visible: !isExpiredForOwnerUi && hasPermission('edit_salaries_settings') },
        { href: `/clubs/${clubId}/settings/reports`, label: 'Отчеты', icon: <FileText className={cn("shrink-0", isCollapsed ? "h-5 w-5" : "h-4 w-4")} />, visible: !isExpiredForOwnerUi && hasPermission('manage_report_template') },
        { href: `/clubs/${clubId}/settings/checklists`, label: 'Чеклисты', icon: <ClipboardCheck className={cn("shrink-0", isCollapsed ? "h-5 w-5" : "h-4 w-4")} />, visible: !isExpiredForOwnerUi && hasPermission('manage_checklists') },
        { href: `/clubs/${clubId}/settings/access`, label: 'Доступ', icon: <Shield className={cn("shrink-0", isCollapsed ? "h-5 w-5" : "h-4 w-4")} />, visible: !isExpiredForOwnerUi && isFullAccess },
    ]

    return (
        <div className="flex h-full flex-col relative bg-white">
            {/* Collapse Toggle */}
            {onToggle && (
                <button
                    onClick={onToggle}
                    className="absolute -right-3 top-5 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm hover:text-black transition-colors z-20"
                >
                    {isCollapsed ? <PanelLeftOpen className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
                </button>
            )}

            {/* Logo */}
            <div className={cn("flex h-16 items-center border-b border-slate-100", isCollapsed ? "justify-center px-0" : "px-6")}>
                <Link href="/dashboard" className="flex items-center" onClick={onLinkClick}>
                    {isCollapsed ? (
                        <span className="text-xl font-black">D</span>
                    ) : (
                        <span className="text-lg font-black tracking-tight">DashAdmin</span>
                    )}
                </Link>
            </div>

            {/* Breadcrumb */}
            {!isCollapsed && (
                <div className="border-b border-slate-100 px-6 py-3">
                    <Link href="/dashboard" className="text-sm font-medium text-slate-400 hover:text-black transition-colors" onClick={onLinkClick}>
                        ← Мои клубы
                    </Link>
                </div>
            )}

            {/* Club Name */}
            <div className={cn("border-b border-slate-100 py-4", isCollapsed ? "px-2 text-center" : "px-6")}>
                {isCollapsed ? (
                    <div className="font-bold text-[10px] uppercase tracking-widest text-slate-400 truncate" title={club?.name || ''}>
                        {club?.name?.substring(0, 2) || '..'}
                    </div>
                ) : (
                    <div className="flex flex-col">
                        <div className="space-y-0.5">
                            <span className="font-bold text-slate-900 block">{club?.name || 'Загрузка...'}</span>
                            {club?.address && (
                                <span className="text-xs font-medium text-slate-500 block">{club.address}</span>
                            )}
                        </div>
                        {!subscriptionIsActive && (
                            <span className="mt-3 rounded-lg bg-rose-50 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-rose-700 block w-fit">
                                Подписка истекла
                            </span>
                        )}
                        {userRole === 'Управляющий' && (
                            <Link
                                href={`/employee/clubs/${clubId}`}
                                className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-black transition-colors"
                            >
                                <Briefcase className="h-3.5 w-3.5" />
                                Рабочий кабинет
                            </Link>
                        )}
                    </div>
                )}
            </div>

            {/* Navigation */}
            <div className="flex-1 overflow-auto py-4 px-3">
                {isLoading ? (
                    <div className="flex items-center justify-center py-10">
                        <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
                    </div>
                ) : (
                    <>
                        {!isCollapsed && (
                            <div className="mb-3 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                Меню
                            </div>
                        )}
                        <nav className="mb-8 space-y-1">
                            {mainLinks.filter(l => l.visible).map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    onClick={onLinkClick}
                                    title={isCollapsed ? link.label : undefined}
                                    className={cn(
                                        "flex items-center rounded-xl transition-all font-medium text-sm",
                                        isCollapsed ? "justify-center p-3" : "gap-3 px-3 py-2.5",
                                        pathname === link.href
                                            ? "bg-black text-white shadow-md"
                                            : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                                    )}
                                >
                                    {link.icon}
                                    {!isCollapsed && link.label}
                                </Link>
                            ))}
                        </nav>

                        {settingsLinks.some(l => l.visible) && (
                            <>
                                {!isCollapsed && (
                                    <div className="mb-3 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                        Настройки
                                    </div>
                                )}
                                <nav className="space-y-1">
                                    {settingsLinks.filter(l => l.visible).map((link) => (
                                        <Link
                                            key={link.href}
                                            href={link.href}
                                            onClick={onLinkClick}
                                            title={isCollapsed ? link.label : undefined}
                                            className={cn(
                                                "flex items-center rounded-xl transition-all font-medium text-sm",
                                                isCollapsed ? "justify-center p-3" : "gap-3 px-3 py-2.5",
                                                pathname === link.href
                                                    ? "bg-black text-white shadow-md"
                                                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                                            )}
                                        >
                                            {link.icon}
                                            {!isCollapsed && link.label}
                                        </Link>
                                    ))}
                                </nav>
                            </>
                        )}
                    </>
                )}
            </div>

            <div className="mt-auto border-t border-slate-100 p-3">
                <Link
                    href="/support"
                    onClick={onLinkClick}
                    title={isCollapsed ? "Поддержка" : undefined}
                    className={cn(
                        "flex items-center rounded-xl transition-all font-medium text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900",
                        isCollapsed ? "justify-center p-3" : "gap-3 px-3 py-2.5"
                    )}
                >
                    <Headphones className={cn("shrink-0", isCollapsed ? "h-5 w-5" : "h-4 w-4")} />
                    {!isCollapsed && "Поддержка"}
                </Link>
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
    const data = club ? { club } : useClubData(clubId)
    const [isCollapsed, setIsCollapsed] = useState(false)

    return (
        <aside className={cn(
            "border-r border-slate-200 bg-white flex-col hidden md:flex transition-all duration-300 z-10",
            isCollapsed ? "w-20" : "w-64"
        )}>
            <ClubSidebarContent club={data.club} clubId={clubId} isCollapsed={isCollapsed} onToggle={() => setIsCollapsed(!isCollapsed)} />
        </aside>
    )
}
