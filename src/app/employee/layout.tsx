"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { Zap, LogOut, User, LayoutDashboard, Calendar, Brush, Clock, Menu, X, Crown, ClipboardCheck, Monitor, BookOpen, Headphones, Gamepad2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface Club {
    id: number
    name: string
    subscription_status?: string
    subscription_is_active?: boolean
    role?: string
}

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const router = useRouter()
    const [userName, setUserName] = useState('')
    const [clubs, setClubs] = useState<Club[]>([])
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const [hasOwnedClubs, setHasOwnedClubs] = useState(false)
    const [hasManagerClubs, setHasManagerClubs] = useState(false)
    const [hasExpiredSubscription, setHasExpiredSubscription] = useState(false)
    const [expiredClubNames, setExpiredClubNames] = useState<string[]>([])
    const hideMobileHeader = pathname?.includes('/employee/clubs/') && pathname?.includes('/evaluations/')
    const showMobileHeader = !hideMobileHeader
    const isPosRoute = pathname?.includes('/employee/clubs/') && pathname?.includes('/pos')
    const themeVars = {
        ['--background' as any]: 'oklch(0.13 0 0)',
        ['--card' as any]: 'oklch(0.16 0 0)',
        ['--popover' as any]: 'oklch(0.16 0 0)',
        ['--border' as any]: 'oklch(0.22 0 0)',
        ['--input' as any]: 'oklch(0.22 0 0)',
        ['--muted' as any]: 'oklch(0.20 0 0)',
        ['--accent' as any]: 'oklch(0.20 0 0)',
        ['--sidebar' as any]: 'oklch(0.14 0 0)',
        ['--sidebar-border' as any]: 'oklch(0.22 0 0)',
        ['--sidebar-accent' as any]: 'oklch(0.20 0 0)',
        ['--sidebar-primary' as any]: 'oklch(0.85 0 0)',
        ['--sidebar-primary-foreground' as any]: 'oklch(0.14 0 0)',
    }

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
                if (data.user?.legal_acceptance_required) {
                    router.push('/legal-consent')
                    return
                }
                setUserName(data.user.full_name)
                setClubs(data.employeeClubs)
                if (data.ownedClubs && data.ownedClubs.length > 0) {
                    setHasOwnedClubs(true)
                }
                // Check if user has manager clubs
                const managerClubs = (data.employeeClubs || []).filter(
                    (club: Club & { role?: string }) => 
                        club.role === 'Управляющий' || club.role === 'Manager'
                )
                if (managerClubs.length > 0) {
                    setHasManagerClubs(true)
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

    const handleLogout = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' })
        } catch (error) {
            console.error('Logout failed:', error)
        } finally {
            router.push('/login')
        }
    }

    if (isPosRoute) {
        return (
            <div className="dark min-h-[100dvh] bg-background text-foreground" style={themeVars}>
                {children}
            </div>
        )
    }

    return (
        <div className="dark flex min-h-[100dvh] bg-background text-foreground relative flex-col selection:bg-white/10" style={themeVars}>
            {/* Minimalist Dark Header */}
            <header className="fixed top-0 left-0 right-0 z-50 h-14 border-b border-border bg-background/80 backdrop-blur-md">
                <div className={cn(
                    "flex h-full items-center justify-between px-4 sm:px-6 w-full mx-auto",
                    pathname === '/employee/dashboard' && "max-w-4xl px-4 sm:px-8"
                )}>
                    <div className="flex items-center gap-3">
                        <Link href="/employee/dashboard" className="flex items-center gap-2 transition-opacity hover:opacity-80">
                            <Zap className="h-5 w-5 text-white fill-current" />
                            <span className="text-lg font-bold tracking-tight text-white">DashAdmin</span>
                        </Link>
                    </div>

                    <div className="flex items-center gap-1.5">
                        {(hasOwnedClubs || hasManagerClubs) && (
                            <Link href="/dashboard">
                                <Button variant="ghost" size="sm" className="h-8 text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-400/10 flex items-center gap-2">
                                    <Crown className="h-3.5 w-3.5" />
                                    <span className="hidden sm:inline">{hasOwnedClubs ? "Кабинет владельца" : "Управ кабинет"}</span>
                                </Button>
                            </Link>
                        )}
                        <Link href="/support">
                            <Button variant="ghost" size="sm" className="h-8 w-8 px-0 text-muted-foreground hover:text-foreground hover:bg-white/5">
                                <Headphones className="h-4 w-4" />
                            </Button>
                        </Link>
                        <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={handleLogout}
                            className="h-8 w-8 px-0 text-muted-foreground hover:text-rose-400 hover:bg-rose-400/10"
                        >
                            <LogOut className="h-4 w-4" />
                        </Button>
                        <div className="md:hidden ml-1">
                            <Button variant="ghost" size="sm" className="h-8 w-8 px-0" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                                {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>
                </div>
            </header>
            
            {hasExpiredSubscription && (
                <div className="fixed top-14 left-0 right-0 z-40 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-200 backdrop-blur-md flex items-center justify-center">
                    Подписка закончилась{expiredClubNames.length ? `: ${expiredClubNames.join(', ')}` : ''}. Отправка отчетов и рабочие действия доступны.
                </div>
            )}

            <div className={cn("flex flex-1 relative pt-14", hasExpiredSubscription && "mt-8")}>
                {/* Mobile Overlay */}
                {isMobileMenuOpen && (
                    <div 
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
                        onClick={() => setIsMobileMenuOpen(false)}
                    />
                )}

                {/* Sidebar - Sleek & Dark */}
                {pathname.includes('/employee/clubs/') && (
                    <aside className={cn(
                        "fixed left-0 top-14 bottom-0 w-64 border-r border-border bg-background/95 backdrop-blur-xl z-40 transition-transform duration-300 ease-in-out",
                        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
                        hasExpiredSubscription && "top-[88px]"
                    )}>
                        <div className="flex h-full flex-col">
                            {/* User Info */}
                            <div className="px-5 py-5">
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">{userName || 'Сотрудник'}</p>
                                    <p className="text-xs text-muted-foreground truncate">Онлайн</p>
                                </div>
                            </div>

                            {/* Navigation */}
                            <div className="flex-1 overflow-auto px-3 pb-4">
                                <nav className="space-y-6">
                                    {clubs.map((club) => {
                                        const isClubActive = pathname.startsWith(`/employee/clubs/${club.id}`)
                                        if (!isClubActive) return null;
                                        
                                        const navItems = [
                                            { href: `/employee/clubs/${club.id}`, icon: LayoutDashboard, label: "Дашборд" },
                                            { href: `/employee/clubs/${club.id}/schedule`, icon: Calendar, label: "График смен" },
                                            { href: `/employee/clubs/${club.id}/equipment`, icon: Monitor, label: "Рабочие места" },
                                            { href: `/employee/clubs/${club.id}/tasks`, icon: Brush, label: "Обслуживание" },
                                            { href: `/employee/clubs/${club.id}/calibration`, icon: Gamepad2, label: "Калибровка" },
                                            { href: `/employee/clubs/${club.id}/history`, icon: Clock, label: "История смен" },
                                            { href: `/employee/clubs/${club.id}/evaluations`, icon: ClipboardCheck, label: "Проверки" },
                                            { href: `/employee/clubs/${club.id}/kb`, icon: BookOpen, label: "База знаний" },
                                        ]

                                        return (
                                            <div key={club.id} className="space-y-1">
                                                <div className="px-2 mb-2">
                                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{club.name}</p>
                                                </div>

                                                {(club.role === 'Управляющий' || club.role === 'Manager') && (
                                                    <Link
                                                        href={`/clubs/${club.id}`}
                                                        className="group flex items-center gap-3 rounded-md px-2 py-1.5 text-sm text-amber-400/80 hover:text-amber-400 hover:bg-amber-400/10 transition-colors"
                                                    >
                                                        <Crown className="h-4 w-4 opacity-70 group-hover:opacity-100" />
                                                        <span className="font-medium">Управ кабинет</span>
                                                    </Link>
                                                )}
                                                
                                                {navItems.map((item) => {
                                                    const isActive = item.label === "Дашборд" 
                                                        ? pathname === item.href 
                                                        : pathname.includes(item.href.split('/').pop() || '')
                                                    
                                                    return (
                                                        <Link
                                                            key={item.href}
                                                            href={item.href}
                                                            className={cn(
                                                                "group flex items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors",
                                                                isActive
                                                                    ? "bg-white/10 text-white font-medium"
                                                                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                                                            )}
                                                        >
                                                            <item.icon className={cn("h-4 w-4 transition-colors", isActive ? "text-white" : "text-muted-foreground group-hover:text-foreground")} />
                                                            <span>{item.label}</span>
                                                        </Link>
                                                    )
                                                })}
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
                    "w-full min-w-0 flex-1 pointer-events-auto",
                    pathname.includes('/employee/clubs/') ? "md:ml-64" : "ml-0"
                )}>
                    {children}
                </main>
            </div>
        </div>
    )
}
