"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Sidebar, SidebarContent, useSidebarLogic } from "@/components/layout/Sidebar"
import { MobileNav } from "@/components/layout/MobileNav"
import { Building2, Plus, TrendingUp, TrendingDown, Loader2, Trash2, AlertTriangle } from "lucide-react"

interface Club {
    id: string
    name: string
    address: string | null
    created_at: string
}

export default function DashboardPage() {
    const router = useRouter()
    const [clubs, setClubs] = useState<Club[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isCreating, setIsCreating] = useState(false)
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
    const [clubToDelete, setClubToDelete] = useState<Club | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)

    // Sidebar Logic
    const sidebarLogic = useSidebarLogic()

    // Form state
    const [clubName, setClubName] = useState('')
    const [address, setAddress] = useState('')

    useEffect(() => {
        fetchClubs()
    }, [])

    const fetchClubs = async () => {
        try {
            const res = await fetch('/api/clubs')
            const data = await res.json()

            if (res.ok) {
                setClubs(data.clubs)
                if (data.clubs.length === 0) {
                    setIsModalOpen(true)
                }
            } else {
                console.error('Failed to fetch clubs:', data.error)
            }
        } catch (error) {
            console.error('Error fetching clubs:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleCreateClub = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsCreating(true)

        try {
            const res = await fetch('/api/clubs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: clubName, address }),
            })
            const data = await res.json()

            if (data.success || res.ok) {
                // Если success не возвращается явно, но res.ok=true, берем данные из club
                const newClubId = data.clubId || data.club?.id
                if (newClubId) {
                    setIsModalOpen(false)
                    router.push(`/clubs/${newClubId}`)
                } else {
                    // Fallback если id не пришел, просто обновим список
                     setIsModalOpen(false)
                     fetchClubs()
                }
            } else {
                alert(data.error || 'Не удалось создать клуб')
            }
        } catch (error) {
            console.error('Error creating club:', error)
            alert('Ошибка создания клуба')
        } finally {
            setIsCreating(false)
        }
    }

    const confirmDeleteClub = (e: React.MouseEvent, club: Club) => {
        e.stopPropagation() // Prevent navigation
        setClubToDelete(club)
        setIsDeleteModalOpen(true)
    }

    const handleDeleteClub = async () => {
        if (!clubToDelete) return

        setIsDeleting(true)
        try {
            const res = await fetch(`/api/clubs?id=${clubToDelete.id}`, {
                method: 'DELETE',
            })
            
            if (res.ok) {
                setIsDeleteModalOpen(false)
                setClubToDelete(null)
                fetchClubs() // Refresh list
            } else {
                const data = await res.json()
                alert(data.error || 'Не удалось удалить клуб')
            }
        } catch (error) {
            console.error('Error deleting club:', error)
            alert('Ошибка при удалении клуба')
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <div className="flex min-h-screen bg-background flex-col md:flex-row">
            <Sidebar 
                clubs={clubs} 
                hasEmployeeClubs={sidebarLogic.hasEmployeeClubs}
                handleLogout={sidebarLogic.handleLogout}
            />

            <div className="md:hidden">
                <MobileNav>
                    <SidebarContent 
                        clubs={clubs}
                        hasEmployeeClubs={sidebarLogic.hasEmployeeClubs}
                        handleLogout={sidebarLogic.handleLogout}
                    />
                </MobileNav>
            </div>

            <main className="flex-1 p-4 md:p-8 md:ml-64 w-full max-w-full overflow-hidden">
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Обзор</h1>
                        <p className="text-muted-foreground">
                            Управление вашими клубами
                        </p>
                    </div>
                    <Button
                        onClick={() => setIsModalOpen(true)}
                        className="bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Новый клуб
                    </Button>
                </div>

                {isLoading ? (
                    <div className="flex h-64 items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : clubs.length === 0 ? (
                    <Card className="border-dashed">
                        <CardContent className="flex flex-col items-center justify-center py-16">
                            <Building2 className="mb-4 h-16 w-16 text-muted-foreground" />
                            <h3 className="mb-2 text-xl font-semibold">Нет клубов</h3>
                            <p className="mb-6 text-center text-sm text-muted-foreground">
                                Создайте свой первый клуб, чтобы начать работу
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        {/* Stats Cards */}
                        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">
                                        Всего клубов
                                    </CardTitle>
                                    <Building2 className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{clubs.length}</div>
                                    <p className="text-xs text-muted-foreground">
                                        Активные заведения
                                    </p>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">
                                        Общая выручка
                                    </CardTitle>
                                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">₽245,000</div>
                                    <p className="text-xs text-muted-foreground">
                                        <span className="text-green-600">+20.1%</span> за месяц
                                    </p>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">
                                        Активные смены
                                    </CardTitle>
                                    <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">8</div>
                                    <p className="text-xs text-muted-foreground">
                                        Сотрудников на работе
                                    </p>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Clubs List */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Ваши клубы</CardTitle>
                                <CardDescription>
                                    Управляйте всеми вашими заведениями в одном месте
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {clubs.map((club) => (
                                        <div
                                            key={club.id}
                                            onClick={() => router.push(`/clubs/${club.id}`)}
                                            className="flex cursor-pointer items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-accent group flex-col sm:flex-row sm:items-center gap-4"
                                        >
                                            <div className="flex items-center gap-4 w-full sm:w-auto">
                                                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-tr from-purple-500 to-blue-500 shrink-0">
                                                    <Building2 className="h-6 w-6 text-white" />
                                                </div>
                                                <div className="min-w-0">
                                                    <h3 className="font-semibold truncate">{club.name}</h3>
                                                    {club.address && (
                                                        <p className="text-sm text-muted-foreground truncate">
                                                            {club.address}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                                                <div className="text-right">
                                                    <p className="text-sm text-muted-foreground">
                                                        Создан {new Date(club.created_at).toLocaleDateString('ru-RU')}
                                                    </p>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
                                                    onClick={(e) => confirmDeleteClub(e, club)}
                                                    title="Удалить клуб"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </>
                )}
            </main>

            {/* Create Club Modal */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Создать новый клуб</DialogTitle>
                        <DialogDescription>
                            Введите информацию о вашем клубе
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleCreateClub} className="mt-4 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="clubName">Название клуба</Label>
                            <Input
                                id="clubName"
                                placeholder="например, CyberZone Москва"
                                value={clubName}
                                onChange={(e) => setClubName(e.target.value)}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="address">Адрес (опционально)</Label>
                            <Input
                                id="address"
                                placeholder="например, ул. Пушкина, 10"
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                            />
                        </div>

                        <div className="flex gap-3 pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsModalOpen(false)}
                                className="flex-1"
                                disabled={isCreating}
                            >
                                Отмена
                            </Button>
                            <Button
                                type="submit"
                                className="flex-1"
                                disabled={isCreating}
                            >
                                {isCreating ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Создание...
                                    </>
                                ) : (
                                    <>
                                        <Building2 className="mr-2 h-4 w-4" />
                                        Создать клуб
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Modal */}
            <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <AlertTriangle className="h-5 w-5" />
                            Удаление клуба
                        </DialogTitle>
                        <DialogDescription>
                            Вы уверены, что хотите удалить клуб <strong>{clubToDelete?.name}</strong>?
                            <br /><br />
                            Это действие необратимо. Все данные, связанные с этим клубом (сотрудники, смены, товары, отчеты), будут удалены.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            variant="outline"
                            onClick={() => setIsDeleteModalOpen(false)}
                            disabled={isDeleting}
                        >
                            Отмена
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteClub}
                            disabled={isDeleting}
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Удаление...
                                </>
                            ) : (
                                'Удалить навсегда'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
