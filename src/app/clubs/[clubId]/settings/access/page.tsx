"use client"

import { useEffect, useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Shield, ShieldCheck, ShieldAlert, Loader2, Info } from "lucide-react"
import { PageShell, PageHeader } from "@/components/layout/PageShell"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"

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
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
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

            <div className="grid gap-8 md:grid-cols-12">
                {/* Sidebar: Roles */}
                <div className="md:col-span-4 space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground px-2">Роли</h3>
                    <div className="space-y-1">
                        {roles
                            .filter(role => role.name !== 'Админ') // Скрываем Админа из списка настройки прав
                            .map(role => (
                            <button
                                key={role.id}
                                onClick={() => setActiveRole(role.id)}
                                className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-all ${
                                    activeRole === role.id 
                                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-200 scale-[1.02]' 
                                    : 'hover:bg-white hover:shadow-md text-muted-foreground'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <Shield className={`h-4 w-4 ${activeRole === role.id ? 'text-white' : 'text-purple-400'}`} />
                                    <span className="font-bold text-sm tracking-tight">{role.name}</span>
                                </div>
                                {role.name === 'Владелец' && (
                                    <Badge variant="outline" className={`text-[9px] uppercase border-white/20 text-white bg-white/10`}>
                                        Full Access
                                    </Badge>
                                )}
                            </button>
                        ))}
                    </div>

                    <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-2xl space-y-2 mt-6">
                        <div className="flex items-center gap-2 text-blue-700">
                            <Info className="h-4 w-4" />
                            <h4 className="text-xs font-bold uppercase tracking-wider">Подсказка</h4>
                        </div>
                        <p className="text-[11px] text-blue-600/80 leading-relaxed font-medium">
                            Права «Владельца» нельзя ограничить. Для остальных ролей изменения вступают в силу мгновенно.
                        </p>
                    </div>
                </div>

                {/* Main: Permissions Grid */}
                <div className="md:col-span-8 space-y-6">
                    {activeRole && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                            {categories.map(category => (
                                <div key={category} className="space-y-4">
                                    <div className="flex items-center gap-2 px-2">
                                        <div className="h-1 w-8 rounded-full bg-purple-200" />
                                        <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground">{category}</h4>
                                    </div>
                                    
                                    <div className="grid gap-3">
                                        {availablePermissions
                                            .filter(p => p.category === category)
                                            .map(permission => {
                                                const isAllowed = rolePermissions[activeRole]?.[permission.key] ?? false
                                                const isLocked = selectedRoleName === 'Владелец'

                                                return (
                                                    <Card key={permission.key} className={`border-none shadow-sm transition-all ${isAllowed ? 'bg-white' : 'bg-muted/30 opacity-80'}`}>
                                                        <CardContent className="p-4 flex items-center justify-between">
                                                            <div className="space-y-1">
                                                                <p className="text-sm font-bold tracking-tight text-foreground">{permission.label}</p>
                                                                <p className="text-[11px] text-muted-foreground font-medium">Доступ к разделу {permission.label}</p>
                                                            </div>
                                                            <div className="flex items-center gap-4">
                                                                <div className={`p-2 rounded-lg transition-colors ${isAllowed ? 'bg-emerald-50 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
                                                                    {isAllowed ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                                                                </div>
                                                                <Switch
                                                                    checked={isLocked || isAllowed}
                                                                    disabled={isLocked}
                                                                    onCheckedChange={(checked) => togglePermission(activeRole, permission.key, checked)}
                                                                    className="data-[state=checked]:bg-purple-600"
                                                                />
                                                            </div>
                                                        </CardContent>
                                                    </Card>
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
