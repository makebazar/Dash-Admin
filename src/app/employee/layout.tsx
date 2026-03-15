"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { Building2, LogOut, User, LayoutDashboard, Calendar, Brush, Clock, Menu, X, Crown, ClipboardCheck, Monitor, BookOpen } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface Club {
    id: number
    name: string
    subscription_status?: string
    subscription_is_active?: boolean
}

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const router = useRouter()
    const [userName, setUserName] = useState('')
    const [clubs, setClubs] = useState<Club[]>([])
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const [hasOwnedClubs, setHasOwnedClubs] = useState(false)
    const [hasExpiredSubscription, setHasExpiredSubscription] = useState(false)
    const [expiredClubNames, setExpiredClubNames] = useState<string[]>([])
    const hideMobileHeader = pathname?.includes('/employee/clubs/') && pathname?.includes('/evaluations/')
    const showMobileHeader = !hideMobileHeader
    const isPosRoute = pathname?.includes('/employee/clubs/') && pathname?.includes('/pos')

    useEffect(() => {
        fetchUserData()
    }, [])

    // Close mobile menu on route change
    useEffect(() => {
        setIsMobileMenuOpen(false)
    }, [pathname])

    const fetchUserData = async () => {
        try {
            const res = await fetch('/api/auth/me')
            const data = await res.json()

            if (res.ok) {
                setUserName(data.user.full_name)
                setClubs(data.employeeClubs)
                if (data.ownedClubs && data.ownedClubs.length > 0) {
                    setHasOwnedClubs(true)
                }
                setHasExpiredSubscription(Boolean(data.has_expired_club_subscription))
                const expiredNames = (data.employeeClubs || [])
                    .filter((club: Club) => club.subscription_is_active === false)
                    .map((club: Club) => club.name)
                setExpiredClubNames(expiredNames)
            }
        } catch (error) {
            console.error('Error fetching user data:', error)
        }
    }

    const handleLogout = () => {
        document.cookie = 'session_user_id=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;'
        router.push('/login')
    }

    if (isPosRoute) {
        return (
            <div className="min-h-[100dvh] bg-slate-950">
                {children}
            </div>
        )
    }

    return (
        <div className="flex min-h-[100dvh] bg-[#fafafa] relative flex-col">
            {/* Desktop & Mobile Header - фиксированный */}
            <header className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-black/5 bg-white/95 backdrop-blur-sm shadow-sm pointer-events-auto">
                <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-8">
                    <div className="flex items-center gap-2">
                        <Link href="/employee/dashboard" className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600">
                                <Building2 className="h-5 w-5 text-white" />
                            </div>
                            <span className="text-lg font-bold tracking-tight">DashAdmin</span>
                            <span className="ml-2 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold uppercase text-purple-600">
                                Сотрудник
                            </span>
                        </Link>
                    </div>

                    <div className="flex items-center gap-2">
                        {hasOwnedClubs && (
                            <Link href="/dashboard">
                                <Button variant="ghost" className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 flex items-center gap-2">
                                    <Crown className="h-4 w-4" />
                                    <span className="hidden sm:inline">Кабинет владельца</span>
                                </Button>
                            </Link>
                        )}
                        <Button 
                            variant="ghost" 
                            onClick={handleLogout}
                            className="text-slate-500 hover:text-red-600 hover:bg-red-50 flex items-center gap-2"
                        >
                            <LogOut className="h-4 w-4" />
                            <span className="hidden sm:inline">Выйти</span>
                        </Button>
                        <div className="md:hidden ml-2">
                            <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                                {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                            </Button>
                        </div>
                    </div>
                </div>
            </header>
            {hasExpiredSubscription ? (
                <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
                    Подписка закончилась{expiredClubNames.length ? `: ${expiredClubNames.join(', ')}` : ''}. Отправка отчетов и рабочие действия сотрудников доступны.
                </div>
            ) : null}

            <div className="flex flex-1 relative">
                {/* Mobile Overlay */}
                {isMobileMenuOpen && (
                    <div 
                        className="fixed inset-0 bg-black/50 z-40 md:hidden"
                        onClick={() => setIsMobileMenuOpen(false)}
                    />
                )}

                {/* Sidebar - only show if we are inside a club */}
                {pathname.includes('/employee/clubs/') && (
                    <aside className={cn(
                        "fixed left-0 top-16 h-[calc(100dvh-64px)] w-64 border-r border-border bg-card z-40 transition-transform duration-300 ease-in-out",
                        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
                    )}>
                        <div className="flex h-full flex-col">
                            {/* User Info (Optional, can be simplified) */}
                            <div className="border-b border-border px-6 py-4 bg-slate-50/50">
                                <p className="text-sm font-semibold truncate">{userName || 'Сотрудник'}</p>
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Рабочая область</p>
                            </div>

                            {/* Navigation - Clubs */}
                            <div className="flex-1 overflow-auto p-4">
                                <nav className="space-y-1">
                                    {clubs.map((club) => {
                                        const isClubActive = pathname.startsWith(`/employee/clubs/${club.id}`)
                                        if (!isClubActive) return null; // Only show menu for the active club in sidebar
                                        
                                        return (
                                            <div key={club.id} className="space-y-1 mt-2">
                                                <Link
                                                    href={`/employee/clubs/${club.id}`}
                                                    className={cn(
                                                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                                                        pathname === `/employee/clubs/${club.id}`
                                                            ? "bg-purple-100 text-purple-600 font-bold"
                                                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                                    )}
                                                >
                                                    <LayoutDashboard className="h-4 w-4" />
                                                    <span className="flex-1">Дашборд</span>
                                                </Link>
                                                {/* ... other links remain the same ... */}
                                                <Link
                                                    href={`/employee/clubs/${club.id}/schedule`}
                                                    className={cn(
                                                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                                                        pathname.includes('/schedule')
                                                            ? "bg-purple-100 text-purple-600 font-bold"
                                                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                                    )}
                                                >
                                                    <Calendar className="h-4 w-4" />
                                                    <span className="flex-1">График смен</span>
                                                </Link>
                                                <Link
                                                    href={`/employee/clubs/${club.id}/equipment`}
                                                    className={cn(
                                                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                                                        pathname.includes('/equipment')
                                                            ? "bg-purple-100 text-purple-600 font-bold"
                                                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                                    )}
                                                >
                                                    <Monitor className="h-4 w-4" />
                                                    <span className="flex-1">Оборудование</span>
                                                </Link>
                                                <Link
                                                    href={`/employee/clubs/${club.id}/tasks`}
                                                    className={cn(
                                                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                                                        pathname.includes('/tasks')
                                                            ? "bg-purple-100 text-purple-600 font-bold"
                                                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                                    )}
                                                >
                                                    <Brush className="h-4 w-4" />
                                                    <span className="flex-1">Обслуживание</span>
                                                </Link>
                                                <Link
                                                    href={`/employee/clubs/${club.id}/history`}
                                                    className={cn(
                                                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                                                        pathname.includes('/history')
                                                            ? "bg-purple-100 text-purple-600 font-bold"
                                                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                                    )}
                                                >
                                                    <Clock className="h-4 w-4" />
                                                    <span className="flex-1">История смен</span>
                                                </Link>
                                                <Link
                                                    href={`/employee/clubs/${club.id}/evaluations`}
                                                    className={cn(
                                                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                                                        pathname.includes('/evaluations')
                                                            ? "bg-purple-100 text-purple-600 font-bold"
                                                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                                    )}
                                                >
                                                    <ClipboardCheck className="h-4 w-4" />
                                                    <span className="flex-1">Проверки</span>
                                                </Link>
                                                <Link
                                                    href={`/employee/clubs/${club.id}/kb`}
                                                    className={cn(
                                                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                                                        pathname.includes('/kb')
                                                            ? "bg-purple-100 text-purple-600 font-bold"
                                                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                                    )}
                                                >
                                                    <BookOpen className="h-4 w-4" />
                                                    <span className="flex-1">База знаний</span>
                                                </Link>
                                            </div>
                                        )
                                    })}
                                </nav>
                            </div>
                        </div>
                    </aside>
                )}

                {/* Main Content */}
                <main className={cn(
                    "w-full min-w-0 flex-1 pt-16 pointer-events-auto",
                    pathname.includes('/employee/clubs/') ? "md:ml-64" : "ml-0"
                )}>
                    {children}
                </main>
            </div>
        </div>
    )
}
