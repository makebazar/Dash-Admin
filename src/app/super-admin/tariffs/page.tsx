"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Loader2, Plus, Pencil, Trash2, Check, X, AlertCircle } from "lucide-react"
import { SuperAdminPage } from "../_components/page-shell"

interface TariffPlan {
    id: number
    code: string
    name: string
    tagline: string | null
    description: string | null
    price_amount: string
    price_per_extra_club: string
    period_unit: "month" | "year"
    period_value: number
    grace_period_days: number
    display_order: number
    is_active: boolean
}

const EMPTY_FORM = {
    code: "",
    name: "",
    tagline: "",
    description: "",
    price_amount: "",
    price_per_extra_club: "",
    period_unit: "month" as "month" | "year",
    grace_period_days: "7",
    display_order: "100",
    is_active: true,
}

export default function TariffsPage() {
    const [plans, setPlans] = useState<TariffPlan[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [editingPlanId, setEditingPlanId] = useState<number | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [form, setForm] = useState(EMPTY_FORM)

    useEffect(() => {
        fetchPlans()
    }, [])

    const fetchPlans = async () => {
        setIsLoading(true)
        try {
            const res = await fetch("/api/super-admin/subscription-plans")
            const data = await res.json()
            if (res.ok) {
                setPlans(data.plans || [])
            }
        } catch (error) {
            console.error("Error fetching plans:", error)
        } finally {
            setIsLoading(false)
        }
    }

    const startCreate = () => {
        setEditingPlanId(null)
        setForm(EMPTY_FORM)
    }

    const startEdit = (plan: TariffPlan) => {
        setEditingPlanId(plan.id)
        setForm({
            code: plan.code,
            name: plan.name,
            tagline: plan.tagline || "",
            description: plan.description || "",
            price_amount: String(plan.price_amount),
            price_per_extra_club: String(plan.price_per_extra_club),
            period_unit: plan.period_unit,
            grace_period_days: String(plan.grace_period_days),
            display_order: String(plan.display_order ?? 100),
            is_active: plan.is_active,
        })
    }

    const resetForm = () => {
        setEditingPlanId(null)
        setForm(EMPTY_FORM)
    }

    const savePlan = async () => {
        const payload = {
            code: form.code.trim().toLowerCase(),
            name: form.name.trim(),
            tagline: form.tagline.trim() || null,
            description: form.description.trim() || null,
            price_amount: Number(form.price_amount || 0),
            price_per_extra_club: Number(form.price_per_extra_club || 0),
            period_unit: form.period_unit,
            grace_period_days: Number(form.grace_period_days || 7),
            display_order: Number(form.display_order || 100),
            is_active: form.is_active,
        }

        if (!payload.code || !payload.name) {
            alert("Укажи код и название")
            return
        }

        setIsSaving(true)
        try {
            const res = await fetch("/api/super-admin/subscription-plans", {
                method: editingPlanId ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editingPlanId ? { ...payload, id: editingPlanId } : payload)
            })
            const data = await res.json()
            if (!res.ok) {
                alert(data.error || "Не удалось сохранить")
                return
            }
            resetForm()
            await fetchPlans()
        } catch (error) {
            console.error("Error saving plan:", error)
            alert("Ошибка сохранения")
        } finally {
            setIsSaving(false)
        }
    }

    const deactivatePlan = async (id: number) => {
        if (!confirm("Деактивировать этот тариф?")) return
        try {
            const res = await fetch(`/api/super-admin/subscription-plans?id=${id}`, { method: "DELETE" })
            const data = await res.json()
            if (!res.ok) {
                alert(data.error || "Не удалось деактивировать")
                return
            }
            await fetchPlans()
            if (editingPlanId === id) resetForm()
        } catch (error) {
            console.error("Error deactivating plan:", error)
            alert("Ошибка")
        }
    }

    const formatPrice = (amount: string | number, perClub: string | number, period: string) => {
        const base = Number(amount).toLocaleString("ru-RU")
        const extra = Number(perClub).toLocaleString("ru-RU")
        const periodLabel = period === "year" ? "год" : "мес"
        if (Number(perClub) === 0) {
            return `${base} ₽/${periodLabel}`
        }
        return `${base} ₽/${periodLabel} (+${extra} за доп. клуб)`
    }

    return (
        <SuperAdminPage
            title="Тарифы"
            description="Настройка тарифных планов"
            actions={
                <Button onClick={startCreate} className="bg-emerald-600 hover:bg-emerald-500">
                    <Plus className="h-4 w-4 mr-2" />
                    Новый тариф
                </Button>
            }
        >

            {/* Список тарифов */}
            <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                    <CardTitle className="text-zinc-100 text-lg">Активные тарифы</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="h-32 flex items-center justify-center">
                            <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
                        </div>
                    ) : plans.length === 0 ? (
                        <p className="text-zinc-500 text-center py-8">Нет тарифов</p>
                    ) : (
                        <div className="space-y-3">
                            {plans.map(plan => (
                                <div
                                    key={plan.id}
                                    className={`p-4 rounded-lg border transition-colors ${
                                        editingPlanId === plan.id
                                            ? 'border-purple-500 bg-purple-500/10'
                                            : 'border-zinc-800 bg-zinc-950 hover:border-zinc-700'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-1">
                                                <h3 className="text-zinc-100 font-semibold">{plan.name}</h3>
                                                <Badge variant="outline" className={plan.is_active ? "border-emerald-700 text-emerald-300" : "border-zinc-700 text-zinc-500"}>
                                                    {plan.is_active ? "Активен" : "Неактивен"}
                                                </Badge>
                                            </div>
                                            <p className="text-zinc-400 text-sm mb-2">{plan.tagline || plan.description || "—"}</p>
                                            <p className="text-zinc-300 font-medium">
                                                {formatPrice(plan.price_amount, plan.price_per_extra_club, plan.period_unit)}
                                            </p>
                                            <div className="flex items-center gap-4 mt-2 text-xs text-zinc-500">
                                                <span>Grace period: {plan.grace_period_days} дн.</span>
                                                <span>Период: {plan.period_unit === "year" ? "год" : "месяц"}</span>
                                                <span>Порядок: {plan.display_order}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button size="sm" variant="ghost" onClick={() => startEdit(plan)} className="text-zinc-300 hover:text-white">
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            {plan.is_active && (
                                                <Button size="sm" variant="ghost" onClick={() => deactivatePlan(plan.id)} className="text-zinc-300 hover:text-red-400">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Форма создания/редактирования */}
            {(editingPlanId || form.code || form.name) && (
                <Card className="bg-zinc-900 border-zinc-800">
                    <CardHeader>
                        <CardTitle className="text-zinc-100 flex items-center gap-2">
                            {editingPlanId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                            {editingPlanId ? "Редактирование тарифа" : "Новый тариф"}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Основное */}
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label className="text-zinc-400">Код (eng, уникальный)</Label>
                                <Input
                                    value={form.code}
                                    onChange={e => setForm(p => ({ ...p, code: e.target.value }))}
                                    placeholder="starter, annual..."
                                    className="bg-zinc-950 border-zinc-800 text-zinc-100"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-zinc-400">Название</Label>
                                <Input
                                    value={form.name}
                                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                                    placeholder="Стандарт, Годовой..."
                                    className="bg-zinc-950 border-zinc-800 text-zinc-100"
                                />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label className="text-zinc-400">Короткий подзаголовок</Label>
                                <Input
                                    value={form.tagline}
                                    onChange={e => setForm(p => ({ ...p, tagline: e.target.value }))}
                                    placeholder="Для первого клуба"
                                    className="bg-zinc-950 border-zinc-800 text-zinc-100"
                                />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label className="text-zinc-400">Описание</Label>
                                <Textarea
                                    value={form.description}
                                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                                    placeholder="Полное описание тарифа..."
                                    className="bg-zinc-950 border-zinc-800 text-zinc-100 min-h-[80px]"
                                />
                            </div>
                        </div>

                        {/* Цены */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-zinc-300">Цены</h3>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label className="text-zinc-400">Цена за первый клуб (₽)</Label>
                                    <Input
                                        type="number"
                                        min="0"
                                        value={form.price_amount}
                                        onChange={e => setForm(p => ({ ...p, price_amount: e.target.value }))}
                                        placeholder="2900"
                                        className="bg-zinc-950 border-zinc-800 text-zinc-100"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-zinc-400">Цена за доп. клуб (₽)</Label>
                                    <Input
                                        type="number"
                                        min="0"
                                        value={form.price_per_extra_club}
                                        onChange={e => setForm(p => ({ ...p, price_per_extra_club: e.target.value }))}
                                        placeholder="1500"
                                        className="bg-zinc-950 border-zinc-800 text-zinc-100"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Настройки */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-zinc-300">Настройки</h3>
                            <div className="grid gap-4 md:grid-cols-3">
                                <div className="space-y-2">
                                    <Label className="text-zinc-400">Период</Label>
                                    <select
                                        value={form.period_unit}
                                        onChange={e => setForm(p => ({ ...p, period_unit: e.target.value as "month" | "year" }))}
                                        className="w-full h-10 px-3 rounded-md border border-zinc-800 bg-zinc-950 text-zinc-100"
                                    >
                                        <option value="month">Месяц</option>
                                        <option value="year">Год</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-zinc-400">Grace period (дней)</Label>
                                    <div className="relative">
                                        <Input
                                            type="number"
                                            min="0"
                                            max="30"
                                            value={form.grace_period_days}
                                            onChange={e => setForm(p => ({ ...p, grace_period_days: e.target.value }))}
                                            className="bg-zinc-950 border-zinc-800 text-zinc-100 pr-16"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">дней</span>
                                    </div>
                                    <p className="text-zinc-600 text-xs flex items-center gap-1">
                                        <AlertCircle className="h-3 w-3" />
                                        Полный доступ после истечения подписки
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-zinc-400">Порядок</Label>
                                    <Input
                                        type="number"
                                        min="0"
                                        value={form.display_order}
                                        onChange={e => setForm(p => ({ ...p, display_order: e.target.value }))}
                                        className="bg-zinc-950 border-zinc-800 text-zinc-100"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Кнопки */}
                        <div className="flex gap-3 pt-4 border-t border-zinc-800">
                            <Button onClick={savePlan} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-500">
                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                                {editingPlanId ? "Сохранить" : "Создать"}
                            </Button>
                            <Button variant="outline" onClick={resetForm} className="border-zinc-700 bg-zinc-950 text-zinc-200">
                                <X className="h-4 w-4 mr-2" />
                                Отмена
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </SuperAdminPage>
    )
}
