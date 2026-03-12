"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Save, ArrowLeft, Plus, Trash2, Scale, Info } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

interface Account {
    id: number
    name: string
    icon: string
    color: string
    account_type: string
    balance?: number
}

interface MappingField {
    metric_key: string
    custom_label: string
    field_type: 'INCOME' | 'EXPENSE' | 'EXPENSE_LIST' | 'OTHER'
    account_id?: number
}

interface Category {
    id: number
    name: string
    type: 'income' | 'expense'
    icon: string
    color: string
    is_system: boolean
    activity_type: 'operating' | 'investing' | 'financing'
}

interface RecurringPayment {
    id: number
    name: string
    amount: number
    day_of_month: number
    category_id: number
    category_name?: string
    category_color?: string
    category_icon?: string
    is_consumption_based: boolean
    consumption_unit?: string
    default_unit_price?: number
}

const ACCOUNT_TYPES = [
    { value: 'cash', label: 'Наличные' },
    { value: 'bank', label: 'Банк' },
    { value: 'card', label: 'Терминал' },
    { value: 'other', label: 'Другое' }
]

const ACCOUNT_ICONS = ['💰', '🏦', '💳', '📱', '🏪', '💵', '💴', '🪙']
const ACCOUNT_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f97316', '#ec4899', '#06b6d4', '#ef4444', '#eab308']
const COLOR_CLASS_MAP: Record<string, string> = {
    'bg-green-500': '#22c55e',
    'bg-blue-500': '#3b82f6',
    'bg-purple-500': '#8b5cf6',
    'bg-orange-500': '#f97316',
    'bg-pink-500': '#ec4899',
    'bg-cyan-500': '#06b6d4',
    'bg-red-500': '#ef4444',
    'bg-yellow-500': '#eab308'
}

const resolveColor = (color?: string) => {
    if (!color) return '#3b82f6'
    return COLOR_CLASS_MAP[color] || color
}

export default function FinanceSettingsPage({ params }: { params: Promise<{ clubId: string }> }) {
    const router = useRouter()
    const [clubId, setClubId] = useState('')
    const [accounts, setAccounts] = useState<Account[]>([])
    const [categories, setCategories] = useState<Category[]>([])
    const [recurringPayments, setRecurringPayments] = useState<RecurringPayment[]>([])
    const [mappingFields, setMappingFields] = useState<MappingField[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)

    // New account form
    const [showNewAccountForm, setShowNewAccountForm] = useState(false)
    const [newAccount, setNewAccount] = useState({
        name: '',
        icon: '💰',
        color: ACCOUNT_COLORS[0],
        account_type: 'cash'
    })

    // New category form
    const [showNewCategoryForm, setShowNewCategoryForm] = useState(false)
    const [newCategory, setNewCategory] = useState({
        name: '',
        type: 'expense' as 'income' | 'expense',
        icon: '💰',
        color: ACCOUNT_COLORS[1],
        activity_type: 'operating' as 'operating' | 'investing' | 'financing'
    })

    // New recurring form
    const [showNewRecurringForm, setShowNewRecurringForm] = useState(false)
    const [newRecurring, setNewRecurring] = useState({
        name: '',
        category_id: '',
        amount: 0,
        day_of_month: 1,
        is_consumption_based: false,
        consumption_unit: 'кВт',
        unit_price: 0
    })

    // Adjustment state
    const [showAdjustModal, setShowAdjustModal] = useState(false)
    const [adjustingAccount, setAdjustingAccount] = useState<Account | null>(null)
    const [adjustData, setAdjustData] = useState({
        new_balance: '',
        reason: 'Ввод начальных остатков'
    })

    useEffect(() => {
        params.then(p => {
            setClubId(p.clubId)
            fetchData(p.clubId)
        })
    }, [params])

    const fetchData = async (id: string) => {
        try {
            // 1. Get Accounts with Balances
            const accRes = await fetch(`/api/clubs/${id}/finance/accounts`)
            const accData = await accRes.json()
            if (accRes.ok) {
                // Map current_balance to balance for the UI
                const mappedAccounts = (accData.accounts || []).map((a: any) => ({
                    ...a,
                    balance: parseFloat(a.current_balance || 0)
                }))
                setAccounts(mappedAccounts)
            }

            // 2. Get current template for mapping
            const res = await fetch(`/api/clubs/${id}/settings/reports`)
            const data = await res.json()

            if (res.ok) {
                // Extract MAPPING fields from template
                if (data.currentTemplate?.schema) {
                    const fields = data.currentTemplate.schema
                        .filter((f: any) => ['INCOME', 'EXPENSE', 'EXPENSE_LIST'].includes(f.field_type))
                        .map((f: any) => ({
                            metric_key: f.metric_key,
                            custom_label: f.custom_label || f.metric_key,
                            field_type: f.field_type,
                            account_id: f.account_id
                        }))
                    setMappingFields(fields)
                }
            }

            // 3. Get categories
            const catRes = await fetch(`/api/clubs/${id}/finance/categories`)
            const catData = await catRes.json()
            if (catRes.ok) {
                setCategories(catData.categories || [])
            }

            // 4. Get recurring payments
            const recRes = await fetch(`/api/clubs/${id}/finance/recurring`)
            const recData = await recRes.json()
            if (recRes.ok) {
                setRecurringPayments(recData.recurring_payments || [])
            }

        } catch (error) {
            console.error('Error fetching data:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleAccountChange = (fieldKey: string, accountId: string) => {
        setMappingFields(fields =>
            fields.map(f =>
                f.metric_key === fieldKey
                    ? { ...f, account_id: parseInt(accountId) }
                    : f
            )
        )
    }

    const handleCreateAccount = async () => {
        if (!newAccount.name.trim()) {
            alert('Введите название счёта')
            return
        }

        setIsSaving(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/finance/accounts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newAccount)
            })

            if (res.ok) {
                await fetchData(clubId)
                setShowNewAccountForm(false)
                setNewAccount({ name: '', icon: '💰', color: 'bg-green-500', account_type: 'cash' })
            } else {
                alert('❌ Ошибка создания счёта')
            }
        } catch (error) {
            console.error('Error creating account:', error)
            alert('❌ Ошибка создания счёта')
        } finally {
            setIsSaving(false)
        }
    }

    const handleDeleteAccount = async (accountId: number) => {
        if (!confirm('Удалить этот счёт?')) return

        setIsSaving(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/finance/accounts?id=${accountId}`, {
                method: 'DELETE'
            })

            if (res.ok) {
                await fetchData(clubId)
            } else {
                const data = await res.json()
                alert(data.error || '❌ Ошибка удаления')
            }
        } catch (error) {
            console.error('Error deleting account:', error)
            alert('❌ Ошибка удаления счёта')
        } finally {
            setIsSaving(false)
        }
    }

    const handleCreateCategory = async () => {
        if (!newCategory.name.trim()) {
            alert('Введите название категории')
            return
        }

        setIsSaving(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/finance/categories`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newCategory)
            })

            if (res.ok) {
                await fetchData(clubId)
                setShowNewCategoryForm(false)
                setNewCategory({ ...newCategory, name: '', icon: '💰', activity_type: 'operating' })
            } else {
                alert('❌ Ошибка создания категории')
            }
        } catch (error) {
            console.error('Error creating category:', error)
            alert('❌ Ошибка создания категории')
        } finally {
            setIsSaving(false)
        }
    }

    const handleDeleteCategory = async (categoryId: number) => {
        if (!confirm('Удалить эту категорию? История операций сохранится, но категорию нельзя будет выбрать для новых операций.')) return

        setIsSaving(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/finance/categories?id=${categoryId}`, {
                method: 'DELETE'
            })

            if (res.ok) {
                await fetchData(clubId)
            } else {
                const data = await res.json()
                alert(data.error || '❌ Ошибка удаления')
            }
        } catch (error) {
            console.error('Error deleting category:', error)
            alert('❌ Ошибка удаления категории')
        } finally {
            setIsSaving(false)
        }
    }

    const handleCreateRecurring = async () => {
        if (!newRecurring.name.trim()) {
            alert('Введите название (например, Аренда)')
            return
        }
        if (!newRecurring.category_id) {
            alert('Выберите категорию')
            return
        }

        setIsSaving(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/finance/recurring`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newRecurring)
            })

            if (res.ok) {
                await fetchData(clubId)
                setShowNewRecurringForm(false)
                setNewRecurring({
                    name: '',
                    category_id: '',
                    amount: 0,
                    day_of_month: 1,
                    is_consumption_based: false,
                    consumption_unit: 'кВт',
                    unit_price: 0
                })
            } else {
                alert('❌ Ошибка создания шаблона')
            }
        } catch (error) {
            console.error('Error creating recurring:', error)
            alert('❌ Ошибка создания шаблона')
        } finally {
            setIsSaving(false)
        }
    }

    const handleDeleteRecurring = async (id: number) => {
        if (!confirm('Удалить этот шаблон платежа?')) return

        setIsSaving(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/finance/recurring?id=${id}`, {
                method: 'DELETE'
            })

            if (res.ok) {
                await fetchData(clubId)
            } else {
                const data = await res.json()
                alert(data.error || '❌ Ошибка удаления')
            }
        } catch (error) {
            console.error('Error deleting recurring:', error)
            alert('❌ Ошибка удаления')
        } finally {
            setIsSaving(false)
        }
    }

    const handleSaveMapping = async () => {
        setIsSaving(true)
        try {
            // Get full current template
            const res = await fetch(`/api/clubs/${clubId}/settings/reports`)
            const data = await res.json()

            if (!data.currentTemplate) {
                alert('Сначала настройте шаблон отчёта')
                return
            }

            // Update account_id in schema for all mapping fields
            const updatedSchema = data.currentTemplate.schema.map((field: any) => {
                const mappedField = mappingFields.find(f => f.metric_key === field.metric_key)
                if (mappedField) {
                    return { ...field, account_id: mappedField.account_id }
                }
                return field
            })

            // Save back
            const saveRes = await fetch(`/api/clubs/${clubId}/settings/reports`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ schema: updatedSchema })
            })

            if (saveRes.ok) {
                alert('✅ Маппинг сохранён!')
                router.refresh()
            } else {
                alert('❌ Ошибка сохранения')
            }
        } catch (error) {
            console.error('Error saving:', error)
            alert('❌ Ошибка сохранения')
        } finally {
            setIsSaving(false)
        }
    }

    const handleAdjustBalance = async () => {
        if (!adjustingAccount || adjustData.new_balance === '') return

        setIsSaving(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/finance/accounts/adjust`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    account_id: adjustingAccount.id,
                    new_balance: parseFloat(adjustData.new_balance),
                    reason: adjustData.reason
                })
            })

            if (res.ok) {
                await fetchData(clubId)
                setShowAdjustModal(false)
                setAdjustingAccount(null)
                setAdjustData({ new_balance: '', reason: 'Ввод начальных остатков' })
            } else {
                alert('❌ Ошибка корректировки')
            }
        } catch (error) {
            console.error('Error adjusting balance:', error)
            alert('❌ Ошибка корректировки')
        } finally {
            setIsSaving(false)
        }
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="p-4 md:p-8 space-y-8 bg-slate-50/50 min-h-screen">
            {/* Header Redesign */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="space-y-1">
                    <Link
                        href={`/clubs/${clubId}/finance`}
                        className="text-[10px] font-black text-slate-400 hover:text-primary flex items-center gap-1 mb-2 uppercase tracking-widest transition-colors"
                    >
                        <ArrowLeft className="h-3 w-3" />
                        Назад к финансам
                    </Link>
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900">Настройки финансов</h1>
                    <p className="text-slate-500 text-xs md:text-sm font-medium">Управление счетами, категориями и автоматизацией</p>
                </div>
            </div>

            <Tabs defaultValue="categories" className="w-full">
                <TabsList className="w-full md:w-auto bg-white border p-1 rounded-xl mb-8 shadow-sm">
                    <TabsTrigger value="categories" className="rounded-lg px-6 font-medium data-[state=active]:bg-slate-100 data-[state=active]:text-primary">📂 Категории</TabsTrigger>
                    <TabsTrigger value="recurring" className="rounded-lg px-6 font-medium data-[state=active]:bg-slate-100 data-[state=active]:text-primary">🔄 Постоянные</TabsTrigger>
                    <TabsTrigger value="accounts" className="rounded-lg px-6 font-medium data-[state=active]:bg-slate-100 data-[state=active]:text-primary">💳 Счета</TabsTrigger>
                    <TabsTrigger value="mapping" className="rounded-lg px-6 font-medium data-[state=active]:bg-slate-100 data-[state=active]:text-primary">🔗 Маппинг</TabsTrigger>
                </TabsList>

                {/* Categories Tab Redesign */}
                <TabsContent value="categories" className="space-y-8 focus-visible:outline-none">
                    <div className="bg-emerald-600 rounded-3xl p-6 text-white relative overflow-hidden shadow-xl shadow-emerald-100">
                        <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
                        <div className="flex items-center gap-6 relative z-10">
                            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-2xl shadow-inner">
                                📂
                            </div>
                            <div className="flex-1 space-y-1">
                                <h3 className="text-lg font-black tracking-tight">Как работают категории?</h3>
                                <p className="text-emerald-50 text-xs font-medium leading-relaxed max-w-2xl">
                                    Категории помогают вам понимать, на что тратятся деньги. Привязка к <strong>типу деятельности</strong> 
                                    автоматически распределяет транзакции в отчет ДДС (Операционный, Инвестиционный или Финансовый).
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                        <div className="space-y-1">
                            <h3 className="text-lg font-black text-slate-900">Справочник категорий</h3>
                            <p className="text-xs font-medium text-slate-500">Настройте классификацию доходов и расходов для отчетов ДДС</p>
                        </div>
                        <Button 
                            onClick={() => setShowNewCategoryForm(!showNewCategoryForm)}
                            className="rounded-xl font-bold text-xs px-6 shadow-sm shadow-primary/10"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Новая категория
                        </Button>
                    </div>

                    {showNewCategoryForm && (
                        <Card className="border-2 border-primary/20 bg-white rounded-3xl shadow-xl animate-in fade-in zoom-in-95 duration-300">
                            <CardHeader>
                                <CardTitle className="text-lg font-black">Создание категории</CardTitle>
                                <CardDescription className="text-xs font-medium">Новая категория будет доступна при вводе операций</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Название</Label>
                                        <Input
                                            value={newCategory.name}
                                            onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                                            placeholder="Например: Аренда склада"
                                            className="rounded-xl border-slate-200 bg-slate-50 focus:bg-white transition-colors h-11"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Тип операции</Label>
                                        <Select
                                            value={newCategory.type}
                                            onValueChange={(value: 'income' | 'expense') => setNewCategory({ ...newCategory, type: value })}
                                        >
                                            <SelectTrigger className="rounded-xl border-slate-200 bg-slate-50 h-11">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl">
                                                <SelectItem value="income">💰 Доход</SelectItem>
                                                <SelectItem value="expense">💸 Расход</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1 flex items-center gap-1.5">
                                            Тип деятельности (для ДДС)
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Info className="h-3 w-3 text-slate-300 cursor-help" />
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top" className="max-w-[300px] p-3 leading-relaxed">
                                                        <p><strong>🏃 Операционная</strong>: Всё, что нужно для ежедневной работы (выручка, зп, аренда).</p>
                                                        <p className="mt-2"><strong>🏗️ Инвестиционная</strong>: Траты на развитие, которые будут работать долго (новые ПК, ремонт).</p>
                                                        <p className="mt-2"><strong>🏦 Финансовая</strong>: Кредиты, вложения владельцев и выплата прибыли.</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </Label>
                                        <Select
                                            value={newCategory.activity_type}
                                            onValueChange={(value: 'operating' | 'investing' | 'financing') => setNewCategory({ ...newCategory, activity_type: value })}
                                        >
                                            <SelectTrigger className="rounded-xl border-slate-200 bg-slate-50 h-11">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl">
                                                <SelectItem value="operating">🏃 Операционная (текучка, зп, аренда)</SelectItem>
                                                <SelectItem value="investing">🏗️ Инвестиционная (оборудование, ремонт)</SelectItem>
                                                <SelectItem value="financing">🏦 Финансовая (кредиты, дивиденды)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-3">
                                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Иконка</Label>
                                        <div className="flex flex-wrap gap-2 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                            {ACCOUNT_ICONS.map(icon => (
                                                <button
                                                    key={icon}
                                                    onClick={() => setNewCategory({ ...newCategory, icon })}
                                                    className={`text-2xl w-10 h-10 flex items-center justify-center rounded-xl transition-all ${newCategory.icon === icon ? 'bg-white shadow-md scale-110 border-primary/40 border-2' : 'hover:bg-white hover:shadow-sm'
                                                        }`}
                                                >
                                                    {icon}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Цвет</Label>
                                        <div className="flex flex-wrap gap-2 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                            {ACCOUNT_COLORS.map(color => (
                                                <button
                                                    key={color}
                                                    onClick={() => setNewCategory({ ...newCategory, color })}
                                                    className={`w-10 h-10 rounded-xl border-2 transition-all ${newCategory.color === color ? 'border-slate-900 scale-110 shadow-md' : 'border-transparent hover:scale-105'
                                                        }`}
                                                    style={{ backgroundColor: color }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-4 border-t border-slate-100">
                                    <Button onClick={handleCreateCategory} disabled={isSaving} className="rounded-xl px-8 font-bold">
                                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                        Создать категорию
                                    </Button>
                                    <Button variant="ghost" onClick={() => setShowNewCategoryForm(false)} className="rounded-xl font-bold text-slate-500">
                                        Отмена
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <div className="grid md:grid-cols-2 gap-8">
                        {/* Income Categories Redesign */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 ml-2">
                                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-inner">
                                    <Plus className="h-4 w-4" />
                                </div>
                                <h3 className="font-black text-slate-900 uppercase tracking-tight text-sm">Доходы</h3>
                            </div>
                            <div className="grid gap-3">
                                {categories.filter(c => c.type === 'income').map((cat) => (
                                    <div
                                        key={cat.id}
                                        className="group flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-all hover:border-emerald-100"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div
                                                className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-inner transition-transform group-hover:scale-105"
                                                style={{ backgroundColor: resolveColor(cat.color) + '15' }}
                                            >
                                                {cat.icon}
                                            </div>
                                            <div>
                                                <div className="font-black text-slate-900 text-sm">{cat.name}</div>
                                                <div className="text-[10px] font-black uppercase text-slate-400 mt-0.5 tracking-tighter">
                                                    {cat.is_system ? 'СИСТЕМНАЯ' : ''} • {cat.activity_type === 'operating' ? 'Операционная' : cat.activity_type === 'investing' ? 'Инвестиционная' : 'Финансовая'}
                                                </div>
                                            </div>
                                        </div>
                                        {!cat.is_system && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDeleteCategory(cat.id)}
                                                className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 rounded-lg hover:bg-rose-50 hover:text-rose-600"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Expense Categories Redesign */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 ml-2">
                                <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shadow-inner">
                                    <Trash2 className="h-4 w-4" />
                                </div>
                                <h3 className="font-black text-slate-900 uppercase tracking-tight text-sm">Расходы</h3>
                            </div>
                            <div className="grid gap-3">
                                {categories.filter(c => c.type === 'expense').map((cat) => (
                                    <div
                                        key={cat.id}
                                        className="group flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-all hover:border-rose-100"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div
                                                className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-inner transition-transform group-hover:scale-105"
                                                style={{ backgroundColor: resolveColor(cat.color) + '15' }}
                                            >
                                                {cat.icon}
                                            </div>
                                            <div>
                                                <div className="font-black text-slate-900 text-sm">{cat.name}</div>
                                                <div className="text-[10px] font-black uppercase text-slate-400 mt-0.5 tracking-tighter">
                                                    {cat.is_system ? 'СИСТЕМНАЯ' : ''} • {cat.activity_type === 'operating' ? 'Операционная' : cat.activity_type === 'investing' ? 'Инвестиционная' : 'Финансовая'}
                                                </div>
                                            </div>
                                        </div>
                                        {!cat.is_system && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDeleteCategory(cat.id)}
                                                className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 rounded-lg hover:bg-rose-50 hover:text-rose-600"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </TabsContent>

                {/* Recurring Payments Tab Redesign */}
                <TabsContent value="recurring" className="space-y-8 focus-visible:outline-none">
                    <div className="bg-amber-500 rounded-3xl p-6 text-white relative overflow-hidden shadow-xl shadow-amber-100">
                        <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
                        <div className="flex items-center gap-6 relative z-10">
                            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-2xl shadow-inner">
                                🔄
                            </div>
                            <div className="flex-1 space-y-1">
                                <h3 className="text-lg font-black tracking-tight">Зачем нужны автоплатежи?</h3>
                                <p className="text-amber-50 text-xs font-medium leading-relaxed max-w-2xl">
                                    Настройте один раз аренду, интернет или коммуналку. В начале каждого месяца они появятся в блоке 
                                    <strong> «Счета к оплате» </strong> на дашборде, чтобы вы ничего не забыли.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                        <div className="space-y-1">
                            <h3 className="text-lg font-black text-slate-900">Регулярные обязательства</h3>
                            <p className="text-xs font-medium text-slate-500">Автоматическое планирование ежемесячных платежей (аренда, интернет, коммуналка)</p>
                        </div>
                        <Button 
                            onClick={() => setShowNewRecurringForm(!showNewRecurringForm)}
                            className="rounded-xl font-bold text-xs px-6 shadow-sm shadow-primary/10"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Создать правило
                        </Button>
                    </div>

                    {showNewRecurringForm && (
                        <Card className="border-2 border-primary/20 bg-white rounded-3xl shadow-xl animate-in fade-in zoom-in-95 duration-300">
                            <CardHeader>
                                <CardTitle className="text-lg font-black">Настройка автоплатежа</CardTitle>
                                <CardDescription className="text-xs font-medium">Платеж будет автоматически появляться в списке к оплате каждого месяца</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Название платежа</Label>
                                        <Input
                                            value={newRecurring.name}
                                            onChange={(e) => setNewRecurring({ ...newRecurring, name: e.target.value })}
                                            placeholder="Например: Аренда помещения"
                                            className="rounded-xl border-slate-200 bg-slate-50 focus:bg-white transition-colors h-11"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Категория расхода</Label>
                                        <Select
                                            value={newRecurring.category_id}
                                            onValueChange={(value) => setNewRecurring({ ...newRecurring, category_id: value })}
                                        >
                                            <SelectTrigger className="rounded-xl border-slate-200 bg-slate-50 h-11">
                                                <SelectValue placeholder="Выберите категорию" />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl">
                                                {categories
                                                    .filter(c => c.type === 'expense')
                                                    .map(c => (
                                                        <SelectItem key={c.id} value={c.id.toString()}>
                                                            {c.icon} {c.name}
                                                        </SelectItem>
                                                    ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">День месяца (дедлайн)</Label>
                                        <Input
                                            type="number"
                                            min="1"
                                            max="31"
                                            value={newRecurring.day_of_month}
                                            onChange={(e) => setNewRecurring({ ...newRecurring, day_of_month: parseInt(e.target.value) || 1 })}
                                            className="rounded-xl border-slate-200 bg-slate-50 focus:bg-white transition-colors h-11"
                                        />
                                    </div>
                                    <div className="flex items-end pb-1">
                                        <div className="flex items-center space-x-3 bg-slate-50 p-3 rounded-xl border border-slate-100 w-full h-11 relative">
                                            <input
                                                type="checkbox"
                                                id="is_consumption"
                                                className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                                                checked={newRecurring.is_consumption_based}
                                                onChange={(e) => setNewRecurring({ ...newRecurring, is_consumption_based: e.target.checked })}
                                            />
                                            <Label htmlFor="is_consumption" className="cursor-pointer font-bold text-xs text-slate-700 flex items-center gap-1.5">
                                                Расчет по счетчикам (коммуналка)
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Info className="h-3 w-3 text-slate-300 cursor-help" />
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top" className="max-w-[200px]">
                                                            Используйте для платежей, сумма которых меняется каждый месяц (электричество, вода). При оплате система попросит ввести текущие показания.
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            </Label>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-6 bg-slate-50/50 rounded-2xl border border-slate-100 space-y-4">
                                    {newRecurring.is_consumption_based ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Ед. измерения</Label>
                                                <Input
                                                    value={newRecurring.consumption_unit}
                                                    onChange={(e) => setNewRecurring({ ...newRecurring, consumption_unit: e.target.value })}
                                                    placeholder="кВт, м3, Гкал..."
                                                    className="rounded-xl border-slate-200 bg-white h-11"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Тариф (за ед.)</Label>
                                                <div className="relative">
                                                    <Input
                                                        type="number"
                                                        value={newRecurring.unit_price}
                                                        onChange={(e) => setNewRecurring({ ...newRecurring, unit_price: parseFloat(e.target.value) || 0 })}
                                                        placeholder="0.00"
                                                        className="rounded-xl border-slate-200 bg-white h-11 pr-8"
                                                    />
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₽</span>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Сумма платежа</Label>
                                            <div className="relative max-w-md">
                                                <Input
                                                    type="number"
                                                    value={newRecurring.amount}
                                                    onChange={(e) => setNewRecurring({ ...newRecurring, amount: parseFloat(e.target.value) || 0 })}
                                                    placeholder="0.00"
                                                    className="rounded-xl border-slate-200 bg-white h-11 pr-8 text-lg font-black"
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₽</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-3 pt-4 border-t border-slate-100">
                                    <Button onClick={handleCreateRecurring} disabled={isSaving} className="rounded-xl px-8 font-bold">
                                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                        Сохранить правило
                                    </Button>
                                    <Button variant="ghost" onClick={() => setShowNewRecurringForm(false)} className="rounded-xl font-bold text-slate-500">
                                        Отмена
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <div className="grid gap-4 md:grid-cols-2">
                        {recurringPayments.length === 0 ? (
                            <div className="md:col-span-2 bg-white border border-dashed rounded-3xl py-20 flex flex-col items-center justify-center text-slate-400">
                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-2xl">⏳</div>
                                <p className="font-bold text-sm">Список пуст</p>
                                <p className="text-xs">Добавьте первый регулярный платеж</p>
                            </div>
                        ) : (
                            recurringPayments.map((rp) => (
                                <div key={rp.id} className="group p-5 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-all hover:border-primary/10 flex items-start justify-between">
                                    <div className="flex items-start gap-4">
                                        <div
                                            className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-inner transition-transform group-hover:scale-105"
                                            style={{ backgroundColor: resolveColor(rp.category_color) + '15' }}
                                        >
                                            {rp.category_icon || '📅'}
                                        </div>
                                        <div>
                                            <div className="font-black text-slate-900 text-lg leading-tight">{rp.name}</div>
                                            <div className="text-[10px] font-black uppercase text-slate-400 mt-1 tracking-tighter">
                                                {rp.category_name} • До {rp.day_of_month}-го числа
                                            </div>

                                            <div className="mt-3 flex items-center gap-2">
                                                {rp.is_consumption_based ? (
                                                    <span className="px-2 py-0.5 rounded-lg bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-widest border border-blue-100">
                                                        {rp.consumption_unit} • {rp.default_unit_price} ₽/ед.
                                                    </span>
                                                ) : (
                                                    <span className="text-xl font-black text-slate-900">
                                                        {rp.amount?.toLocaleString()} ₽
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleDeleteRecurring(rp.id)}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 rounded-lg hover:bg-rose-50 hover:text-rose-600"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))
                        )}
                    </div>
                </TabsContent>

                {/* Accounts Tab Redesign */}
                <TabsContent value="accounts" className="space-y-8 focus-visible:outline-none">
                    <div className="bg-slate-900 rounded-3xl p-6 text-white relative overflow-hidden shadow-xl shadow-slate-200">
                        <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
                        <div className="flex items-center gap-6 relative z-10">
                            <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-2xl shadow-inner">
                                💳
                            </div>
                            <div className="flex-1 space-y-1">
                                <h3 className="text-lg font-black tracking-tight">Ваши счета и кошельки</h3>
                                <p className="text-slate-400 text-xs font-medium leading-relaxed max-w-2xl">
                                    Добавьте сюда все места, где хранятся деньги клуба: кассу, расчетный счет, терминал. 
                                    Используйте иконку ⚖️ для <strong>корректировки баланса</strong> до реальных сумм.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                        <div className="space-y-1">
                            <h3 className="text-lg font-black text-slate-900">Счета и кошельки</h3>
                            <p className="text-xs font-medium text-slate-500">Места хранения денег клуба (касса, банк, терминалы)</p>
                        </div>
                        <Button 
                            onClick={() => setShowNewAccountForm(!showNewAccountForm)}
                            className="rounded-xl font-bold text-xs px-6 shadow-sm shadow-primary/10"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Новый счёт
                        </Button>
                    </div>

                    {showNewAccountForm && (
                        <Card className="border-2 border-primary/20 bg-white rounded-3xl shadow-xl animate-in fade-in zoom-in-95 duration-300">
                            <CardHeader>
                                <CardTitle className="text-lg font-black">Создание счета</CardTitle>
                                <CardDescription className="text-xs font-medium">Счет будет использоваться для ведения баланса и привязки доходов</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Название счета</Label>
                                        <Input
                                            value={newAccount.name}
                                            onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                                            placeholder="Например: Сбербанк Бизнес"
                                            className="rounded-xl border-slate-200 bg-slate-50 focus:bg-white transition-colors h-11"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Тип счета</Label>
                                        <Select
                                            value={newAccount.account_type}
                                            onValueChange={(value) => setNewAccount({ ...newAccount, account_type: value })}
                                        >
                                            <SelectTrigger className="rounded-xl border-slate-200 bg-slate-50 h-11">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl">
                                                {ACCOUNT_TYPES.map(type => (
                                                    <SelectItem key={type.value} value={type.value}>
                                                        {type.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-3">
                                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Иконка</Label>
                                        <div className="flex flex-wrap gap-2 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                            {ACCOUNT_ICONS.map(icon => (
                                                <button
                                                    key={icon}
                                                    onClick={() => setNewAccount({ ...newAccount, icon })}
                                                    className={`text-2xl w-10 h-10 flex items-center justify-center rounded-xl transition-all ${newAccount.icon === icon ? 'bg-white shadow-md scale-110 border-primary/40 border-2' : 'hover:bg-white hover:shadow-sm'
                                                        }`}
                                                >
                                                    {icon}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Цвет акцента</Label>
                                        <div className="flex flex-wrap gap-2 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                            {ACCOUNT_COLORS.map(color => (
                                                <button
                                                    key={color}
                                                    onClick={() => setNewAccount({ ...newAccount, color })}
                                                    className={`w-10 h-10 rounded-xl border-2 transition-all ${newAccount.color === color ? 'border-slate-900 scale-110 shadow-md' : 'border-transparent hover:scale-105'
                                                        }`}
                                                    style={{ backgroundColor: color }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-4 border-t border-slate-100">
                                    <Button onClick={handleCreateAccount} disabled={isSaving} className="rounded-xl px-8 font-bold">
                                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                        Создать счет
                                    </Button>
                                    <Button variant="ghost" onClick={() => setShowNewAccountForm(false)} className="rounded-xl font-bold text-slate-500">
                                        Отмена
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <div className="grid gap-4 md:grid-cols-3">
                        {accounts.map((account) => (
                            <div
                                key={account.id}
                                className="group p-6 bg-white border border-slate-100 rounded-3xl shadow-sm hover:shadow-lg transition-all hover:border-primary/10 relative overflow-hidden"
                            >
                                <div className="absolute -right-4 -top-4 w-20 h-20 opacity-[0.03] transition-all group-hover:scale-150 group-hover:opacity-[0.05]" style={{ backgroundColor: resolveColor(account.color) }} />
                                
                                <div className="flex items-center gap-4 mb-6">
                                    <div
                                        className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-inner transition-transform group-hover:scale-110"
                                        style={{ backgroundColor: resolveColor(account.color) + '15' }}
                                    >
                                        {account.icon}
                                    </div>
                                    <div>
                                        <div className="font-black text-slate-900 text-lg leading-tight">{account.name}</div>
                                        <div className="text-[10px] font-black uppercase text-slate-400 mt-1 tracking-widest">
                                            {ACCOUNT_TYPES.find(t => t.value === account.account_type)?.label}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="text-sm font-bold text-slate-400 uppercase tracking-tighter">Действия</div>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => {
                                                setAdjustingAccount(account)
                                                setAdjustData({ ...adjustData, new_balance: (account.balance || 0).toString() })
                                                setShowAdjustModal(true)
                                            }}
                                            className="h-9 w-9 rounded-xl hover:bg-primary/5 hover:text-primary transition-colors"
                                            title="Корректировка остатка"
                                        >
                                            <Scale className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDeleteAccount(account.id)}
                                            className="h-9 w-9 rounded-xl hover:bg-rose-50 hover:text-rose-600 transition-colors"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </TabsContent>

                {/* Mapping Tab Redesign */}
                <TabsContent value="mapping" className="space-y-8 focus-visible:outline-none">
                    <div className="bg-primary rounded-3xl p-6 text-white relative overflow-hidden shadow-xl shadow-primary/20">
                        <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
                        <div className="flex items-center gap-6 relative z-10">
                            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-2xl shadow-inner">
                                🔗
                            </div>
                            <div className="flex-1 space-y-1">
                                <h3 className="text-lg font-black tracking-tight">Как автоматизировать учет выручки?</h3>
                                <p className="text-primary-foreground/80 text-xs font-medium leading-relaxed max-w-2xl">
                                    Привяжите показатели из ежедневных отчетов смен к вашим финансовым счетам. 
                                    Теперь при подтверждении смены деньги будут <strong>автоматически</strong> зачисляться на нужные счета.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-1">
                        <h3 className="text-lg font-black text-slate-900">Маппинг операций</h3>
                        <p className="text-xs font-medium text-slate-500">Привяжите поля из отчетов смен к конкретным финансовым счетам для автоматического учета</p>
                    </div>

                    <Card className="border-none shadow-sm bg-white rounded-3xl overflow-hidden">
                        <CardContent className="p-0">
                            {mappingFields.length === 0 ? (
                                <div className="text-center py-20 text-slate-400">
                                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 mx-auto text-2xl">🔗</div>
                                    <p className="font-bold text-sm">Нет полей для маппинга в шаблоне</p>
                                    <Link
                                        href={`/clubs/${clubId}/settings/reports`}
                                        className="text-primary font-black text-xs uppercase tracking-widest mt-4 inline-block hover:underline"
                                    >
                                        Настроить шаблон →
                                    </Link>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-50">
                                    {mappingFields.map((field) => (
                                        <div
                                            key={field.metric_key}
                                            className="flex flex-col md:flex-row md:items-center justify-between p-6 hover:bg-slate-50/50 transition-colors gap-4"
                                        >
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <div className="font-black text-slate-900">{field.custom_label}</div>
                                                    <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${
                                                        field.field_type === 'INCOME' ? 'bg-emerald-100 text-emerald-600' : 'bg-orange-100 text-orange-600'
                                                    }`}>
                                                        {field.field_type === 'INCOME' ? 'ДОХОД' : 'РАСХОД'}
                                                    </span>
                                                </div>
                                                <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                                                    Ключ метрики: {field.metric_key}
                                                </div>
                                            </div>

                                            <div className="w-full md:w-72">
                                                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1 mb-1.5 block">
                                                    {field.field_type === 'INCOME' ? 'Зачислять на счет:' : 'Списывать со счета:'}
                                                </Label>
                                                <Select
                                                    value={field.account_id?.toString() || ''}
                                                    onValueChange={(value) =>
                                                        handleAccountChange(field.metric_key, value)
                                                    }
                                                >
                                                    <SelectTrigger className="rounded-xl border-slate-200 bg-white h-11">
                                                        <SelectValue placeholder="Выберите счёт" />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-xl">
                                                        {accounts.map((account) => (
                                                            <SelectItem
                                                                key={account.id}
                                                                value={account.id.toString()}
                                                            >
                                                                <span className="flex items-center gap-2">
                                                                    <span>{account.icon}</span>
                                                                    <span className="font-bold">{account.name}</span>
                                                                </span>
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    ))}

                                    <div className="p-6 bg-slate-50/50 flex justify-end">
                                        <Button onClick={handleSaveMapping} disabled={isSaving} className="rounded-xl px-10 h-12 font-black shadow-lg shadow-primary/20">
                                            {isSaving ? (
                                                <>
                                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                    Сохранение...
                                                </>
                                            ) : (
                                                <>
                                                    <Save className="mr-2 h-5 w-5" />
                                                    Сохранить маппинг
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Balance Adjustment Modal */}
            <Dialog open={showAdjustModal} onOpenChange={setShowAdjustModal}>
                <DialogContent className="max-w-md rounded-3xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black">Корректировка остатка</DialogTitle>
                        <DialogDescription className="text-xs font-medium">
                            Выравнивание баланса счета {adjustingAccount?.name} через техническую транзакцию
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                            <p className="text-[10px] font-black uppercase text-slate-400">Текущий баланс в системе</p>
                            <p className="text-xl font-black text-slate-900">
                                {new Intl.NumberFormat('ru-RU').format(adjustingAccount?.balance || 0)} ₽
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Реальная сумма на счету</Label>
                            <div className="relative">
                                <Input
                                    type="number"
                                    value={adjustData.new_balance}
                                    onChange={(e) => setAdjustData({ ...adjustData, new_balance: e.target.value })}
                                    placeholder="0.00"
                                    className="rounded-xl border-slate-200 bg-white h-12 pr-8 text-lg font-black"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₽</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Причина корректировки</Label>
                            <Input
                                value={adjustData.reason}
                                onChange={(e) => setAdjustData({ ...adjustData, reason: e.target.value })}
                                placeholder="Например: Ввод начальных остатков"
                                className="rounded-xl border-slate-200 bg-white h-11"
                            />
                        </div>

                        {adjustData.new_balance !== '' && (
                            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3">
                                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                                    ⚖️
                                </div>
                                <p className="text-[11px] font-medium text-amber-800 leading-tight">
                                    Система автоматически создаст {(parseFloat(adjustData.new_balance) || 0) - (adjustingAccount?.balance || 0) >= 0 ? 'доходную' : 'расходную'} транзакцию на разницу 
                                    <strong> {new Intl.NumberFormat('ru-RU').format(Math.abs((parseFloat(adjustData.new_balance) || 0) - (adjustingAccount?.balance || 0)))} ₽</strong>.
                                </p>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="gap-2">
                        <Button variant="ghost" onClick={() => setShowAdjustModal(false)} className="rounded-xl font-bold text-slate-500">
                            Отмена
                        </Button>
                        <Button 
                            onClick={handleAdjustBalance} 
                            disabled={isSaving || adjustData.new_balance === ''}
                            className="rounded-xl px-8 font-black shadow-lg shadow-primary/20"
                        >
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                            Выровнять баланс
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
