"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Loader2, Search, Building2, Trash2, Plus, Crown, Users, AlertTriangle } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { SuperAdminPage } from "../_components/page-shell"

interface DirectoryUser {
    id: string
    full_name: string
    phone_number: string
    is_super_admin: boolean
}

interface ClubEmployee {
    id: string
    full_name: string
    phone_number: string
    role: string
    hired_at: string
    is_primary?: boolean
}

interface ClubOwner {
    id: string
    full_name: string
    phone_number: string
    is_primary: boolean
}

interface ClubItem {
    id: number
    public_id: string
    name: string
    address: string | null
    created_at: string
    owners: ClubOwner[]
    employees: ClubEmployee[]
}

export default function SuperAdminUsersPage() {
    const [clubs, setClubs] = useState<ClubItem[]>([])
    const [users, setUsers] = useState<DirectoryUser[]>([])
    const [selectedClubId, setSelectedClubId] = useState<number | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [clubSearch, setClubSearch] = useState("")
    const [isUpdating, setIsUpdating] = useState(false)
    const [isDeleteClubOpen, setIsDeleteClubOpen] = useState(false)
    const [isDeletingClub, setIsDeletingClub] = useState(false)
    const [selectedUserId, setSelectedUserId] = useState("")
    const [selectedRole, setSelectedRole] = useState("Сотрудник")

    useEffect(() => {
        fetchDirectory()
    }, [])

    const fetchDirectory = async (preserveClubId?: number | null) => {
        setIsLoading(true)
        try {
            const res = await fetch('/api/super-admin/clubs')
            const data = await res.json()
            if (res.ok) {
                setClubs(data.clubs || [])
                setUsers(data.users)
                const targetClubId = preserveClubId ?? selectedClubId
                const hasSelected = data.clubs?.some((club: ClubItem) => club.id === targetClubId)
                if (hasSelected) {
                    setSelectedClubId(targetClubId)
                } else if (data.clubs?.length > 0) {
                    setSelectedClubId(data.clubs[0].id)
                } else {
                    setSelectedClubId(null)
                }
            }
        } catch (error) {
            console.error('Error fetching directory:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const selectedClub = clubs.find(club => club.id === selectedClubId) || null

    const handleAssignToClub = async () => {
        if (!selectedClub || !selectedUserId) return
        if (selectedRole === "Владелец") {
            const confirmed = confirm("Добавить пользователя в список владельцев клуба?")
            if (!confirmed) return
        }
        setIsUpdating(true)
        try {
            const res = await fetch('/api/super-admin/clubs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    targetUserId: selectedUserId,
                    clubId: selectedClub.id,
                    role: selectedRole
                })
            })

            if (res.ok) {
                setSelectedUserId("")
                await fetchDirectory(selectedClub.id)
            }
        } catch (error) {
            console.error('Error assigning to club:', error)
        } finally {
            setIsUpdating(false)
        }
    }

    const handleRemoveFromClub = async (clubId: string | number) => {
        if (!selectedClub) return
        if (!confirm('Удалить пользователя из этого клуба?')) return

        setIsUpdating(true)
        try {
            const res = await fetch(`/api/super-admin/clubs?userId=${clubId}&clubId=${selectedClub.id}`, {
                method: 'DELETE'
            })

            if (res.ok) {
                await fetchDirectory(selectedClub.id)
            }
        } catch (error) {
            console.error('Error removing from club:', error)
        } finally {
            setIsUpdating(false)
        }
    }

    const handleDeleteClub = async () => {
        if (!selectedClub) return
        setIsDeletingClub(true)
        try {
            const res = await fetch(`/api/super-admin/clubs?mode=delete-club&clubId=${selectedClub.id}`, {
                method: 'DELETE'
            })
            if (res.ok) {
                setIsDeleteClubOpen(false)
                await fetchDirectory()
            }
        } catch (error) {
            console.error('Error deleting club:', error)
        } finally {
            setIsDeletingClub(false)
        }
    }

    const handleDeleteUnassignedUser = async (targetUserId: string) => {
        const targetUser = users.find(user => user.id === targetUserId)
        if (!targetUser) return
        const confirmed = confirm(`Удалить пользователя ${targetUser.full_name} из системы?`)
        if (!confirmed) return

        setIsUpdating(true)
        try {
            const res = await fetch('/api/super-admin/users', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetUserId })
            })
            if (res.ok) {
                await fetchDirectory(selectedClubId)
            } else {
                const data = await res.json().catch(() => ({}))
                alert(data.error || 'Не удалось удалить пользователя')
            }
        } catch (error) {
            console.error('Error deleting unassigned user:', error)
            alert('Ошибка удаления пользователя')
        } finally {
            setIsUpdating(false)
        }
    }

    const handleSetPrimaryOwner = async (ownerId: string) => {
        if (!selectedClub) return
        const confirmed = confirm("Сделать этого владельца основным?")
        if (!confirmed) return
        setIsUpdating(true)
        try {
            const res = await fetch('/api/super-admin/clubs', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: 'set-primary-owner',
                    clubId: selectedClub.id,
                    targetUserId: ownerId
                })
            })
            if (res.ok) {
                await fetchDirectory(selectedClub.id)
            }
        } catch (error) {
            console.error('Error setting primary owner:', error)
        } finally {
            setIsUpdating(false)
        }
    }

    const filteredClubs = clubs.filter(club =>
        club.name.toLowerCase().includes(clubSearch.toLowerCase()) ||
        club.owners.some(owner => owner.full_name.toLowerCase().includes(clubSearch.toLowerCase())) ||
        club.employees.some(employee => employee.full_name.toLowerCase().includes(clubSearch.toLowerCase()))
    )

    const availableUsersForClub = selectedClub
        ? users.filter(user => {
            const isOwner = selectedClub.owners.some(owner => owner.id === user.id)
            const isEmployee = selectedClub.employees.some(employee => employee.id === user.id)
            return !isOwner && !isEmployee
        })
        : []

    const linkedUserIds = new Set<string>()
    clubs.forEach(club => {
        club.owners.forEach(owner => linkedUserIds.add(owner.id))
        club.employees.forEach(employee => linkedUserIds.add(employee.id))
    })
    const unassignedUsers = users.filter(user => !linkedUserIds.has(user.id))

    return (
        <SuperAdminPage title="Клубы и доступы" description="Выберите клуб и управляйте владельцем и командой в одном месте">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_1fr]">
                <Card className="bg-zinc-900 border-zinc-800 text-white">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg">Список клубов</CardTitle>
                        <CardDescription className="text-zinc-400">{clubs.length} клубов в системе</CardDescription>
                        <div className="relative pt-2">
                            <Search className="absolute left-3 top-[18px] h-4 w-4 text-zinc-500" />
                            <Input
                                placeholder="Поиск клуба, владельца, сотрудника"
                                value={clubSearch}
                                onChange={(e) => setClubSearch(e.target.value)}
                                className="pl-10 bg-zinc-950 border-zinc-800 text-white"
                            />
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-2 max-h-[680px] overflow-auto">
                        {isLoading ? (
                            <div className="flex h-48 items-center justify-center">
                                <Loader2 className="h-7 w-7 animate-spin text-zinc-500" />
                            </div>
                        ) : filteredClubs.length === 0 ? (
                            <div className="py-10 text-center text-sm text-zinc-500">Клубы не найдены</div>
                        ) : (
                            filteredClubs.map(club => (
                                <button
                                    key={club.id}
                                    onClick={() => setSelectedClubId(club.id)}
                                    className={cn(
                                        "w-full rounded-lg border p-3 text-left transition-colors",
                                        selectedClubId === club.id
                                            ? "border-purple-500 bg-purple-500/10"
                                            : "border-zinc-800 bg-zinc-950 hover:bg-zinc-800/60"
                                    )}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="font-semibold text-white truncate">{club.name}</p>
                                        <Badge variant="outline" className="border-zinc-700 text-zinc-300">
                                            {club.employees.length}
                                        </Badge>
                                    </div>
                                    <p className="mt-1 text-[11px] text-zinc-500 truncate">ID: {club.public_id || club.id}</p>
                                    <p className="mt-1 text-xs text-zinc-400 truncate">{club.owners.map(owner => owner.full_name).join(", ")}</p>
                                </button>
                            ))
                        )}
                    </CardContent>
                    <div className="border-t border-zinc-800 px-6 py-4">
                        <div className="mb-2 flex items-center justify-between">
                            <p className="text-sm font-semibold text-zinc-200">Пользователи без привязки</p>
                            <Badge variant="outline" className="border-zinc-700 text-zinc-300">{unassignedUsers.length}</Badge>
                        </div>
                        <div className="max-h-44 space-y-2 overflow-auto pr-1">
                            {isLoading ? (
                                <div className="text-xs text-zinc-500">Загрузка...</div>
                            ) : unassignedUsers.length === 0 ? (
                                <div className="text-xs text-zinc-500">Все пользователи привязаны к клубам</div>
                            ) : (
                                unassignedUsers.map(user => (
                                    <div key={user.id} className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <div>
                                                <p className="text-sm text-white">{user.full_name}</p>
                                                <p className="text-xs text-zinc-500">{user.phone_number}</p>
                                            </div>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                onClick={() => handleDeleteUnassignedUser(user.id)}
                                                disabled={isUpdating}
                                                className="text-zinc-500 hover:text-red-500 hover:bg-red-500/10"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </Card>

                <Card className="bg-zinc-900 border-zinc-800 text-white">
                    <CardHeader>
                        <div className="flex items-start justify-between gap-3">
                            <CardTitle className="flex items-center gap-2">
                                <Building2 className="h-5 w-5 text-purple-400" />
                                {selectedClub?.name || "Выберите клуб"}
                            </CardTitle>
                            {selectedClub && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsDeleteClubOpen(true)}
                                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Удалить клуб
                                </Button>
                            )}
                        </div>
                        <CardDescription className="text-zinc-400">
                            {selectedClub ? `Создан ${new Date(selectedClub.created_at).toLocaleDateString('ru-RU')}` : "Слева выберите клуб для управления доступами"}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {!selectedClub ? (
                            <div className="py-16 text-center text-zinc-500">Клуб не выбран</div>
                        ) : (
                            <>
                                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
                                    <div className="mb-2 flex items-center gap-2 text-amber-400">
                                        <Crown className="h-4 w-4" />
                                        <span className="text-sm font-semibold">Владельцы клуба</span>
                                    </div>
                                    {selectedClub.owners.map(owner => (
                                        <div key={owner.id} className="rounded-lg border border-amber-400/20 bg-amber-500/5 px-3 py-2">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-medium text-white">{owner.full_name}</p>
                                                    <p className="text-xs text-zinc-400">{owner.phone_number}</p>
                                                    {owner.is_primary && (
                                                        <p className="text-[10px] mt-1 font-bold uppercase tracking-wider text-amber-400">Основной владелец</p>
                                                    )}
                                                </div>
                                                {!owner.is_primary && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleSetPrimaryOwner(owner.id)}
                                                        disabled={isUpdating}
                                                        className="border-amber-400/40 bg-transparent text-amber-300 hover:bg-amber-500/10"
                                                    >
                                                        Сделать основным
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 space-y-4">
                                    <div className="flex items-center gap-2 text-zinc-300">
                                        <Plus className="h-4 w-4" />
                                        <span className="text-sm font-semibold">Добавить сотрудника в клуб</span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label>Пользователь</Label>
                                            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                                                <SelectTrigger className="bg-zinc-900 border-zinc-800">
                                                    <SelectValue placeholder="Выберите пользователя" />
                                                </SelectTrigger>
                                                <SelectContent className="bg-zinc-950 border-zinc-800 text-white">
                                                    {availableUsersForClub.map(user => (
                                                        <SelectItem key={user.id} value={user.id}>
                                                            {user.full_name} ({user.phone_number})
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Роль</Label>
                                            <Select value={selectedRole} onValueChange={setSelectedRole}>
                                                <SelectTrigger className="bg-zinc-900 border-zinc-800">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="bg-zinc-950 border-zinc-800 text-white">
                                                    <SelectItem value="Владелец">Владелец</SelectItem>
                                                    <SelectItem value="Сотрудник">Сотрудник</SelectItem>
                                                    <SelectItem value="Админ">Админ</SelectItem>
                                                    <SelectItem value="Управляющий">Управляющий</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <Button
                                        onClick={handleAssignToClub}
                                        disabled={!selectedUserId || isUpdating}
                                        className="bg-purple-600 hover:bg-purple-700 text-white"
                                    >
                                        {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                                        Добавить в клуб
                                    </Button>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-zinc-300">
                                        <Users className="h-4 w-4" />
                                        <span className="text-sm font-semibold">Команда клуба</span>
                                        <Badge variant="outline" className="border-zinc-700 text-zinc-300">{selectedClub.employees.length}</Badge>
                                    </div>
                                    {selectedClub.employees.length === 0 ? (
                                        <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-8 text-center text-sm text-zinc-500">
                                            В этом клубе пока нет сотрудников
                                        </div>
                                    ) : (
                                        <div className="rounded-lg border border-zinc-800 overflow-hidden">
                                            <Table>
                                                <TableHeader className="bg-zinc-950/70">
                                                    <TableRow className="border-zinc-800 hover:bg-transparent">
                                                        <TableHead className="text-zinc-400">Участник</TableHead>
                                                        <TableHead className="text-zinc-400">Роль</TableHead>
                                                        <TableHead className="text-zinc-400">Добавлен</TableHead>
                                                        <TableHead className="text-zinc-400 text-right">Действия</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {selectedClub.employees.map(employee => (
                                                        <TableRow key={employee.id} className="border-zinc-800">
                                                            <TableCell>
                                                                <div className="flex flex-col">
                                                                    <span className="text-sm font-medium text-white">{employee.full_name}</span>
                                                                    <span className="text-xs text-zinc-500">{employee.phone_number}</span>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <Badge
                                                                    variant="outline"
                                                                    className={employee.role === "Владелец"
                                                                        ? "border-amber-500/60 text-amber-300"
                                                                        : "border-purple-500/50 text-purple-300"}
                                                                >
                                                                    {employee.role}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="text-zinc-400 text-sm">
                                                                {new Date(employee.hired_at).toLocaleDateString('ru-RU')}
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => handleRemoveFromClub(employee.id)}
                                                                    className="text-zinc-500 hover:text-red-500 hover:bg-red-500/10"
                                                                    disabled={isUpdating || employee.is_primary}
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Dialog open={isDeleteClubOpen} onOpenChange={setIsDeleteClubOpen}>
                <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-400">
                            <AlertTriangle className="h-5 w-5" />
                            Удаление клуба
                        </DialogTitle>
                        <DialogDescription className="text-zinc-400">
                            Вы собираетесь удалить клуб <span className="font-semibold text-white">{selectedClub?.name}</span>.
                            Это действие необратимо, все данные клуба будут удалены.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsDeleteClubOpen(false)}
                            disabled={isDeletingClub}
                            className="border-zinc-700 bg-transparent hover:bg-zinc-800"
                        >
                            Отмена
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteClub}
                            disabled={isDeletingClub}
                        >
                            {isDeletingClub ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Удалить навсегда
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </SuperAdminPage>
    )
}
