"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Building2, LayoutDashboard, Settings, LogOut, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"

interface SidebarProps {
    clubs: Array<{ id: string; name: string }>
    hasEmployeeClubs: boolean
    handleLogout: () => void
}

interface SidebarContentProps extends SidebarProps {
    onLinkClick?: () => void
}

export function SidebarContent({ clubs, hasEmployeeClubs, handleLogout, onLinkClick }: SidebarContentProps) {
    const pathname = usePathname()

    return (
        <div className="flex h-full flex-col">
            {/* Logo */}
            <div className="flex h-16 items-center border-b border-border px-6">
                <Link href="/dashboard" className="flex items-center gap-2" onClick={onLinkClick}>
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-purple-500 to-blue-500">
                        <Building2 className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-lg font-semibold">DashAdmin</span>
                </Link>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
                <div className="mb-6">
                    <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Главная
                    </h3>
                    <Link
                        href="/dashboard"
                        onClick={onLinkClick}
                        className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                            pathname === "/dashboard"
                                ? "bg-accent text-accent-foreground"
                                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        )}
                    >
                        <LayoutDashboard className="h-4 w-4" />
                        Мои клубы
                    </Link>
                </div>

                {clubs.length > 0 && (
                    <div>
                        <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Клубы
                        </h3>
                        <div className="space-y-1">
                            {clubs.map((club) => (
                                <div key={club.id} className="space-y-1">
                                    <Link
                                        href={`/clubs/${club.id}`}
                                        onClick={onLinkClick}
                                        className={cn(
                                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                                            pathname === `/clubs/${club.id}`
                                                ? "bg-accent text-accent-foreground"
                                                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                        )}
                                    >
                                        <Building2 className="h-4 w-4" />
                                        <span className="truncate">{club.name}</span>
                                    </Link>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </nav>

            {/* Footer */}
            <div className="border-t border-border p-4 space-y-1">
                {hasEmployeeClubs && (
                    <Link
                        href="/employee/dashboard"
                        onClick={onLinkClick}
                        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-purple-600 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-400 dark:hover:bg-purple-900/30 transition-colors mb-2"
                    >
                        <User className="h-4 w-4" />
                        Кабинет сотрудника
                    </Link>
                )}
                
                <Link
                    href="/settings"
                    onClick={onLinkClick}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                    <Settings className="h-4 w-4" />
                    Настройки
                </Link>
                <button
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    onClick={handleLogout}
                >
                    <LogOut className="h-4 w-4" />
                    Выйти
                </button>
            </div>
        </div>
    )
}

export function useSidebarLogic() {
    const router = useRouter()
    const [hasEmployeeClubs, setHasEmployeeClubs] = useState(false)

    const checkEmployeeStatus = async () => {
        try {
            const res = await fetch('/api/auth/me')
            const data = await res.json()
            if (res.ok && data.employeeClubs && data.employeeClubs.length > 0) {
                setHasEmployeeClubs(true)
            }
        } catch (error) {
            console.error('Error checking employee status:', error)
        }
    }

    useEffect(() => {
        checkEmployeeStatus()
    }, [])

    const handleLogout = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' })
            router.push('/login')
        } catch (error) {
            console.error('Logout failed:', error)
        }
    }

    return { hasEmployeeClubs, handleLogout }
}

export function Sidebar({ clubs, hasEmployeeClubs, handleLogout }: SidebarProps) {
    return (
        <aside className="fixed left-0 top-0 h-screen w-64 border-r border-border bg-card hidden md:flex flex-col z-30">
            <SidebarContent 
                clubs={clubs} 
                hasEmployeeClubs={hasEmployeeClubs} 
                handleLogout={handleLogout} 
            />
        </aside>
    )
}
