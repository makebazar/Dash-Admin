"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Building2, Plus, Loader2, Trash2, AlertTriangle, LogOut, MoreVertical, Briefcase, CheckCircle2, Calendar as CalendarIcon, Zap, ShieldAlert } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import Link from "next/link"

interface Club {
    id: string
    name: string
    address: string | null
    created_at: string
    is_owner?: boolean
}

interface UserData {
    id: string
    full_name: string
    subscription_plan: string
    subscription_status: string
    subscription_ends_at: string | null
    subscription_limits: {
        max_clubs: number | null
        max_employees_per_club: number | null
        price_monthly: number
    }
    is_super_admin: boolean
}

interface SubscriptionPlanOption {
    id: number
    code: string
    name: string
    tagline: string | null
    description: string | null
    features: string[]
    badge_text: string | null
    badge_tone: "default" | "info" | "success" | "warning" | "danger"
    cta_text: string | null
    card_theme: "light" | "dark" | "accent"
    display_order: number
    is_highlighted: boolean
    price_amount: string
    period_unit: "day" | "month" | "year"
    period_value: number
    is_active: boolean
}

const PLAN_LABELS: Record<string, string> = {
    new_user: "Новый пользователь",
    starter: "Стартовый",
    pro: "Про",
    enterprise: "Энтерпрайз"
}

const STATUS_LABELS: Record<string, string> = {
    trialing: "Временный доступ",
    active: "Активна",
    expired: "Истекла",
    canceled: "Отменена"
}

const PERIOD_LABELS: Record<SubscriptionPlanOption["period_unit"], string> = {
    day: "дн",
    month: "мес",
    year: "год"
}

const THEME_CLASS: Record<SubscriptionPlanOption["card_theme"], string> = {
    light: "border-slate-200 bg-white text-slate-900 hover:border-slate-300",
    dark: "border-slate-900 bg-slate-900 text-white hover:bg-slate-800",
    accent: "border-indigo-500 bg-indigo-600 text-white hover:bg-indigo-500"
}

const TONE_CLASS: Record<SubscriptionPlanOption["badge_tone"], string> = {
    default: "bg-slate-100 text-slate-700",
    info: "bg-blue-100 text-blue-700",
    success: "bg-emerald-100 text-emerald-700",
    warning: "bg-amber-100 text-amber-700",
    danger: "bg-red-100 text-red-700"
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
    const [hasEmployeeClubs, setHasEmployeeClubs] = useState(false)
    const [userData, setUserData] = useState<UserData | null>(null)
    const [planOptions, setPlanOptions] = useState<SubscriptionPlanOption[]>([])
    const [selectedPlan, setSelectedPlan] = useState("")
    const [isPlansLoading, setIsPlansLoading] = useState(true)
    const [isChangingPlan, setIsChangingPlan] = useState(false)

    // Form state
    const [clubName, setClubName] = useState('')
    const [address, setAddress] = useState('')
    const hasActiveSubscription = userData ? (userData.subscription_status === 'active' || userData.subscription_status === 'trialing') : true
    const clubLimit = userData?.subscription_limits?.max_clubs ?? null
    const reachedClubLimit = clubLimit !== null && clubs.length >= clubLimit
    const isCreateClubDisabled = !hasActiveSubscription || reachedClubLimit
    const currentPlanOption = planOptions.find(plan => plan.code === userData?.subscription_plan)

    useEffect(() => {
        fetchClubs()
        fetchUserData()
        fetchPlanOptions()
    }, [])

    const fetchUserData = async () => {
        try {
            const res = await fetch('/api/auth/me')
            const data = await res.json()
            if (res.ok) {
                setUserData(data.user)
                setSelectedPlan(data.user?.subscription_plan || "")
                if (data.employeeClubs && data.employeeClubs.length > 0) {
                    setHasEmployeeClubs(true)
                }
            }
        } catch (error) {
            console.error('Error fetching user data:', error)
        }
    }

    const fetchPlanOptions = async () => {
        setIsPlansLoading(true)
        try {
            const res = await fetch('/api/subscription/self')
            const data = await res.json()
            if (res.ok) {
                setPlanOptions(data.plans || [])
            } else {
                setPlanOptions([])
            }
        } catch (error) {
            console.error('Error fetching subscription plans:', error)
            setPlanOptions([])
        } finally {
            setIsPlansLoading(false)
        }
    }

    const handleChangeSubscription = async (planCodeOverride?: string) => {
        const planCode = (planCodeOverride || selectedPlan || "").trim()
        if (!planCode) return
        setSelectedPlan(planCode)
        setIsChangingPlan(true)
        try {
            const res = await fetch('/api/subscription/self', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan_code: planCode })
            })
            const data = await res.json()
            if (!res.ok) {
                alert(data.error || 'Не удалось сменить тариф')
                return
            }
            if (Number(data?.synced_users_count || 1) > 1) {
                alert(`Тариф синхронизирован для ${data.synced_users_count} владельцев`)
            }
            await fetchUserData()
            await fetchClubs()
        } catch (error) {
            console.error('Error changing subscription:', error)
            alert('Ошибка смены тарифа')
        } finally {
            setIsChangingPlan(false)
        }
    }

    const fetchClubs = async () => {
        try {
            const res = await fetch('/api/clubs')
            const data = await res.json()

            if (res.ok) {
                setClubs(data.clubs)
            } else {
                console.error('Failed to fetch clubs:', data.error)
            }
        } catch (error) {
            console.error('Error fetching clubs:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleLogout = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' })
            router.push('/login')
        } catch (error) {
            console.error('Logout failed:', error)
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
                const newClubId = data.clubId || data.club?.id
                if (newClubId) {
                    setIsModalOpen(false)
                    router.push(`/clubs/${newClubId}`)
                } else {
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
        e.stopPropagation()
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
                fetchClubs()
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
        <div className="flex min-h-screen bg-[#fafafa] flex-col">
            {/* Header */}
            <header className="sticky top-0 z-50 w-full border-b border-black/5 bg-white/80 backdrop-blur-md">
                <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-8">
                    <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-black">
                            <Building2 className="h-5 w-5 text-white" />
                        </div>
                        <span className="text-lg font-bold tracking-tight">DashAdmin</span>
                    </div>

                    <div className="flex items-center gap-2">
                        {userData?.is_super_admin && (
                            <Link href="/super-admin/dashboard">
                                <Button variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50 flex items-center gap-2">
                                    <ShieldAlert className="h-4 w-4" />
                                    <span className="hidden sm:inline">Панель управления</span>
                                </Button>
                            </Link>
                        )}
                        {hasEmployeeClubs && (
                            <Link href="/employee/dashboard">
                                <Button variant="ghost" className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 flex items-center gap-2">
                                    <Briefcase className="h-4 w-4" />
                                    <span className="hidden sm:inline">Выйти на смену</span>
                                </Button>
                            </Link>
                        )}
                        <Button 
                            variant="ghost" 
                            onClick={handleLogout}
                            className="text-slate-500 hover:text-red-600 hover:bg-red-50 flex items-center gap-2"
                        >
                            <LogOut className="h-4 w-4" />
                            <span className="hidden sm:inline">Выйти</span>
                        </Button>
                    </div>
                </div>
            </header>

            <main className="container mx-auto flex-1 p-4 sm:p-8">
                <div className="mb-10 flex flex-col gap-2">
                    <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Мои клубы</h1>
                    <p className="text-slate-500">
                        Выберите клуб для управления или создайте новый
                    </p>
                </div>

                {isLoading ? (
                    <div className="flex h-64 items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {/* Create Club Action Card */}
                        <button
                            onClick={() => {
                                if (isCreateClubDisabled) return
                                setIsModalOpen(true)
                            }}
                            className={`group relative flex h-full min-h-[180px] flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-white p-6 transition-all ${isCreateClubDisabled ? "border-slate-200 opacity-60 cursor-not-allowed" : "border-slate-200 hover:border-black hover:bg-slate-50"}`}
                        >
                            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 transition-colors group-hover:bg-black group-hover:text-white">
                                <Plus className="h-6 w-6" />
                            </div>
                            <span className="font-semibold text-slate-900">Добавить клуб</span>
                            <span className="mt-1 text-xs text-slate-500 text-center">
                                {isCreateClubDisabled
                                    ? (!hasActiveSubscription ? "Подписка неактивна" : `Лимит тарифа: ${clubLimit}`)
                                    : "Создайте новое заведение в системе"}
                            </span>
                        </button>

                        {/* Clubs Cards */}
                        {clubs.map((club) => (
                            <div
                                key={club.id}
                                onClick={() => router.push(`/clubs/${club.id}`)}
                                className="group relative flex h-full min-h-[180px] cursor-pointer flex-col justify-between rounded-2xl border border-black/5 bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-black/10"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-900 transition-colors group-hover:bg-black group-hover:text-white">
                                        <Building2 className="h-6 w-6" />
                                    </div>
                                    {club.is_owner && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-900">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem
                                                    onClick={(e: React.MouseEvent) => confirmDeleteClub(e, club)}
                                                    className="text-red-600 focus:text-red-600"
                                                >
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Удалить
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )}
                                </div>

                                <div className="mt-4">
                                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-black">{club.name}</h3>
                                    {!club.is_owner && (
                                        <span className="mt-1 inline-block rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-600">
                                            Управляющий
                                        </span>
                                    )}
                                    {club.address && (
                                        <p className="mt-1 line-clamp-1 text-sm text-slate-500">
                                            {club.address}
                                        </p>
                                    )}
                                </div>

                                <div className="mt-6 flex items-center justify-between border-t border-slate-50 pt-4">
                                    <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                                        Создан {new Date(club.created_at).toLocaleDateString('ru-RU')}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Subscription Section */}
                <div className="mt-16">
                    <div className="mb-6 flex flex-col gap-2">
                        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Ваша подписка</h2>
                        <p className="text-slate-500">
                            Тариф и лимиты аккаунта
                        </p>
                    </div>

                    <div className="space-y-6">
                        <Card className="overflow-hidden border-black/5 shadow-sm">
                            <div className="flex flex-col sm:flex-row h-full">
                                <div className="flex-1 p-6 sm:p-8">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black text-white">
                                            <Zap className="h-5 w-5 fill-current" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Текущий тариф</p>
                                            <h3 className="text-2xl font-bold text-slate-900">
                                                {currentPlanOption?.name || PLAN_LABELS[userData?.subscription_plan || 'new_user'] || 'Новый пользователь'}
                                            </h3>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <div className="flex items-start gap-3">
                                            <div className="mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-green-600">
                                                <CheckCircle2 className="h-3 w-3" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-slate-900">Статус</p>
                                                <p className="text-sm text-slate-500">{STATUS_LABELS[userData?.subscription_status || 'trialing'] || 'Временный доступ'}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <div className="mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                                                <CalendarIcon className="h-3 w-3" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-slate-900">Оплачено до</p>
                                                <p className="text-sm text-slate-500">
                                                    {userData?.subscription_ends_at
                                                        ? new Date(userData.subscription_ends_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
                                                        : 'Не ограничено'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="w-full sm:w-[280px] bg-gradient-to-b from-slate-50 to-white p-6 sm:p-8 border-t sm:border-t-0 sm:border-l border-black/5">
                                    <p className="text-sm text-slate-500 mb-1">Стоимость</p>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-3xl font-bold text-slate-900">
                                            {Number(currentPlanOption?.price_amount || userData?.subscription_limits?.price_monthly || 0).toLocaleString('ru-RU')} ₽
                                        </span>
                                        <span className="text-slate-500">/мес</span>
                                    </div>
                                </div>
                            </div>
                        </Card>

                        <div>
                            <p className="text-sm font-semibold text-slate-900 mb-3">Выберите тариф</p>
                            {isPlansLoading ? (
                                <div className="h-24 flex items-center justify-center rounded-2xl border border-slate-200 bg-white">
                                    <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
                                </div>
                            ) : planOptions.length === 0 ? (
                                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Нет доступных тарифов</div>
                            ) : (
                                <div className="grid grid-cols-1 gap-4">
                                    {planOptions.map(plan => (
                                        <div
                                            key={plan.id}
                                            onClick={() => setSelectedPlan(plan.code)}
                                            className={`w-full cursor-pointer rounded-2xl border p-5 text-left transition-all ${THEME_CLASS[plan.card_theme || "light"]} ${selectedPlan === plan.code ? "ring-2 ring-offset-2 ring-black" : ""}`}
                                        >
                                            <div className="flex items-center justify-between gap-3 mb-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black text-white">
                                                        <Zap className="h-5 w-5 fill-current" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium uppercase tracking-wider opacity-70">Тариф</p>
                                                        <h4 className="text-2xl font-bold">{plan.name}</h4>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-2xl font-bold">{Number(plan.price_amount || 0).toLocaleString('ru-RU')} ₽</p>
                                                    <p className="text-xs opacity-70">/ {plan.period_value} {PERIOD_LABELS[plan.period_unit]}</p>
                                                </div>
                                            </div>
                                            <p className="text-sm opacity-80">{plan.description || plan.tagline || "Описание тарифа"}</p>
                                            <div className="mt-3 space-y-1">
                                                {(plan.features || []).slice(0, 4).map((feature, idx) => (
                                                    <p key={`${plan.code}-${idx}`} className="text-sm opacity-90">• {feature}</p>
                                                ))}
                                            </div>
                                            <div className="mt-4 flex items-center gap-2">
                                                {plan.badge_text ? (
                                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${TONE_CLASS[plan.badge_tone || "default"]}`}>
                                                        {plan.badge_text}
                                                    </span>
                                                ) : null}
                                                {plan.is_highlighted ? (
                                                    <span className="rounded-full bg-black/10 px-2 py-0.5 text-[10px] font-semibold">Рекомендуем</span>
                                                ) : null}
                                            </div>
                                            <Button
                                                className={`mt-4 h-10 ${selectedPlan === plan.code ? "bg-white text-black hover:bg-slate-100" : "bg-black text-white hover:bg-slate-800"}`}
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleChangeSubscription(plan.code)
                                                }}
                                                disabled={isChangingPlan}
                                            >
                                                {isChangingPlan && selectedPlan === plan.code ? <Loader2 className="h-4 w-4 animate-spin" /> : (plan.cta_text || "Применить тариф")}
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
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
