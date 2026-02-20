"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { Building2, LogOut, User, LayoutDashboard, Calendar, Brush, Clock, Menu, X, Crown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface Club {
    id: number
    name: string
}

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const router = useRouter()
    const [userName, setUserName] = useState('')
    const [clubs, setClubs] = useState<Club[]>([])
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const [hasOwnedClubs, setHasOwnedClubs] = useState(false)

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
            }
        } catch (error) {
            console.error('Error fetching user data:', error)
        }
    }

    const handleLogout = () => {
        document.cookie = 'session_user_id=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;'
        router.push('/login')
    }

    return (
        <div className="flex min-h-screen bg-background relative overflow-x-hidden">
            {/* Mobile Header */}
            <div className="md:hidden fixed top-0 left-0 right-0 h-16 border-b bg-card flex items-center justify-between px-4 z-40">
                <Link href="/employee/dashboard" className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-purple-500 to-blue-500">
                        <Building2 className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-lg font-semibold">DashAdmin</span>
                </Link>
                <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                    {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                </Button>
            </div>

            {/* Mobile Overlay */}
            {isMobileMenuOpen && (
                <div 
                    className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={cn(
                "fixed left-0 top-0 h-screen w-64 border-r border-border bg-card z-50 transition-transform duration-300 ease-in-out",
                isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
            )}>
                <div className="flex h-full flex-col">
                    {/* Logo */}
                    <div className="flex h-16 items-center border-b border-border px-6">
                        <Link href="/employee/dashboard" className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-purple-500 to-blue-500">
                                <Building2 className="h-5 w-5 text-white" />
                            </div>
                            <span className="text-lg font-semibold">DashAdmin</span>
                        </Link>
                    </div>

                    {/* User Info */}
                    <div className="border-b border-border px-6 py-4">
                        <div className="flex items-center gap-3">
                            <div className="flex-1">
                                <p className="text-sm font-medium">{userName || 'Сотрудник'}</p>
                                <p className="text-xs text-muted-foreground">Рабочий режим</p>
                            </div>
                        </div>
                    </div>

                    {/* Navigation - Clubs */}
                    <div className="flex-1 overflow-auto p-4">
                        <nav className="space-y-1">
                            {clubs.map((club) => {
                                const isClubActive = pathname.startsWith(`/employee/clubs/${club.id}`)
                                return (
                                    <div key={club.id} className="space-y-1 mt-2">
                                        {isClubActive && (
                                            <div className="space-y-1">
                                                <Link
                                                    href={`/employee/clubs/${club.id}`}
                                                    className={cn(
                                                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                                                        pathname === `/employee/clubs/${club.id}`
                                                            ? "bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 font-medium"
                                                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                                    )}
                                                >
                                                    <LayoutDashboard className="h-4 w-4" />
                                                    <span className="flex-1">Дашборд</span>
                                                </Link>
                                                <Link
                                                    href={`/employee/clubs/${club.id}/schedule`}
                                                    className={cn(
                                                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                                                        pathname.includes('/schedule')
                                                            ? "bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 font-medium"
                                                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                                    )}
                                                >
                                                    <Calendar className="h-4 w-4" />
                                                    <span className="flex-1">График смен</span>
                                                </Link>
                                                <Link
                                                    href={`/employee/clubs/${club.id}/tasks`}
                                                    className={cn(
                                                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                                                        pathname.includes('/tasks')
                                                            ? "bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 font-medium"
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
                                                            ? "bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 font-medium"
                                                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                                    )}
                                                >
                                                    <Clock className="h-4 w-4" />
                                                    <span className="flex-1">История смен</span>
                                                </Link>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </nav>
                    </div>

                    {/* Footer - Logout */}
                    <div className="border-t border-border p-4 space-y-1">
                        {hasOwnedClubs && (
                            <Link
                                href="/dashboard"
                                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-amber-600 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/30 transition-colors mb-2"
                            >
                                <Crown className="h-4 w-4" />
                                Кабинет владельца
                            </Link>
                        )}
                        <button
                            onClick={handleLogout}
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                        >
                            <LogOut className="h-4 w-4" />
                            <span>Выйти</span>
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="md:ml-64 flex-1 pt-16 md:pt-0 transition-all duration-300">
                {children}
            </main>
        </div>
    )
}
