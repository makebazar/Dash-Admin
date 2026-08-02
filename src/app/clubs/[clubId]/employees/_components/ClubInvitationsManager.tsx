"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Copy, Check, Plus, Loader2, Trash2 } from 'lucide-react'

type Role = {
    id: number
    name: string
}

type Invitation = {
    id: string
    role: string
    role_id: number | null
    token: string
    invitation_type: string
    max_uses: number
    uses_count: number
    expires_at: string | null
    created_at: string
}

export function ClubInvitationsManager({ clubId }: { clubId: string }) {
    const [invitations, setInvitations] = useState<Invitation[]>([])
    const [systemRoles, setSystemRoles] = useState<Role[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isOpen, setIsOpen] = useState(false)
    const [isCreating, setIsCreating] = useState(false)
    const [copiedToken, setCopiedToken] = useState<string | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    const [selectedRoleId, setSelectedRoleId] = useState<string>('')
    const [invitationType, setInvitationType] = useState<'single' | 'multi'>('multi')
    const [maxUses, setMaxUses] = useState('10')
    const [daysValid, setDaysValid] = useState('30')

    const fetchData = async () => {
        try {
            const [invRes, rolesRes] = await Promise.all([
                fetch(`/api/clubs/${clubId}/invitations`),
                fetch('/api/roles')
            ])

            if (invRes.ok) {
                const invData = await invRes.json()
                setInvitations(invData.invitations || [])
            }

            if (rolesRes.ok) {
                const rolesData = await rolesRes.json()
                const rolesList = rolesData.roles || []
                setSystemRoles(rolesList)
                if (rolesList.length > 0 && !selectedRoleId) {
                    setSelectedRoleId(String(rolesList[0].id))
                }
            }
        } catch (err) {
            console.error(err)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [clubId])

    const handleCreateInvitation = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedRoleId) return

        const selectedRoleObj = systemRoles.find(r => String(r.id) === String(selectedRoleId))
        const roleName = selectedRoleObj ? selectedRoleObj.name : ''

        setIsCreating(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/invitations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    role: roleName,
                    role_id: parseInt(selectedRoleId, 10),
                    invitation_type: invitationType,
                    max_uses: maxUses,
                    days_valid: daysValid
                })
            })
            if (res.ok) {
                setIsOpen(false)
                fetchData()
            }
        } catch (err) {
            console.error(err)
        } finally {
            setIsCreating(false)
        }
    }

    const handleDeleteInvitation = async (id: string) => {
        setDeletingId(id)
        try {
            const res = await fetch(`/api/clubs/${clubId}/invitations?id=${id}`, {
                method: 'DELETE'
            })
            if (res.ok) {
                setInvitations(prev => prev.filter(inv => inv.id !== id))
            }
        } catch (err) {
            console.error(err)
        } finally {
            setDeletingId(null)
        }
    }

    const copyToClipboard = (token: string) => {
        const url = `${window.location.origin}/invite/${token}`
        navigator.clipboard.writeText(url)
        setCopiedToken(token)
        setTimeout(() => setCopiedToken(null), 2500)
    }

    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            {/* Header section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h3 className="font-semibold text-slate-900 text-base tracking-tight">Ссылки-приглашения для сотрудников</h3>
                    <p className="text-sm text-slate-500 mt-0.5">Создавайте персональные или массовые ссылки для регистрации сотрудников</p>
                </div>

                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm px-5 h-11 rounded-xl shadow-xs transition-all flex items-center gap-2 shrink-0 self-start sm:self-auto">
                            <Plus className="w-4 h-4" />
                            <span>Создать ссылку</span>
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-white border border-slate-200 text-slate-900 rounded-2xl p-6 sm:max-w-md shadow-2xl">
                        <DialogHeader className="pb-2">
                            <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">Новая ссылка-приглашение</DialogTitle>
                        </DialogHeader>

                        <form onSubmit={handleCreateInvitation} className="space-y-4 pt-2">
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold text-slate-700">Должность / Роль в системе</Label>
                                <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                                    <SelectTrigger className="bg-slate-50 border-slate-200 text-slate-900 rounded-xl h-11 text-sm focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
                                        <SelectValue placeholder="Выберите должность" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white border-slate-200 text-slate-900 rounded-xl shadow-lg">
                                        {systemRoles.map((r) => (
                                            <SelectItem key={r.id} value={String(r.id)} className="focus:bg-slate-100 focus:text-slate-900 rounded-lg">
                                                {r.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-semibold text-slate-700">Тип ссылки</Label>
                                <Select value={invitationType} onValueChange={(val: any) => setInvitationType(val)}>
                                    <SelectTrigger className="bg-slate-50 border-slate-200 text-slate-900 rounded-xl h-11 text-sm focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white border-slate-200 text-slate-900 rounded-xl shadow-lg">
                                        <SelectItem value="multi" className="focus:bg-slate-100 focus:text-slate-900 rounded-lg">Многоразовая ссылка (для группы)</SelectItem>
                                        <SelectItem value="single" className="focus:bg-slate-100 focus:text-slate-900 rounded-lg">Одноразовая ссылка (для 1 человека)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {invitationType === 'multi' && (
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold text-slate-700">Лимит использований</Label>
                                    <Input
                                        type="number"
                                        value={maxUses}
                                        onChange={(e) => setMaxUses(e.target.value)}
                                        className="bg-slate-50 border-slate-200 text-slate-900 rounded-xl h-11 text-sm focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                    />
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label className="text-xs font-semibold text-slate-700">Срок действия (дней)</Label>
                                <Input
                                    type="number"
                                    value={daysValid}
                                    onChange={(e) => setDaysValid(e.target.value)}
                                    className="bg-slate-50 border-slate-200 text-slate-900 rounded-xl h-11 text-sm focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                />
                            </div>

                            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-xl h-11 font-medium text-sm mt-4 shadow-sm transition-all" disabled={isCreating}>
                                {isCreating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                Создать ссылку
                            </Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* List section */}
            {isLoading ? (
                <div className="py-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> Загрузка приглашений...
                </div>
            ) : invitations.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-500 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                    Пока нет активных ссылок-приглашений. Нажмите «Создать ссылку» выше.
                </div>
            ) : (
                <div className="space-y-3">
                    {invitations.map((inv) => (
                        <div key={inv.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50/80 border border-slate-200/80 hover:border-slate-300 rounded-xl transition-all">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-semibold text-slate-900 text-sm">{inv.role}</span>
                                    {inv.invitation_type === 'single' && (
                                        <span className="bg-slate-200/80 text-slate-700 text-xs px-2.5 py-0.5 rounded-full font-medium">
                                            Одноразовая
                                        </span>
                                    )}
                                </div>
                                <div className="text-slate-500 text-xs flex items-center gap-3">
                                    <span>Использовано: <strong className="text-slate-800 font-semibold">{inv.uses_count} / {inv.invitation_type === 'single' ? 1 : inv.max_uses}</strong></span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                <Button
                                    size="sm"
                                    className={`h-10 px-4 rounded-xl font-medium text-xs transition-all flex items-center gap-2 shadow-xs ${
                                        copiedToken === inv.token
                                            ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                                            : 'bg-slate-900 hover:bg-slate-800 text-white'
                                    }`}
                                    onClick={() => copyToClipboard(inv.token)}
                                >
                                    {copiedToken === inv.token ? (
                                        <>
                                            <Check className="w-4 h-4 text-white" />
                                            <span>Ссылка скопирована</span>
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="w-4 h-4 text-slate-300" />
                                            <span>Скопировать ссылку</span>
                                        </>
                                    )}
                                </Button>

                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-10 w-10 p-0 rounded-xl border-slate-200 hover:border-red-200 hover:bg-red-50 text-slate-400 hover:text-red-600 transition-all shrink-0"
                                    title="Удалить ссылку"
                                    disabled={deletingId === inv.id}
                                    onClick={() => handleDeleteInvitation(inv.id)}
                                >
                                    {deletingId === inv.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                                    ) : (
                                        <Trash2 className="w-4 h-4" />
                                    )}
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
