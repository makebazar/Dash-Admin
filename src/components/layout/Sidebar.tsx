import Link from "next/link"
import { usePathname } from "next/navigation"
import { Building2, LayoutDashboard, Settings, LogOut, Menu } from "lucide-react"
import { cn } from "@/lib/utils"

interface SidebarProps {
    clubs: Array<{ id: string; name: string }>
}

export function Sidebar({ clubs }: SidebarProps) {
    const pathname = usePathname()

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

                {/* Navigation */}
                <nav className="flex-1 space-y-1 p-4">
                    <div className="mb-6">
                        <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Главная
                        </h3>
                        <Link
                            href="/dashboard"
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
                <div className="border-t border-border p-4">
                    <Link
                        href="/settings"
                        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                        <Settings className="h-4 w-4" />
                        Настройки
                    </Link>
                    <button
                        className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                        onClick={() => {
                            // TODO: Implement logout
                            console.log("Logout")
                        }}
                    >
                        <LogOut className="h-4 w-4" />
                        Выйти
                    </button>
                </div>
            </div>
        </aside>
    )
}
