"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sidebar } from "@/components/layout/Sidebar"
import { Building2, Plus, TrendingUp, TrendingDown, Loader2 } from "lucide-react"

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

            if (data.success) {
                setIsModalOpen(false)
                router.push(`/clubs/${data.clubId}`)
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

    return (
        <div className="flex min-h-screen bg-background">
            <Sidebar clubs={clubs} />

            <main className="ml-64 flex-1 p-8">
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
                        <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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

                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">
                                        Занятость
                                    </CardTitle>
                                    <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">73%</div>
                                    <p className="text-xs text-muted-foreground">
                                        Средняя загрузка PC
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
                                            className="flex cursor-pointer items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-accent"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-tr from-purple-500 to-blue-500">
                                                    <Building2 className="h-6 w-6 text-white" />
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold">{club.name}</h3>
                                                    {club.address && (
                                                        <p className="text-sm text-muted-foreground">
                                                            {club.address}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm text-muted-foreground">
                                                    Создан {new Date(club.created_at).toLocaleDateString('ru-RU')}
                                                </p>
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
        </div>
    )
}
