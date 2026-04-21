"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { LayoutDashboard, Database, CreditCard, Users, ShieldAlert, Briefcase, ArrowLeftCircle, Headphones, Tag, Building2, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react"
import React from "react"
import { Button } from "@/components/ui/button"
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut } from "@/components/ui/command"

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter()
    const pathname = usePathname()
    const [isAuthorized, setIsAuthorized] = useState(false)
    const [isCollapsed, setIsCollapsed] = useState(false)
    const [isCmdkOpen, setIsCmdkOpen] = useState(false)

    const backToWork = async () => {
        try {
            const res = await fetch('/api/auth/me')
            const data = await res.json()
            const ownedClubs = Array.isArray(data?.ownedClubs) ? data.ownedClubs : []
            const employeeClubs = Array.isArray(data?.employeeClubs) ? data.employeeClubs : []

            if (ownedClubs.length > 0) {
                router.push('/dashboard')
                return
            }
            if (employeeClubs.length > 0) {
                router.push('/employee/dashboard')
                return
            }
            router.push('/dashboard')
        } catch {
            router.push('/dashboard')
        }
    }

    useEffect(() => {
        fetch('/api/auth/me')
            .then(res => res.json())
            .then(data => {
                if (data?.user?.legal_acceptance_required) {
                    router.push('/legal-consent')
                    return
                }
                if (data?.user?.is_super_admin) {
                    setIsAuthorized(true)
                    return
                }
                router.push('/dashboard')
            })
            .catch(() => {
                router.push('/login')
            })
    }, [router])

    useEffect(() => {
        try {
            const saved = localStorage.getItem("super_admin_sidebar_collapsed")
            if (saved === "1") setIsCollapsed(true)
        } catch { }
    }, [])

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
                e.preventDefault()
                setIsCmdkOpen(true)
            }
        }
        window.addEventListener("keydown", onKeyDown)
        return () => window.removeEventListener("keydown", onKeyDown)
    }, [])

    if (!isAuthorized) return null

    const pageLabel =
        pathname === "/super-admin/dashboard" ? "Обзор" :
            pathname.startsWith("/super-admin/clubs") ? "Клубы" :
                pathname === "/super-admin/users" ? "Пользователи" :
                    pathname === "/super-admin/subscriptions" ? "Подписки" :
                        pathname === "/super-admin/tariffs" ? "Тарифы" :
                            pathname === "/super-admin/support" ? "Поддержка" :
                                pathname === "/super-admin/roles" ? "Должности" :
                                    pathname === "/super-admin/metrics" ? "Метрики" :
                                        "Super Admin"

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 flex">
            <aside className={`border-r border-zinc-800 bg-zinc-900/40 backdrop-blur ${isCollapsed ? "w-20" : "w-72"} transition-[width] duration-200`}>
                <div className="h-16 flex items-center justify-between gap-3 px-4 border-b border-zinc-800">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="h-9 w-9 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                            <ShieldAlert className="h-5 w-5 text-red-500" />
                        </div>
                        {!isCollapsed ? (
                            <div className="min-w-0">
                                <div className="truncate font-bold tracking-tight">Super Admin</div>
                                <div className="truncate text-xs text-zinc-500">Панель управления</div>
                            </div>
                        ) : null}
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => {
                                setIsCollapsed(v => {
                                    const next = !v
                                    try {
                                        localStorage.setItem("super_admin_sidebar_collapsed", next ? "1" : "0")
                                    } catch { }
                                    return next
                                })
                            }}
                            className="h-9 w-9 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 transition-colors"
                            title={isCollapsed ? "Развернуть меню" : "Свернуть меню"}
                        >
                            {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                        </button>

                        <button
                            type="button"
                            onClick={backToWork}
                            className="h-9 w-9 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 transition-colors"
                            title="Вернуться в рабочий аккаунт"
                        >
                            <ArrowLeftCircle className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                <nav className={`${isCollapsed ? "p-3" : "p-4"} space-y-1`}>
                    <NavLink href="/super-admin/dashboard" icon={<LayoutDashboard />} label="Обзор" active={pathname === '/super-admin/dashboard'} collapsed={isCollapsed} />
                    {!isCollapsed ? <div className="pt-4 pb-2 px-3 text-xs font-semibold text-zinc-500 uppercase">Платформа</div> : <div className="h-3" />}
                    <NavLink href="/super-admin/clubs" icon={<Building2 />} label="Клубы" active={pathname === '/super-admin/clubs' || pathname.startsWith('/super-admin/clubs/')} collapsed={isCollapsed} />
                    <NavLink href="/super-admin/users" icon={<Users />} label="Пользователи" active={pathname === '/super-admin/users'} collapsed={isCollapsed} />
                    <NavLink href="/super-admin/subscriptions" icon={<CreditCard />} label="Подписки" active={pathname === '/super-admin/subscriptions'} collapsed={isCollapsed} />
                    <NavLink href="/super-admin/tariffs" icon={<Tag />} label="Тарифы" active={pathname === '/super-admin/tariffs'} collapsed={isCollapsed} />
                    <NavLink href="/super-admin/roles" icon={<Briefcase />} label="Должности" active={pathname === '/super-admin/roles'} collapsed={isCollapsed} />
                    <NavLink href="/super-admin/metrics" icon={<Database />} label="Метрики и Отчеты" active={pathname === '/super-admin/metrics'} collapsed={isCollapsed} />
                    <NavLink href="/super-admin/support" icon={<Headphones />} label="Поддержка" active={pathname === '/super-admin/support'} collapsed={isCollapsed} />
                </nav>
            </aside>

            <main className="flex-1 overflow-auto bg-zinc-950">
                <div className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/70 backdrop-blur">
                    <div className="h-16 px-6 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-zinc-200">{pageLabel}</div>
                            <div className="truncate text-xs text-zinc-500">Cmd/Ctrl+K — поиск и команды</div>
                        </div>

                        <button
                            type="button"
                            onClick={() => setIsCmdkOpen(true)}
                            className="w-full max-w-[620px] rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-2 flex items-center gap-3 text-left text-sm text-zinc-400 hover:bg-zinc-900/70 transition-colors"
                        >
                            <Search className="h-4 w-4 text-zinc-500" />
                            <span className="flex-1">Поиск: клуб, пользователь, раздел…</span>
                            <span className="hidden sm:flex items-center gap-1">
                                <kbd className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-xs text-zinc-400">Ctrl</kbd>
                                <kbd className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-xs text-zinc-400">K</kbd>
                            </span>
                        </button>

                        <Button
                            variant="outline"
                            onClick={backToWork}
                            className="border-zinc-800 bg-transparent text-zinc-200 hover:bg-zinc-900"
                        >
                            В рабочий
                        </Button>
                    </div>
                </div>

                {children}
            </main>

            <CommandDialog open={isCmdkOpen} onOpenChange={setIsCmdkOpen}>
                <CommandInput placeholder="Перейти к разделу или выполнить действие…" />
                <CommandList>
                    <CommandEmpty>Ничего не найдено</CommandEmpty>

                    <CommandGroup heading="Навигация">
                        <CmdItem label="Обзор" shortcut="G D" onSelect={() => { setIsCmdkOpen(false); router.push("/super-admin/dashboard") }} />
                        <CmdItem label="Клубы" shortcut="G C" onSelect={() => { setIsCmdkOpen(false); router.push("/super-admin/clubs") }} />
                        <CmdItem label="Пользователи" shortcut="G U" onSelect={() => { setIsCmdkOpen(false); router.push("/super-admin/users") }} />
                        <CmdItem label="Подписки" shortcut="G S" onSelect={() => { setIsCmdkOpen(false); router.push("/super-admin/subscriptions") }} />
                        <CmdItem label="Тарифы" shortcut="G T" onSelect={() => { setIsCmdkOpen(false); router.push("/super-admin/tariffs") }} />
                        <CmdItem label="Поддержка" shortcut="G P" onSelect={() => { setIsCmdkOpen(false); router.push("/super-admin/support") }} />
                        <CmdItem label="Должности" shortcut="G R" onSelect={() => { setIsCmdkOpen(false); router.push("/super-admin/roles") }} />
                        <CmdItem label="Метрики" shortcut="G M" onSelect={() => { setIsCmdkOpen(false); router.push("/super-admin/metrics") }} />
                    </CommandGroup>

                    <CommandSeparator />

                    <CommandGroup heading="Действия">
                        <CmdItem
                            label={isCollapsed ? "Развернуть меню" : "Свернуть меню"}
                            shortcut="⌥ B"
                            onSelect={() => {
                                setIsCollapsed(v => {
                                    const next = !v
                                    try {
                                        localStorage.setItem("super_admin_sidebar_collapsed", next ? "1" : "0")
                                    } catch { }
                                    return next
                                })
                                setIsCmdkOpen(false)
                            }}
                        />
                        <CmdItem label="Вернуться в рабочий аккаунт" shortcut="⇧ W" onSelect={() => { setIsCmdkOpen(false); backToWork() }} />
                    </CommandGroup>
                </CommandList>
            </CommandDialog>
        </div>
    )
}

function NavLink({ href, icon, label, active, collapsed }: any) {
    return (
        <Link
            href={href}
            title={collapsed ? label : undefined}
            className={`flex items-center ${collapsed ? "justify-center" : "gap-3"} px-3 py-2 rounded-lg text-sm transition-colors ${active
                ? 'bg-red-500/10 text-red-200 border border-red-500/20'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 border border-transparent'
                }`}
        >
            {React.cloneElement(icon, { className: "h-4 w-4" })}
            {!collapsed ? <span className="truncate">{label}</span> : null}
        </Link>
    )
}

function CmdItem({ label, shortcut, onSelect }: { label: string, shortcut?: string, onSelect: () => void }) {
    return (
        <CommandItem
            value={label}
            onSelect={() => onSelect()}
            className="cursor-pointer"
        >
            <span>{label}</span>
            {shortcut ? <CommandShortcut>{shortcut}</CommandShortcut> : null}
        </CommandItem>
    )
}
