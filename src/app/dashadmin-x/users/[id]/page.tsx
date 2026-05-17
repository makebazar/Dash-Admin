"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface ClubDetail {
    id: string
    name: string
    address?: string | null
    role: string
    is_manager?: boolean
    employees_count: number
}

interface UserDetail {
    id: string
    full_name: string
    phone_number: string
    email?: string
    subscription_plan: string
    subscription_status: string
    subscription_started_at: string | null
    subscription_ends_at: string | null
    is_super_admin: boolean
    is_deleted?: boolean
    created_at: string
    last_login_at?: string
    owned_clubs: Array<ClubDetail> | null
    employee_clubs: Array<ClubDetail> | null
}

const SUBSCRIPTION_PLANS = ['starter', 'basic', 'pro', 'enterprise']
const SUBSCRIPTION_STATUSES = ['active', 'trialing', 'past_due', 'canceled']

export default function UserDetailPage() {
    const params = useParams()
    const router = useRouter()
    const [user, setUser] = useState<UserDetail | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isEditing, setIsEditing] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [deleteMode, setDeleteMode] = useState<'archive' | 'hard'>('archive')
    const [deletePhone, setDeletePhone] = useState('')
    const [deleteError, setDeleteError] = useState('')
    const [editForm, setEditForm] = useState({
        full_name: '',
        phone_number: '',
        subscription_plan: '',
        subscription_status: '',
        is_super_admin: false,
    })

    const fetchUser = () => {
        setIsLoading(true)
        fetch(`/api/dashadmin-x/users/${params.id}`, {
            credentials: 'include'
        })
            .then(res => res.json())
            .then(data => {
                if (data.user) {
                    setUser(data.user)
                    setEditForm({
                        full_name: data.user.full_name || '',
                        phone_number: data.user.phone_number || '',
                        subscription_plan: data.user.subscription_plan || 'starter',
                        subscription_status: data.user.subscription_status || 'active',
                        is_super_admin: data.user.is_super_admin || false,
                    })
                }
                setIsLoading(false)
            })
            .catch(() => setIsLoading(false))
    }

    useEffect(() => {
        fetchUser()
    }, [params.id])

    const handleSave = async () => {
        setIsSaving(true)
        try {
            const res = await fetch(`/api/dashadmin-x/users/${params.id}`, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editForm)
            })
            if (res.ok) {
                setIsEditing(false)
                fetchUser()
            }
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async () => {
        if (deletePhone !== user?.phone_number) {
            setDeleteError('Неверный номер телефона')
            return
        }

        setIsDeleting(true)
        setDeleteError('')
        try {
            const res = await fetch(`/api/dashadmin-x/users/${params.id}`, {
                method: 'DELETE',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone_confirm: deletePhone, mode: deleteMode })
            })
            const data = await res.json()
            if (res.ok) {
                router.push('/dashadmin-x/users')
            } else {
                setDeleteError(data.error || 'Ошибка удаления')
            }
        } catch {
            setDeleteError('Ошибка удаления')
        } finally {
            setIsDeleting(false)
        }
    }

    const isOwner = !!(user && ((user.owned_clubs?.length || 0) > 0 || user.is_super_admin))
    const isManager = !!(user && !isOwner && (user.employee_clubs?.some(c => c.is_manager) || false))

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return "—"
        return new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    }

    const formatDateTime = (dateStr: string | null) => {
        if (!dateStr) return "—"
        return new Date(dateStr).toLocaleString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    }

    const getStatusLabel = (status: string) => {
        const labels: Record<string, string> = {
            active: "Активна",
            trialing: "Пробный",
            past_due: "Просрочена",
            canceled: "Отменена",
        }
        return labels[status] || status
    }

    const getRoleBadge = (isOwner: boolean, isManager: boolean) => {
        if (isOwner) {
            return <span className="px-2 py-1 rounded-md bg-emerald-100 text-emerald-800 text-xs font-medium">Владелец</span>
        }
        if (isManager) {
            return <span className="px-2 py-1 rounded-md bg-amber-100 text-amber-800 text-xs font-medium">Управляющий</span>
        }
        return <span className="px-2 py-1 rounded-md bg-slate-100 text-slate-500 text-xs font-medium">Сотрудник</span>
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        )
    }

    if (!user) {
        return (
            <div className="p-8">
                <div className="max-w-2xl mx-auto text-center py-16">
                    <p className="text-lg text-slate-500">Пользователь не найден</p>
                    <Button onClick={() => router.push('/dashadmin-x/users')} className="mt-4">
                        Назад к списку
                    </Button>
                </div>
            </div>
        )
    }

    const allClubs = [
        ...(user.owned_clubs || []).map(c => ({ ...c, type: 'owned' as const })),
        ...(user.employee_clubs || []).map(c => ({ ...c, type: 'employee' as const })),
    ]

    return (
        <div className="p-6">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push('/dashadmin-x/users')}
                    >
                        Назад
                    </Button>
                    {!isEditing && !isDeleting && !user.is_deleted && (
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsEditing(true)}
                            >
                                Редактировать
                            </Button>
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => setIsDeleting(true)}
                            >
                                Удалить
                            </Button>
                        </div>
                    )}
                </div>

                {/* Name Block */}
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-slate-900">
                        {user.full_name || "Без имени"}
                    </h1>
                    <div className="flex items-center gap-2 mt-2">
                        {getRoleBadge(isOwner, isManager)}
                        {user.is_super_admin && (
                            <span className="px-2 py-1 rounded-md bg-black text-white text-xs font-bold">SUPER ADMIN</span>
                        )}
                        {user.is_deleted && (
                            <span className="px-2 py-1 rounded-md bg-red-100 text-red-800 text-xs font-medium">Архивирован</span>
                        )}
                    </div>
                    <p className="text-sm text-slate-400 mt-2">ID: {user.id}</p>
                </div>

                {/* Delete Form */}
                {isDeleting && (
                    <Card className="p-4 mb-4 border-red-200 bg-red-50">
                        <h3 className="font-medium text-red-800 mb-4">Удаление пользователя</h3>
                        
                        {/* Выбор режима */}
                        <div className="mb-4">
                            <p className="text-sm text-red-600 mb-2">Выберите тип удаления:</p>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="deleteMode"
                                        value="archive"
                                        checked={deleteMode === 'archive'}
                                        onChange={() => setDeleteMode('archive')}
                                    />
                                    <span className="text-sm">Архивировать</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="deleteMode"
                                        value="hard"
                                        checked={deleteMode === 'hard'}
                                        onChange={() => setDeleteMode('hard')}
                                    />
                                    <span className="text-sm text-red-700 font-medium">Удалить навсегда</span>
                                </label>
                            </div>
                        </div>

                        {/* Предупреждение для жёсткого удаления */}
                        {deleteMode === 'hard' && (
                            <div className="mb-4 p-3 bg-red-100 rounded-md">
                                <p className="text-sm text-red-800 font-medium">Внимание! При жёстком удалении:</p>
                                <ul className="text-sm text-red-700 mt-1 list-disc list-inside">
                                    <li>Пользователь будет удалён полностью</li>
                                    <li>Клубы останутся без владельца</li>
                                    <li>Сотрудники останутся в системе</li>
                                    <li>Восстановить данные будет невозможно</li>
                                </ul>
                            </div>
                        )}

                        <p className="text-sm text-red-600 mb-2">
                            Для подтверждения введите номер телефона: {user.phone_number}
                        </p>
                        <Input
                            type="tel"
                            placeholder="+7XXXXXXXXXX"
                            value={deletePhone}
                            onChange={e => setDeletePhone(e.target.value)}
                            className="mb-2"
                        />
                        {deleteError && (
                            <p className="text-sm text-red-600 mb-2">{deleteError}</p>
                        )}
                        <div className="flex gap-2">
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={handleDelete}
                            >
                                {deleteMode === 'hard' ? 'Удалить навсегда' : 'Архивировать'}
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setIsDeleting(false)
                                    setDeletePhone('')
                                    setDeleteError('')
                                    setDeleteMode('archive')
                                }}
                            >
                                Отмена
                            </Button>
                        </div>
                    </Card>
                )}

                {/* Edit Form */}
                {isEditing ? (
                    <Card className="p-4 mb-4">
                        <h3 className="font-medium mb-4">Редактирование</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-slate-500">Имя</label>
                                <Input
                                    value={editForm.full_name}
                                    onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))}
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-500">Телефон</label>
                                <Input
                                    value={editForm.phone_number}
                                    onChange={e => setEditForm(f => ({ ...f, phone_number: e.target.value }))}
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-500">Тариф</label>
                                <select
                                    value={editForm.subscription_plan}
                                    onChange={e => setEditForm(f => ({ ...f, subscription_plan: e.target.value }))}
                                    className="w-full mt-1 px-3 py-2 border rounded-md bg-white"
                                >
                                    {SUBSCRIPTION_PLANS.map(p => (
                                        <option key={p} value={p}>{p}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-slate-500">Статус подписки</label>
                                <select
                                    value={editForm.subscription_status}
                                    onChange={e => setEditForm(f => ({ ...f, subscription_status: e.target.value }))}
                                    className="w-full mt-1 px-3 py-2 border rounded-md bg-white"
                                >
                                    {SUBSCRIPTION_STATUSES.map(s => (
                                        <option key={s} value={s}>{getStatusLabel(s)}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="super_admin"
                                    checked={editForm.is_super_admin}
                                    onChange={e => setEditForm(f => ({ ...f, is_super_admin: e.target.checked }))}
                                />
                                <label htmlFor="super_admin" className="text-sm">Super Admin</label>
                            </div>
                            <div className="flex gap-2 pt-2">
                                <Button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    size="sm"
                                >
                                    {isSaving ? 'Сохранение...' : 'Сохранить'}
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={() => {
                                        setIsEditing(false)
                                        setEditForm({
                                            full_name: user.full_name || '',
                                            phone_number: user.phone_number || '',
                                            subscription_plan: user.subscription_plan || 'starter',
                                            subscription_status: user.subscription_status || 'active',
                                            is_super_admin: user.is_super_admin || false,
                                        })
                                    }}
                                    size="sm"
                                >
                                    Отмена
                                </Button>
                            </div>
                        </div>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        {/* Info Blocks */}
                        <Card className="p-4">
                            <p className="text-xs text-slate-500 mb-1">Телефон</p>
                            <p className="font-medium text-slate-900">{user.phone_number}</p>
                        </Card>

                        {/* Dates */}
                        <Card className="p-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs text-slate-500 mb-1">Дата регистрации</p>
                                    <p className="font-medium text-slate-900">{formatDate(user.created_at)}</p>
                                </div>
                                {user.last_login_at && (
                                    <div>
                                        <p className="text-xs text-slate-500 mb-1">Последний вход</p>
                                        <p className="font-medium text-slate-900">{formatDateTime(user.last_login_at)}</p>
                                    </div>
                                )}
                            </div>
                        </Card>

                        {/* Subscription */}
                        {isOwner && (
                            <Card className="p-4">
                                <p className="text-xs text-slate-500 mb-1">Тариф</p>
                                <p className="text-xl font-bold text-slate-900 capitalize mb-2">{user.subscription_plan}</p>
                                <p className="text-xs text-slate-500">
                                    Статус: <span className={cn(
                                        user.subscription_status === 'active' && "text-emerald-600",
                                        user.subscription_status === 'past_due' && "text-amber-600",
                                        user.subscription_status === 'canceled' && "text-slate-400"
                                    )}>{getStatusLabel(user.subscription_status)}</span>
                                </p>
                                {user.subscription_started_at && user.subscription_ends_at && (
                                    <p className="text-xs text-slate-400 mt-2">
                                        Действует до {formatDate(user.subscription_ends_at)}
                                    </p>
                                )}
                            </Card>
                        )}
                    </div>
                )}

                {/* Clubs */}
                {allClubs.length > 0 && (
                    <div className="mt-8">
                        <h2 className="text-lg font-semibold text-slate-900 mb-4">Клубы ({allClubs.length})</h2>
                        <div className="space-y-2">
                            {allClubs.map((club, idx) => (
                                <Card
                                    key={`${club.type}-${club.id}-${idx}`}
                                    className={cn(
                                        "p-3",
                                        club.type === 'owned' ? "border-emerald-200 bg-emerald-50" :
                                        club.is_manager ? "border-amber-200 bg-amber-50" : "bg-slate-50"
                                    )}
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-medium text-slate-900">{club.name}</p>
                                            {club.address && (
                                                <p className="text-xs text-slate-500 mt-1">{club.address}</p>
                                            )}
                                            <div className="flex items-center gap-3 mt-2">
                                                <span className="text-xs text-slate-400">ID: {club.id}</span>
                                                <span className="text-xs text-slate-400">|</span>
                                                <span className="text-xs text-slate-400">{club.employees_count} сотрудников</span>
                                            </div>
                                        </div>
                                        {club.type === 'owned' && (
                                            <span className="text-xs text-emerald-600 font-medium">Владелец</span>
                                        )}
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}