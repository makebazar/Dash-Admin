"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { LayoutDashboard, Database, CreditCard, Users, ShieldAlert, Briefcase, ArrowLeftCircle } from "lucide-react"

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter()
    const pathname = usePathname()
    const [isAuthorized, setIsAuthorized] = useState(false)

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

    if (!isAuthorized) return null

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 flex">
            {/* Admin Sidebar */}
            <aside className="w-64 border-r border-zinc-800 bg-zinc-900/50">
                <div className="h-16 flex items-center justify-between px-6 border-b border-zinc-800">
                    <div className="flex items-center">
                        <ShieldAlert className="h-6 w-6 text-red-500 mr-2" />
                        <span className="font-bold text-lg tracking-tight">Super Admin</span>
                    </div>
                    <button
                        type="button"
                        onClick={backToWork}
                        className="text-zinc-400 hover:text-zinc-100 transition-colors"
                        title="Вернуться в рабочий аккаунт"
                    >
                        <ArrowLeftCircle className="h-5 w-5" />
                    </button>
                </div>

                <nav className="p-4 space-y-1">
                    <NavLink href="/super-admin/dashboard" icon={<LayoutDashboard />} label="Обзор" active={pathname === '/super-admin/dashboard'} />
                    <div className="pt-4 pb-2 px-3 text-xs font-semibold text-zinc-500 uppercase">Платформа</div>
                    <NavLink href="/super-admin/metrics" icon={<Database />} label="Метрики и Отчеты" active={pathname === '/super-admin/metrics'} />
                    <NavLink href="/super-admin/roles" icon={<Briefcase />} label="Должности" active={pathname === '/super-admin/roles'} />
                    <NavLink href="/super-admin/users" icon={<Users />} label="Пользователи" active={pathname === '/super-admin/users'} />
                    <NavLink href="/super-admin/subscriptions" icon={<CreditCard />} label="Подписки" active={pathname === '/super-admin/subscriptions'} />
                </nav>
            </aside>

            <main className="flex-1 overflow-auto bg-zinc-950">
                {children}
            </main>
        </div>
    )
}

function NavLink({ href, icon, label, active }: any) {
    return (
        <Link
            href={href}
            className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${active
                    ? 'bg-red-500/10 text-red-500 font-medium'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
                }`}
        >
            {React.cloneElement(icon, { className: "h-4 w-4" })}
            {label}
        </Link>
    )
}

import React from "react"
