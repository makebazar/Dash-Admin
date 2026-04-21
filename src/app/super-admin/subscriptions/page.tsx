"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, CreditCard, Plus, Pencil, Trash2 } from "lucide-react"
import { SuperAdminPage } from "../_components/page-shell"

interface SubscriptionItem {
    id: string
    full_name: string
    phone_number: string
    clubs_count: number
    employees_count: number
    owner_clubs: Array<{ id: number; name: string }>
    subscription_plan: string
    subscription_status: "trialing" | "active" | "expired" | "canceled"
    subscription_started_at: string | null
    subscription_ends_at: string | null
    subscription_canceled_at: string | null
    subscription_limits: {
        max_clubs: number | null
        max_employees_per_club: number | null
        price_monthly: number
    }
    subscription_is_active: boolean
}

interface Summary {
    total: number
    active: number
    trialing: number
    expired: number
    canceled: number
    mrr: number
}

interface SubscriptionPlanItem {
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

export default function SuperAdminSubscriptionsPage() {
    const [items, setItems] = useState<SubscriptionItem[]>([])
    const [summary, setSummary] = useState<Summary | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState<string | null>(null)
    const [queryText, setQueryText] = useState("")
    const [drafts, setDrafts] = useState<Record<string, { plan: string, status: SubscriptionItem["subscription_status"], endsAt: string }>>({})
    const [plans, setPlans] = useState<SubscriptionPlanItem[]>([])
    const [isPlansLoading, setIsPlansLoading] = useState(true)
    const [isPlanSaving, setIsPlanSaving] = useState(false)
    const [editingPlanId, setEditingPlanId] = useState<number | null>(null)
    const [planForm, setPlanForm] = useState({
        code: "",
        name: "",
        tagline: "",
        description: "",
        features: "",
        badge_text: "",
        badge_tone: "default" as "default" | "info" | "success" | "warning" | "danger",
        cta_text: "",
        card_theme: "light" as "light" | "dark" | "accent",
        display_order: "100",
        is_highlighted: false,
        price_amount: "",
        period_unit: "month" as "day" | "month" | "year",
        period_value: "1",
        is_active: true
    })

    useEffect(() => {
        fetchSubscriptions()
        fetchPlans()
    }, [])

    const fetchSubscriptions = async () => {
        setIsLoading(true)
        try {
            const res = await fetch("/api/super-admin/subscriptions")
            const data = await res.json()
            if (res.ok) {
                setItems(data.subscriptions || [])
                setSummary(data.summary || null)
                const initialDrafts = (data.subscriptions || []).reduce((acc: Record<string, { plan: string, status: SubscriptionItem["subscription_status"], endsAt: string }>, item: SubscriptionItem) => {
                    acc[item.id] = {
                        plan: item.subscription_plan,
                        status: item.subscription_status,
                        endsAt: item.subscription_ends_at ? new Date(item.subscription_ends_at).toISOString().slice(0, 10) : ""
                    }
                    return acc
                }, {})
                setDrafts(initialDrafts)
            }
        } catch (error) {
            console.error("Error fetching subscriptions:", error)
        } finally {
            setIsLoading(false)
        }
    }

    const fetchPlans = async () => {
        setIsPlansLoading(true)
        try {
            const res = await fetch("/api/super-admin/subscription-plans")
            const data = await res.json()
            if (res.ok) {
                setPlans(data.plans || [])
            }
        } catch (error) {
            console.error("Error fetching plans:", error)
        } finally {
            setIsPlansLoading(false)
        }
    }

    const filteredItems = useMemo(() => {
        const needle = queryText.trim().toLowerCase()
        if (!needle) return items
        return items.filter(item =>
            item.full_name.toLowerCase().includes(needle) ||
            item.phone_number.toLowerCase().includes(needle)
        )
    }, [items, queryText])

    const setDraft = (id: string, patch: Partial<{ plan: string, status: SubscriptionItem["subscription_status"], endsAt: string }>) => {
        setDrafts(prev => ({
            ...prev,
            [id]: {
                ...prev[id],
                ...patch
            }
        }))
    }

    const saveDraft = async (id: string) => {
        const draft = drafts[id]
        if (!draft) return
        setIsSaving(id)
        try {
            const res = await fetch("/api/super-admin/subscriptions", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    targetUserId: id,
                    subscription_plan: draft.plan,
                    subscription_status: draft.status,
                    subscription_ends_at: draft.endsAt ? new Date(`${draft.endsAt}T23:59:59.999Z`).toISOString() : null
                })
            })
            const data = await res.json()
            if (!res.ok) {
                alert(data.error || "Не удалось обновить подписку")
                return
            }
            if (Number(data?.synced_users_count || 1) > 1) {
                alert(`Подписка синхронизирована для ${data.synced_users_count} владельцев этого клуба`)
            }
            await fetchSubscriptions()
        } catch (error) {
            console.error("Error saving subscription:", error)
            alert("Ошибка сохранения")
        } finally {
            setIsSaving(null)
        }
    }

    const resetPlanForm = () => {
        setEditingPlanId(null)
        setPlanForm({
            code: "",
            name: "",
            tagline: "",
            description: "",
            features: "",
            badge_text: "",
            badge_tone: "default",
            cta_text: "",
            card_theme: "light",
            display_order: "100",
            is_highlighted: false,
            price_amount: "",
            period_unit: "month",
            period_value: "1",
            is_active: true
        })
    }

    const savePlan = async () => {
        const payload = {
            code: planForm.code.trim().toLowerCase(),
            name: planForm.name.trim(),
            tagline: planForm.tagline.trim() || null,
            description: planForm.description.trim() || null,
            features: planForm.features.split('\n').map(item => item.trim()).filter(Boolean),
            badge_text: planForm.badge_text.trim() || null,
            badge_tone: planForm.badge_tone,
            cta_text: planForm.cta_text.trim() || null,
            card_theme: planForm.card_theme,
            display_order: Number(planForm.display_order || 100),
            is_highlighted: planForm.is_highlighted,
            price_amount: Number(planForm.price_amount || 0),
            period_unit: planForm.period_unit,
            period_value: Number(planForm.period_value || 1),
            is_active: planForm.is_active
        }

        if (!payload.code || !payload.name) {
            alert("Укажи код и название плана")
            return
        }

        setIsPlanSaving(true)
        try {
            const res = await fetch("/api/super-admin/subscription-plans", {
                method: editingPlanId ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editingPlanId ? { ...payload, id: editingPlanId } : payload)
            })
            const data = await res.json()
            if (!res.ok) {
                alert(data.error || "Не удалось сохранить план")
                return
            }
            resetPlanForm()
            await fetchPlans()
        } catch (error) {
            console.error("Error saving plan:", error)
            alert("Ошибка сохранения плана")
        } finally {
            setIsPlanSaving(false)
        }
    }

    const startEditPlan = (plan: SubscriptionPlanItem) => {
        setEditingPlanId(plan.id)
        setPlanForm({
            code: plan.code,
            name: plan.name,
            tagline: plan.tagline || "",
            description: plan.description || "",
            features: (plan.features || []).join('\n'),
            badge_text: plan.badge_text || "",
            badge_tone: plan.badge_tone || "default",
            cta_text: plan.cta_text || "",
            card_theme: plan.card_theme || "light",
            display_order: String(plan.display_order ?? 100),
            is_highlighted: !!plan.is_highlighted,
            price_amount: String(plan.price_amount),
            period_unit: plan.period_unit,
            period_value: String(plan.period_value),
            is_active: plan.is_active
        })
    }

    const deactivatePlan = async (id: number) => {
        if (!confirm("Деактивировать этот план?")) return
        try {
            const res = await fetch(`/api/super-admin/subscription-plans?id=${id}`, { method: "DELETE" })
            const data = await res.json()
            if (!res.ok) {
                alert(data.error || "Не удалось деактивировать план")
                return
            }
            await fetchPlans()
        } catch (error) {
            console.error("Error deactivating plan:", error)
            alert("Ошибка деактивации")
        }
    }

    const activePlanOptions = useMemo(() => plans.filter(plan => plan.is_active), [plans])
    const planNameByCode = useMemo(() => {
        const map = new Map<string, string>()
        for (const plan of plans) {
            map.set(plan.code, plan.name)
        }
        for (const [code, label] of Object.entries(PLAN_LABELS)) {
            if (!map.has(code)) {
                map.set(code, label)
            }
        }
        return map
    }, [plans])

    return (
        <SuperAdminPage
            title="Подписки"
            description="Управление тарифами и статусами подписок без платежного провайдера"
        >

            <div className="grid gap-4 md:grid-cols-5">
                <Card className="bg-zinc-900 border-zinc-800">
                    <CardContent className="p-4">
                        <p className="text-xs text-zinc-500 uppercase">Всего</p>
                        <p className="text-2xl font-bold text-zinc-100">{summary?.total || 0}</p>
                    </CardContent>
                </Card>
                <Card className="bg-zinc-900 border-zinc-800">
                    <CardContent className="p-4">
                        <p className="text-xs text-zinc-500 uppercase">Активные</p>
                        <p className="text-2xl font-bold text-emerald-400">{summary?.active || 0}</p>
                    </CardContent>
                </Card>
                <Card className="bg-zinc-900 border-zinc-800">
                    <CardContent className="p-4">
                        <p className="text-xs text-zinc-500 uppercase">Новые</p>
                        <p className="text-2xl font-bold text-blue-400">{summary?.trialing || 0}</p>
                    </CardContent>
                </Card>
                <Card className="bg-zinc-900 border-zinc-800">
                    <CardContent className="p-4">
                        <p className="text-xs text-zinc-500 uppercase">Истекли</p>
                        <p className="text-2xl font-bold text-amber-400">{summary?.expired || 0}</p>
                    </CardContent>
                </Card>
                <Card className="bg-zinc-900 border-zinc-800">
                    <CardContent className="p-4">
                        <p className="text-xs text-zinc-500 uppercase">MRR</p>
                        <p className="text-2xl font-bold text-zinc-100">{Number(summary?.mrr || 0).toLocaleString("ru-RU")} ₽</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                    <CardTitle className="text-zinc-100 flex items-center gap-2">
                        <CreditCard className="h-5 w-5 text-purple-400" />
                        Подписки владельцев
                    </CardTitle>
                    <CardDescription className="text-zinc-400">Сотрудники не участвуют в биллинге, тариф назначается только владельцам клубов</CardDescription>
                    <Input
                        value={queryText}
                        onChange={e => setQueryText(e.target.value)}
                        placeholder="Поиск по имени или телефону"
                        className="mt-2 bg-zinc-950 border-zinc-800 text-zinc-100"
                    />
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="h-56 flex items-center justify-center">
                            <Loader2 className="h-7 w-7 animate-spin text-zinc-500" />
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredItems.map(item => {
                                const draft = drafts[item.id]
                                return (
                                    <div key={item.id} className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                                        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                                            <div>
                                                <p className="font-semibold text-zinc-100">{item.full_name}</p>
                                                <p className="text-xs text-zinc-500">{item.phone_number}</p>
                                                <p className="text-xs text-zinc-500 mt-1">
                                                    Клубы: {item.owner_clubs?.length ? item.owner_clubs.map(club => club.name).join(", ") : "—"}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className="border-zinc-700 text-zinc-300">
                                                    Клубов: {item.clubs_count}/{item.subscription_limits.max_clubs ?? "∞"}
                                                </Badge>
                                                <Badge variant="outline" className="border-zinc-700 text-zinc-300">
                                                    Сотрудники: {item.employees_count}
                                                </Badge>
                                            </div>
                                        </div>

                                        <div className="grid gap-3 md:grid-cols-4">
                                            <div className="space-y-1">
                                                <p className="text-[11px] uppercase tracking-wide text-zinc-500">Тариф</p>
                                                <Select value={draft?.plan || item.subscription_plan} onValueChange={value => setDraft(item.id, { plan: value })}>
                                                    <SelectTrigger className="bg-zinc-900 border-zinc-800 text-zinc-100">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className="bg-zinc-950 border-zinc-800 text-zinc-100">
                                                        {activePlanOptions.map(plan => (
                                                            <SelectItem key={plan.id} value={plan.code}>{plan.name}</SelectItem>
                                                        ))}
                                                        {!activePlanOptions.some(plan => plan.code === (draft?.plan || item.subscription_plan)) ? (
                                                            <SelectItem value={draft?.plan || item.subscription_plan}>
                                                                {planNameByCode.get(draft?.plan || item.subscription_plan) || (draft?.plan || item.subscription_plan)}
                                                            </SelectItem>
                                                        ) : null}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="space-y-1">
                                                <p className="text-[11px] uppercase tracking-wide text-zinc-500">Статус</p>
                                                <Select value={draft?.status || item.subscription_status} onValueChange={value => setDraft(item.id, { status: value as SubscriptionItem["subscription_status"] })}>
                                                    <SelectTrigger className="bg-zinc-900 border-zinc-800 text-zinc-100">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className="bg-zinc-950 border-zinc-800 text-zinc-100">
                                                        <SelectItem value="trialing">Временный доступ</SelectItem>
                                                        <SelectItem value="active">Активна</SelectItem>
                                                        <SelectItem value="expired">Истекла</SelectItem>
                                                        <SelectItem value="canceled">Отменена</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="space-y-1">
                                                <p className="text-[11px] uppercase tracking-wide text-zinc-500">Действует до</p>
                                                <Input
                                                    type="date"
                                                    value={draft?.endsAt || ""}
                                                    onChange={e => setDraft(item.id, { endsAt: e.target.value })}
                                                    className="bg-zinc-900 border-zinc-800 text-zinc-100"
                                                />
                                            </div>

                                            <div className="space-y-1">
                                                <p className="text-[11px] uppercase tracking-wide text-zinc-500">Действие</p>
                                                <Button
                                                    onClick={() => saveDraft(item.id)}
                                                    disabled={isSaving === item.id}
                                                    className="w-full bg-purple-600 hover:bg-purple-500"
                                                >
                                                    {isSaving === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Сохранить"}
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                                            <span>Текущий: {planNameByCode.get(item.subscription_plan) || item.subscription_plan}</span>
                                            <span>•</span>
                                            <span>Статус: {STATUS_LABELS[item.subscription_status]}</span>
                                            <span>•</span>
                                            <span>Цена: {item.subscription_limits.price_monthly.toLocaleString("ru-RU")} ₽/мес</span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                    <CardTitle className="text-zinc-100 flex items-center gap-2">
                        <Plus className="h-5 w-5 text-emerald-400" />
                        Планы подписки
                    </CardTitle>
                    <CardDescription className="text-zinc-400">Создание плана, стоимости и периода действия</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-6">
                        <Input
                            placeholder="code (например, growth)"
                            value={planForm.code}
                            onChange={e => setPlanForm(prev => ({ ...prev, code: e.target.value }))}
                            className="md:col-span-2 bg-zinc-950 border-zinc-800 text-zinc-100"
                        />
                        <Input
                            placeholder="Название"
                            value={planForm.name}
                            onChange={e => setPlanForm(prev => ({ ...prev, name: e.target.value }))}
                            className="md:col-span-2 bg-zinc-950 border-zinc-800 text-zinc-100"
                        />
                        <Input
                            placeholder="Короткий подзаголовок"
                            value={planForm.tagline}
                            onChange={e => setPlanForm(prev => ({ ...prev, tagline: e.target.value }))}
                            className="md:col-span-2 bg-zinc-950 border-zinc-800 text-zinc-100"
                        />
                        <Input
                            placeholder="Badge текст (например, Популярный)"
                            value={planForm.badge_text}
                            onChange={e => setPlanForm(prev => ({ ...prev, badge_text: e.target.value }))}
                            className="md:col-span-2 bg-zinc-950 border-zinc-800 text-zinc-100"
                        />
                        <Input
                            placeholder="CTA текст (например, Выбрать Про)"
                            value={planForm.cta_text}
                            onChange={e => setPlanForm(prev => ({ ...prev, cta_text: e.target.value }))}
                            className="md:col-span-2 bg-zinc-950 border-zinc-800 text-zinc-100"
                        />
                        <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Стоимость"
                            value={planForm.price_amount}
                            onChange={e => setPlanForm(prev => ({ ...prev, price_amount: e.target.value }))}
                            className="bg-zinc-950 border-zinc-800 text-zinc-100"
                        />
                        <Input
                            type="number"
                            min="1"
                            step="1"
                            placeholder="Период"
                            value={planForm.period_value}
                            onChange={e => setPlanForm(prev => ({ ...prev, period_value: e.target.value }))}
                            className="bg-zinc-950 border-zinc-800 text-zinc-100"
                        />
                        <Input
                            type="number"
                            min="0"
                            step="1"
                            placeholder="Порядок"
                            value={planForm.display_order}
                            onChange={e => setPlanForm(prev => ({ ...prev, display_order: e.target.value }))}
                            className="bg-zinc-950 border-zinc-800 text-zinc-100"
                        />
                    </div>
                    <Input
                        placeholder="Описание тарифа"
                        value={planForm.description}
                        onChange={e => setPlanForm(prev => ({ ...prev, description: e.target.value }))}
                        className="bg-zinc-950 border-zinc-800 text-zinc-100"
                    />
                    <textarea
                        placeholder="Фичи тарифа, каждая с новой строки"
                        value={planForm.features}
                        onChange={e => setPlanForm(prev => ({ ...prev, features: e.target.value }))}
                        className="min-h-[96px] w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none"
                    />

                    <div className="grid gap-3 md:grid-cols-5">
                        <Select
                            value={planForm.period_unit}
                            onValueChange={value => setPlanForm(prev => ({ ...prev, period_unit: value as "day" | "month" | "year" }))}
                        >
                            <SelectTrigger className="bg-zinc-950 border-zinc-800 text-zinc-100">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-950 border-zinc-800 text-zinc-100">
                                <SelectItem value="day">Дни</SelectItem>
                                <SelectItem value="month">Месяцы</SelectItem>
                                <SelectItem value="year">Годы</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select
                            value={planForm.badge_tone}
                            onValueChange={value => setPlanForm(prev => ({ ...prev, badge_tone: value as "default" | "info" | "success" | "warning" | "danger" }))}
                        >
                            <SelectTrigger className="bg-zinc-950 border-zinc-800 text-zinc-100">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-950 border-zinc-800 text-zinc-100">
                                <SelectItem value="default">Badge: Default</SelectItem>
                                <SelectItem value="info">Badge: Info</SelectItem>
                                <SelectItem value="success">Badge: Success</SelectItem>
                                <SelectItem value="warning">Badge: Warning</SelectItem>
                                <SelectItem value="danger">Badge: Danger</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select
                            value={planForm.card_theme}
                            onValueChange={value => setPlanForm(prev => ({ ...prev, card_theme: value as "light" | "dark" | "accent" }))}
                        >
                            <SelectTrigger className="bg-zinc-950 border-zinc-800 text-zinc-100">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-950 border-zinc-800 text-zinc-100">
                                <SelectItem value="light">Тема: Светлая</SelectItem>
                                <SelectItem value="dark">Тема: Темная</SelectItem>
                                <SelectItem value="accent">Тема: Акцент</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select
                            value={planForm.is_active ? "active" : "inactive"}
                            onValueChange={value => setPlanForm(prev => ({ ...prev, is_active: value === "active" }))}
                        >
                            <SelectTrigger className="bg-zinc-950 border-zinc-800 text-zinc-100">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-950 border-zinc-800 text-zinc-100">
                                <SelectItem value="active">Активный</SelectItem>
                                <SelectItem value="inactive">Неактивный</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select
                            value={planForm.is_highlighted ? "yes" : "no"}
                            onValueChange={value => setPlanForm(prev => ({ ...prev, is_highlighted: value === "yes" }))}
                        >
                            <SelectTrigger className="bg-zinc-950 border-zinc-800 text-zinc-100">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-950 border-zinc-800 text-zinc-100">
                                <SelectItem value="yes">Выделять в витрине</SelectItem>
                                <SelectItem value="no">Обычная карточка</SelectItem>
                            </SelectContent>
                        </Select>

                        <div className="flex gap-2 md:col-span-1">
                            <Button onClick={savePlan} disabled={isPlanSaving} className="bg-emerald-600 hover:bg-emerald-500 flex-1">
                                {isPlanSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingPlanId ? "Сохранить" : "Создать"}
                            </Button>
                            {editingPlanId ? (
                                <Button variant="outline" onClick={resetPlanForm} className="border-zinc-700 bg-zinc-950 text-zinc-200">
                                    Сброс
                                </Button>
                            ) : null}
                        </div>
                    </div>

                    {isPlansLoading ? (
                        <div className="h-24 flex items-center justify-center">
                            <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {plans.map(plan => (
                                <div key={plan.id} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex flex-col">
                                        <p className="text-zinc-100 font-medium">{plan.name} <span className="text-zinc-500">({plan.code})</span></p>
                                        <p className="text-xs text-zinc-400">
                                            {Number(plan.price_amount).toLocaleString("ru-RU")} ₽ / {plan.period_value} {plan.period_unit === "day" ? "дн." : plan.period_unit === "month" ? "мес." : "г."}
                                        </p>
                                        <p className="text-xs text-zinc-500 mt-1">{plan.tagline || plan.description || "Без подзаголовка"}</p>
                                        {Array.isArray(plan.features) && plan.features.length > 0 ? (
                                            <p className="text-[11px] text-zinc-500 mt-1">Фичи: {plan.features.slice(0, 3).join(" • ")}</p>
                                        ) : null}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className={plan.is_active ? "border-emerald-700 text-emerald-300" : "border-zinc-700 text-zinc-400"}>
                                            {plan.is_active ? "Активен" : "Неактивен"}
                                        </Badge>
                                        {plan.is_highlighted ? (
                                            <Badge variant="outline" className="border-amber-700 text-amber-300">Выделен</Badge>
                                        ) : null}
                                        <Badge variant="outline" className="border-zinc-700 text-zinc-300">Порядок: {plan.display_order}</Badge>
                                        <Button size="icon" variant="ghost" onClick={() => startEditPlan(plan)} className="text-zinc-300 hover:text-white hover:bg-zinc-800">
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        {plan.is_active ? (
                                            <Button size="icon" variant="ghost" onClick={() => deactivatePlan(plan.id)} className="text-zinc-300 hover:text-red-400 hover:bg-zinc-800">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        ) : null}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </SuperAdminPage>
    )
}
