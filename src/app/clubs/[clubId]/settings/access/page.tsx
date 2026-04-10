"use client"

import { useEffect, useState, useMemo } from "react"
import { Shield, ShieldCheck, ShieldAlert, Loader2, Info } from "lucide-react"
import { PageShell, PageHeader } from "@/components/layout/PageShell"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"

interface Role {
    id: number
    name: string
}

interface Permission {
    key: string
    label: string
    category: string
}

export default function AccessSettingsPage({ params }: { params: Promise<{ clubId: string }> }) {
    const [clubId, setClubId] = useState('')
    const [roles, setRoles] = useState<Role[]>([])
    const [availablePermissions, setAvailablePermissions] = useState<Permission[]>([])
    const [rolePermissions, setRolePermissions] = useState<Record<number, Record<string, boolean>>>({})
    const [isLoading, setIsLoading] = useState(true)
    const [activeRole, setActiveRole] = useState<number | null>(null)

    useEffect(() => {
        params.then(p => {
            setClubId(p.clubId)
            fetchPermissions(p.clubId)
        })
    }, [params])

    const fetchPermissions = async (id: string) => {
        try {
            const res = await fetch(`/api/clubs/${id}/settings/permissions`)
            const data = await res.json()
            if (res.ok) {
                setRoles(data.roles)
                setAvailablePermissions(data.availablePermissions)
                setRolePermissions(data.rolePermissions || {})
                if (data.roles.length > 0) {
                    setActiveRole(data.roles[0].id)
                }
            }
        } catch (error) {
            console.error('Error:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const togglePermission = async (roleId: number, permissionKey: string, isAllowed: boolean) => {
        try {
            // Optimistic update
            setRolePermissions(prev => ({
                ...prev,
                [roleId]: {
                    ...(prev[roleId] || {}),
                    [permissionKey]: isAllowed
                }
            }))

            const res = await fetch(`/api/clubs/${clubId}/settings/permissions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roleId, permissionKey, isAllowed })
            })

            if (!res.ok) {
                // Rollback on error
                fetchPermissions(clubId)
                alert('Ошибка при сохранении прав')
            }
        } catch (error) {
            console.error('Error:', error)
            fetchPermissions(clubId)
        }
    }

    const categories = useMemo(() => {
        const cats = new Set(availablePermissions.map(p => p.category))
        return Array.from(cats)
    }, [availablePermissions])

    if (isLoading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        )
    }

    const selectedRoleName = roles.find(r => r.id === activeRole)?.name || ''
    const isOwnerOrAdmin = selectedRoleName === 'Владелец' || selectedRoleName === 'Админ'

    return (
        <PageShell maxWidth="4xl">
            <PageHeader
                title="Управление доступом"
                description="Настройте права доступа для каждой роли в вашем клубе"
            />

            <div className="grid gap-8 md:grid-cols-12 lg:gap-12">
                {/* Sidebar: Roles */}
                <div className="md:col-span-4 lg:col-span-3 space-y-6">
                    <h3 className="text-sm font-semibold text-slate-900 px-1">Роли</h3>
                    <div className="space-y-2">
                        {roles
                            .filter(role => role.name !== 'Админ') // Скрываем Админа из списка настройки прав
                            .map(role => (
                            <button
                                key={role.id}
                                onClick={() => setActiveRole(role.id)}
                                className={`w-full flex items-center justify-between p-4 rounded-2xl text-left transition-all duration-200 border ${
                                    activeRole === role.id 
                                    ? 'bg-slate-900 text-white border-slate-900 shadow-md' 
                                    : 'bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50 hover:shadow-sm text-slate-600'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <Shield className={`h-5 w-5 ${activeRole === role.id ? 'text-white' : 'text-slate-400'}`} />
                                    <span className="font-medium text-sm tracking-tight">{role.name}</span>
                                </div>
                                {role.name === 'Владелец' && (
                                    <Badge variant="outline" className={`text-[10px] font-semibold uppercase tracking-wider border-white/20 text-white bg-white/10 rounded-lg px-2`}>
                                        Full Access
                                    </Badge>
                                )}
                            </button>
                        ))}
                    </div>

                    <div className="bg-slate-50/50 border border-slate-100 p-5 rounded-3xl space-y-3 mt-8">
                        <div className="flex items-center gap-2 text-slate-700">
                            <Info className="h-4 w-4" />
                            <h4 className="text-sm font-medium">Подсказка</h4>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">
                            Права «Владельца» нельзя ограничить. Для остальных ролей изменения вступают в силу мгновенно.
                        </p>
                    </div>
                </div>

                {/* Main: Permissions Grid */}
                <div className="md:col-span-8 lg:col-span-9">
                    {activeRole && (
                        <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
                            {categories.map(category => (
                                <div key={category} className="space-y-4">
                                    <div className="flex items-center gap-3 px-1">
                                        <div className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                                        <h4 className="text-sm font-semibold text-slate-900">{category}</h4>
                                    </div>
                                    
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        {availablePermissions
                                            .filter(p => p.category === category)
                                            .map(permission => {
                                                const isAllowed = rolePermissions[activeRole]?.[permission.key] ?? false
                                                const isLocked = selectedRoleName === 'Владелец'

                                                return (
                                                    <div key={permission.key} className={`flex items-center justify-between p-5 rounded-3xl border transition-all duration-200 ${isAllowed ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-50/50 border-slate-100/50 opacity-70'}`}>
                                                        <div className="space-y-1 pr-4">
                                                            <p className="text-sm font-medium text-slate-900">{permission.label}</p>
                                                            <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">Доступ к разделу {permission.label}</p>
                                                        </div>
                                                        <div className="flex items-center gap-4 shrink-0">
                                                            <div className={`p-2 rounded-xl transition-colors ${isAllowed ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                                                {isAllowed ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                                                            </div>
                                                            <Switch
                                                                checked={isLocked || isAllowed}
                                                                disabled={isLocked}
                                                                onCheckedChange={(checked) => togglePermission(activeRole, permission.key, checked)}
                                                                className="data-[state=checked]:bg-slate-900"
                                                            />
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </PageShell>
    )
}
