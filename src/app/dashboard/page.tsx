"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Building2, Plus, Loader2, Trash2, AlertTriangle, LogOut, MoreVertical, Briefcase, Zap, ShieldAlert, ArrowRight, Check } from "lucide-react"
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
                if (data.user?.legal_acceptance_required) {
                    router.push('/legal-consent')
                    return
                }
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
        <div className="flex min-h-screen bg-[#FAFAFA] flex-col font-sans text-slate-900 selection:bg-black/10">
            {/* Minimal Header */}
            <header className="sticky top-0 z-50 w-full bg-[#FAFAFA]/80 backdrop-blur-md">
                <div className="mx-auto max-w-5xl flex h-20 items-center justify-between px-6 sm:px-8">
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded bg-black">
                            <Zap className="h-4 w-4 text-white fill-current" />
                        </div>
                        <span className="text-lg font-bold tracking-tight">DashAdmin</span>
                    </div>

                    <div className="flex items-center gap-4 text-sm font-medium">
                        {userData?.is_super_admin && (
                            <Link href="/super-admin/dashboard" className="text-red-600 hover:text-red-700 transition-colors flex items-center gap-2">
                                <ShieldAlert className="h-4 w-4" />
                                <span className="hidden sm:inline">Панель управления</span>
                            </Link>
                        )}
                        {hasEmployeeClubs && (
                            <Link href="/employee/dashboard" className="text-purple-600 hover:text-purple-700 transition-colors flex items-center gap-2">
                                <Briefcase className="h-4 w-4" />
                                <span className="hidden sm:inline">Выйти на смену</span>
                            </Link>
                        )}
                        <button 
                            onClick={handleLogout}
                            className="text-slate-500 hover:text-black transition-colors flex items-center gap-2 ml-2"
                        >
                            <LogOut className="h-4 w-4" />
                            <span className="hidden sm:inline">Выйти</span>
                        </button>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-5xl w-full flex-1 px-6 sm:px-8 py-12 md:py-20">
                {/* Section: Clubs */}
                <div className="mb-16">
                    <div className="flex items-end justify-between mb-8">
                        <div>
                            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">Рабочие пространства</h1>
                            <p className="text-lg text-slate-500">Выберите клуб для управления</p>
                        </div>
                        <Button
                            onClick={() => {
                                if (!isCreateClubDisabled) setIsModalOpen(true)
                            }}
                            disabled={isCreateClubDisabled}
                            className="hidden sm:flex h-12 rounded-full px-6 bg-black text-white hover:bg-slate-800 font-medium text-base transition-all"
                        >
                            <Plus className="mr-2 h-5 w-5" />
                            Добавить клуб
                        </Button>
                    </div>

                    {isLoading ? (
                        <div className="flex h-32 items-center justify-center">
                            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            {/* Mobile Create Button */}
                            <button
                                onClick={() => {
                                    if (!isCreateClubDisabled) setIsModalOpen(true)
                                }}
                                disabled={isCreateClubDisabled}
                                className={`sm:hidden flex h-16 items-center justify-center rounded-xl border border-dashed transition-all ${isCreateClubDisabled ? "border-slate-200 text-slate-400 cursor-not-allowed" : "border-slate-300 text-slate-600 hover:border-black hover:text-black hover:bg-slate-50"}`}
                            >
                                <Plus className="mr-2 h-5 w-5" />
                                <span className="font-medium text-base">Добавить клуб</span>
                            </button>

                            {clubs.map((club) => (
                                <div
                                    key={club.id}
                                    onClick={() => router.push(`/clubs/${club.id}`)}
                                    className="group relative flex cursor-pointer flex-col rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:border-black hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
                                >
                                    <div className="flex items-start justify-between mb-8">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-900 transition-colors group-hover:bg-black group-hover:text-white">
                                            <Building2 className="h-6 w-6" />
                                        </div>
                                        {club.is_owner && (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-black hover:bg-slate-100 rounded-full">
                                                        <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="rounded-xl border-slate-200 shadow-lg">
                                                    <DropdownMenuItem
                                                        onClick={(e: React.MouseEvent) => confirmDeleteClub(e, club)}
                                                        className="text-red-600 focus:text-red-600 focus:bg-red-50 rounded-lg cursor-pointer"
                                                    >
                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                        Удалить пространство
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        )}
                                    </div>

                                    <div>
                                        <div className="flex items-center gap-3 mb-1">
                                            <h3 className="text-xl font-bold tracking-tight text-slate-900">{club.name}</h3>
                                            {!club.is_owner && (
                                                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-blue-600">
                                                    Управляющий
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-slate-500 min-h-[20px] line-clamp-1">
                                            {club.address || "Адрес не указан"}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Section: Subscription */}
                <div>
                    <div className="mb-8">
                        <h2 className="text-2xl font-bold tracking-tight mb-2">Тарифный план</h2>
                        <p className="text-slate-500">Управление подпиской и лимитами</p>
                    </div>

                    <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start">
                        {/* Current Status */}
                        <div className="w-full lg:w-1/3 rounded-2xl border border-slate-200 bg-white p-8">
                            <p className="text-sm font-medium text-slate-500 mb-2">Текущий статус</p>
                            <div className="flex items-center gap-3 mb-8">
                                <div className={`h-2 w-2 rounded-full ${userData?.subscription_status === 'active' || userData?.subscription_status === 'trialing' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                <span className="text-lg font-semibold">{STATUS_LABELS[userData?.subscription_status || 'trialing'] || 'Временный доступ'}</span>
                            </div>

                            <p className="text-sm font-medium text-slate-500 mb-2">Оплачено до</p>
                            <p className="text-lg font-semibold mb-8">
                                {userData?.subscription_ends_at
                                    ? new Date(userData.subscription_ends_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
                                    : 'Не ограничено'}
                            </p>

                            <div className="pt-8 border-t border-slate-100">
                                <p className="text-sm font-medium text-slate-500 mb-2">Текущий платеж</p>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-4xl font-bold tracking-tight">
                                        {Number(currentPlanOption?.price_amount || userData?.subscription_limits?.price_monthly || 0).toLocaleString('ru-RU')} ₽
                                    </span>
                                    <span className="text-slate-500 font-medium">/ мес</span>
                                </div>
                            </div>
                        </div>

                        {/* Plans Selection */}
                        <div className="w-full lg:w-2/3">
                            {isPlansLoading ? (
                                <div className="h-48 flex items-center justify-center rounded-2xl border border-slate-200 bg-white">
                                    <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                                </div>
                            ) : planOptions.length === 0 ? (
                                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">Нет доступных тарифов</div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {planOptions.map(plan => {
                                        const isSelected = selectedPlan === plan.code
                                        return (
                                            <div
                                                key={plan.id}
                                                className={`relative flex flex-col rounded-2xl border p-6 transition-all ${
                                                    plan.card_theme === 'dark' 
                                                        ? 'bg-slate-900 border-slate-900 text-white' 
                                                        : isSelected 
                                                            ? 'bg-white border-black shadow-[0_8px_30px_rgb(0,0,0,0.08)]' 
                                                            : 'bg-white border-slate-200 hover:border-slate-300'
                                                }`}
                                            >
                                                {plan.is_highlighted && (
                                                    <div className="absolute -top-3 left-6">
                                                        <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-bold tracking-wide text-white">
                                                            Популярный
                                                        </span>
                                                    </div>
                                                )}

                                                <div className="mb-6">
                                                    <h3 className="text-2xl font-bold tracking-tight mb-1">{plan.name}</h3>
                                                    <p className={`text-sm ${plan.card_theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                                                        {plan.description || plan.tagline}
                                                    </p>
                                                </div>

                                                <div className="mb-8 flex items-baseline gap-1">
                                                    <span className="text-3xl font-bold tracking-tight">{Number(plan.price_amount || 0).toLocaleString('ru-RU')} ₽</span>
                                                    <span className={`text-sm font-medium ${plan.card_theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                                                        / {plan.period_value} {PERIOD_LABELS[plan.period_unit]}
                                                    </span>
                                                </div>

                                                <div className="flex-1 space-y-3 mb-8">
                                                    {(plan.features || []).map((feature, idx) => (
                                                        <div key={`${plan.code}-${idx}`} className="flex items-start gap-3">
                                                            <Check className={`h-5 w-5 shrink-0 ${plan.card_theme === 'dark' ? 'text-blue-400' : 'text-black'}`} />
                                                            <span className={`text-sm leading-tight ${plan.card_theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{feature}</span>
                                                        </div>
                                                    ))}
                                                </div>

                                                <Button
                                                    className={`w-full h-12 rounded-xl font-medium text-base transition-all ${
                                                        plan.card_theme === 'dark'
                                                            ? 'bg-white text-black hover:bg-slate-200'
                                                            : isSelected
                                                                ? 'bg-slate-100 text-slate-400 cursor-default hover:bg-slate-100'
                                                                : 'bg-black text-white hover:bg-slate-800'
                                                    }`}
                                                    onClick={() => {
                                                        if (!isSelected) handleChangeSubscription(plan.code)
                                                    }}
                                                    disabled={isChangingPlan || isSelected}
                                                >
                                                    {isChangingPlan && selectedPlan === plan.code ? (
                                                        <Loader2 className="h-5 w-5 animate-spin" />
                                                    ) : isSelected ? (
                                                        "Текущий тариф"
                                                    ) : (
                                                        plan.cta_text || "Выбрать тариф"
                                                    )}
                                                </Button>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            {/* Modals remain functionally identical but styled cleaner */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="sm:max-w-[425px] rounded-2xl p-8 border-slate-200">
                    <DialogHeader className="mb-6">
                        <DialogTitle className="text-2xl font-bold tracking-tight">Новое пространство</DialogTitle>
                        <DialogDescription className="text-base text-slate-500">
                            Создайте новый клуб для управления
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleCreateClub} className="space-y-6">
                        <div className="space-y-3">
                            <Label htmlFor="clubName" className="text-sm font-medium text-slate-900">Название клуба</Label>
                            <Input
                                id="clubName"
                                placeholder="Например, CyberZone Центр"
                                value={clubName}
                                onChange={(e) => setClubName(e.target.value)}
                                className="h-12 rounded-xl border-slate-200 bg-slate-50 focus-visible:ring-1 focus-visible:ring-black focus-visible:bg-white text-base transition-all"
                                required
                            />
                        </div>

                        <div className="space-y-3">
                            <Label htmlFor="address" className="text-sm font-medium text-slate-900">Адрес <span className="text-slate-400 font-normal">(необязательно)</span></Label>
                            <Input
                                id="address"
                                placeholder="Улица, дом"
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                className="h-12 rounded-xl border-slate-200 bg-slate-50 focus-visible:ring-1 focus-visible:ring-black focus-visible:bg-white text-base transition-all"
                            />
                        </div>

                        <div className="flex gap-3 pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsModalOpen(false)}
                                className="flex-1 h-12 rounded-xl font-medium text-base border-slate-200 hover:bg-slate-50 text-slate-600"
                                disabled={isCreating}
                            >
                                Отмена
                            </Button>
                            <Button
                                type="submit"
                                className="flex-1 h-12 rounded-xl font-medium text-base bg-black text-white hover:bg-slate-800"
                                disabled={isCreating}
                            >
                                {isCreating ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : 'Создать'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
                <DialogContent className="sm:max-w-[425px] rounded-2xl p-8 border-slate-200">
                    <DialogHeader className="mb-6">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mb-4">
                            <AlertTriangle className="h-6 w-6 text-red-600" />
                        </div>
                        <DialogTitle className="text-2xl font-bold tracking-tight text-center">Удалить клуб?</DialogTitle>
                        <DialogDescription className="text-base text-slate-500 text-center mt-2">
                            Вы собираетесь удалить <strong>{clubToDelete?.name}</strong>. Это действие необратимо и удалит все связанные данные (смены, товары, отчеты).
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="flex flex-col gap-3">
                        <Button
                            variant="destructive"
                            onClick={handleDeleteClub}
                            disabled={isDeleting}
                            className="w-full h-12 rounded-xl font-medium text-base bg-red-600 hover:bg-red-700"
                        >
                            {isDeleting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : 'Да, удалить навсегда'}
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => setIsDeleteModalOpen(false)}
                            disabled={isDeleting}
                            className="w-full h-12 rounded-xl font-medium text-base border-slate-200 hover:bg-slate-50 text-slate-600"
                        >
                            Отмена
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
