"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Save, ArrowLeft, Plus, Trash2, Edit2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface Account {
    id: number
    name: string
    icon: string
    color: string
    account_type: string
    balance?: number
}

interface IncomeField {
    metric_key: string
    custom_label: string
    account_id?: number
}

interface Category {
    id: number
    name: string
    type: 'income' | 'expense'
    icon: string
    color: string
    is_system: boolean
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
const ACCOUNT_COLORS = ['bg-green-500', 'bg-blue-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500', 'bg-cyan-500', 'bg-red-500', 'bg-yellow-500']

export default function FinanceSettingsPage({ params }: { params: Promise<{ clubId: string }> }) {
    const router = useRouter()
    const [clubId, setClubId] = useState('')
    const [accounts, setAccounts] = useState<Account[]>([])
    const [categories, setCategories] = useState<Category[]>([])
    const [recurringPayments, setRecurringPayments] = useState<RecurringPayment[]>([])
    const [incomeFields, setIncomeFields] = useState<IncomeField[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)

    // New account form
    const [showNewAccountForm, setShowNewAccountForm] = useState(false)
    const [newAccount, setNewAccount] = useState({
        name: '',
        icon: '💰',
        color: 'bg-green-500',
        account_type: 'cash'
    })

    // New category form
    const [showNewCategoryForm, setShowNewCategoryForm] = useState(false)
    const [newCategory, setNewCategory] = useState({
        name: '',
        type: 'expense' as 'income' | 'expense',
        icon: '💰',
        color: 'bg-blue-500'
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

    useEffect(() => {
        params.then(p => {
            setClubId(p.clubId)
            fetchData(p.clubId)
        })
    }, [params])

    const fetchData = async (id: string) => {
        try {
            // Get current template and accounts
            const res = await fetch(`/api/clubs/${id}/settings/reports`)
            const data = await res.json()

            if (res.ok) {
                setAccounts(data.accounts || [])

                // Extract INCOME fields from template
                if (data.currentTemplate?.schema) {
                    const fields = data.currentTemplate.schema
                        .filter((f: any) => f.field_type === 'INCOME')
                        .map((f: any) => ({
                            metric_key: f.metric_key,
                            custom_label: f.custom_label || f.metric_key,
                            account_id: f.account_id
                        }))
                    setIncomeFields(fields)
                }
            }

            // Get categories
            const catRes = await fetch(`/api/clubs/${id}/finance/categories`)
            const catData = await catRes.json()
            if (catRes.ok) {
                setCategories(catData.categories || [])
            }

            // Get recurring payments
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
        setIncomeFields(fields =>
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
                setNewCategory({ ...newCategory, name: '', icon: '💰' })
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

            // Update account_id in schema for income fields
            const updatedSchema = data.currentTemplate.schema.map((field: any) => {
                const incomeField = incomeFields.find(f => f.metric_key === field.metric_key)
                if (incomeField) {
                    return { ...field, account_id: incomeField.account_id }
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

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <Link
                        href={`/clubs/${clubId}/finance`}
                        className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Назад к финансам
                    </Link>
                    <h1 className="text-3xl font-bold">Настройки финансов</h1>
                </div>
            </div>

            <Tabs defaultValue="categories" className="w-full">
                <TabsList>
                    <TabsTrigger value="categories">Категории</TabsTrigger>
                    <TabsTrigger value="recurring">Постоянные расходы</TabsTrigger>
                    <TabsTrigger value="accounts">Счета</TabsTrigger>
                    <TabsTrigger value="mapping">Маппинг счетов</TabsTrigger>
                </TabsList>

                {/* Categories Tab */}
                <TabsContent value="categories" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Управление категориями</CardTitle>
                                    <CardDescription>
                                        Создавайте и настраивайте категории доходов и расходов
                                    </CardDescription>
                                </div>
                                <Button onClick={() => setShowNewCategoryForm(!showNewCategoryForm)}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Новая категория
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* New Category Form */}
                            {showNewCategoryForm && (
                                <Card className="border-2 border-primary">
                                    <CardHeader>
                                        <CardTitle className="text-lg">Создать новую категорию</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <Label>Название</Label>
                                                <Input
                                                    value={newCategory.name}
                                                    onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                                                    placeholder="Например: Аренда"
                                                />
                                            </div>
                                            <div>
                                                <Label>Тип</Label>
                                                <Select
                                                    value={newCategory.type}
                                                    onValueChange={(value: 'income' | 'expense') => setNewCategory({ ...newCategory, type: value })}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="income">Доход</SelectItem>
                                                        <SelectItem value="expense">Расход</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        <div>
                                            <Label>Иконка</Label>
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {ACCOUNT_ICONS.map(icon => (
                                                    <button
                                                        key={icon}
                                                        onClick={() => setNewCategory({ ...newCategory, icon })}
                                                        className={`text-2xl p-2 rounded border-2 ${newCategory.icon === icon ? 'border-primary' : 'border-transparent'
                                                            }`}
                                                    >
                                                        {icon}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <Label>Цвет</Label>
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {ACCOUNT_COLORS.map(color => (
                                                    <button
                                                        key={color}
                                                        onClick={() => setNewCategory({ ...newCategory, color })}
                                                        className={`w-8 h-8 rounded border-2 ${color} ${newCategory.color === color ? 'border-foreground' : 'border-transparent'
                                                            }`}
                                                    />
                                                ))}
                                            </div>
                                        </div>

                                        <div className="flex gap-2 pt-2">
                                            <Button onClick={handleCreateCategory} disabled={isSaving}>
                                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Создать'}
                                            </Button>
                                            <Button variant="outline" onClick={() => setShowNewCategoryForm(false)}>
                                                Отмена
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Categories List */}
                            <div className="grid md:grid-cols-2 gap-8">
                                {/* Income Categories */}
                                <div className="space-y-4">
                                    <h3 className="font-semibold text-lg flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                        Доходы
                                    </h3>
                                    <div className="space-y-2">
                                        {categories.filter(c => c.type === 'income').map((cat) => (
                                            <div
                                                key={cat.id}
                                                className="flex items-center justify-between p-3 border rounded-lg bg-card"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                                                        style={{ backgroundColor: cat.color + '20' }}
                                                    >
                                                        {cat.icon}
                                                    </div>
                                                    <div>
                                                        <div className="font-medium">{cat.name}</div>
                                                        {cat.is_system && (
                                                            <div className="text-xs text-muted-foreground">Системная</div>
                                                        )}
                                                    </div>
                                                </div>
                                                {!cat.is_system && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleDeleteCategory(cat.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Expense Categories */}
                                <div className="space-y-4">
                                    <h3 className="font-semibold text-lg flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-red-500" />
                                        Расходы
                                    </h3>
                                    <div className="space-y-2">
                                        {categories.filter(c => c.type === 'expense').map((cat) => (
                                            <div
                                                key={cat.id}
                                                className="flex items-center justify-between p-3 border rounded-lg bg-card"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                                                        style={{ backgroundColor: cat.color + '20' }}
                                                    >
                                                        {cat.icon}
                                                    </div>
                                                    <div>
                                                        <div className="font-medium">{cat.name}</div>
                                                        {cat.is_system && (
                                                            <div className="text-xs text-muted-foreground">Системная</div>
                                                        )}
                                                    </div>
                                                </div>
                                                {!cat.is_system && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleDeleteCategory(cat.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Recurring Payments Tab */}
                <TabsContent value="recurring" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Постоянные расходы и коммуналка</CardTitle>
                                    <CardDescription>
                                        Настройте регулярные платежи. Они будут появляться в дашборде как "Счета к оплате".
                                    </CardDescription>
                                </div>
                                <Button onClick={() => setShowNewRecurringForm(!showNewRecurringForm)}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Создать правило
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {showNewRecurringForm && (
                                <Card className="border-2 border-primary">
                                    <CardHeader>
                                        <CardTitle className="text-lg">Новое правило оплаты</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Название (что платим?)</Label>
                                                <Input
                                                    value={newRecurring.name}
                                                    onChange={(e) => setNewRecurring({ ...newRecurring, name: e.target.value })}
                                                    placeholder="Например: Аренда за Октябрь"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Категория</Label>
                                                <Select
                                                    value={newRecurring.category_id}
                                                    onValueChange={(value) => setNewRecurring({ ...newRecurring, category_id: value })}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Выберите категорию" />
                                                    </SelectTrigger>
                                                    <SelectContent>
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

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>День оплаты (число месяца)</Label>
                                                <Input
                                                    type="number"
                                                    min="1"
                                                    max="31"
                                                    value={newRecurring.day_of_month}
                                                    onChange={(e) => setNewRecurring({ ...newRecurring, day_of_month: parseInt(e.target.value) || 1 })}
                                                />
                                            </div>
                                        </div>

                                        <div className="p-4 bg-muted/50 rounded-lg space-y-4">
                                            <div className="flex items-center space-x-2">
                                                <input
                                                    type="checkbox"
                                                    id="is_consumption"
                                                    className="w-4 h-4 rounded border-gray-300"
                                                    checked={newRecurring.is_consumption_based}
                                                    onChange={(e) => setNewRecurring({ ...newRecurring, is_consumption_based: e.target.checked })}
                                                />
                                                <Label htmlFor="is_consumption" className="cursor-pointer font-medium">Это коммунальный платеж (по счетчикам)?</Label>
                                            </div>

                                            {newRecurring.is_consumption_based ? (
                                                <div className="grid grid-cols-2 gap-4 pl-6">
                                                    <div className="space-y-2">
                                                        <Label>Единица измерения</Label>
                                                        <Input
                                                            value={newRecurring.consumption_unit}
                                                            onChange={(e) => setNewRecurring({ ...newRecurring, consumption_unit: e.target.value })}
                                                            placeholder="кВт, м3..."
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Цена за единицу</Label>
                                                        <Input
                                                            type="number"
                                                            value={newRecurring.unit_price}
                                                            onChange={(e) => setNewRecurring({ ...newRecurring, unit_price: parseFloat(e.target.value) || 0 })}
                                                            placeholder="0.00"
                                                        />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="pl-6 space-y-2">
                                                    <Label>Сумма платежа (фиксированная)</Label>
                                                    <Input
                                                        type="number"
                                                        value={newRecurring.amount}
                                                        onChange={(e) => setNewRecurring({ ...newRecurring, amount: parseFloat(e.target.value) || 0 })}
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex gap-2 pt-2">
                                            <Button onClick={handleCreateRecurring} disabled={isSaving}>
                                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Создать правило'}
                                            </Button>
                                            <Button variant="outline" onClick={() => setShowNewRecurringForm(false)}>
                                                Отмена
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            <div className="grid gap-4 md:grid-cols-2">
                                {recurringPayments.map((rp) => (
                                    <div key={rp.id} className="border p-4 rounded-lg bg-card flex items-start justify-between">
                                        <div className="flex items-start gap-4">
                                            <div
                                                className="w-10 h-10 rounded-lg flex items-center justify-center text-xl mt-1"
                                                style={{ backgroundColor: (rp.category_color || '#3b82f6') + '20' }}
                                            >
                                                {rp.category_icon || '📅'}
                                            </div>
                                            <div>
                                                <div className="font-semibold text-lg">{rp.name}</div>
                                                <div className="text-sm text-muted-foreground mb-2">
                                                    Категория: {rp.category_name} • {rp.day_of_month}-го числа
                                                </div>

                                                {rp.is_consumption_based ? (
                                                    <div className="inline-flex items-center px-2 py-1 rounded bg-blue-100 text-blue-800 text-xs font-medium">
                                                        Счетчик: {rp.consumption_unit} (по {rp.default_unit_price} ₽)
                                                    </div>
                                                ) : (
                                                    <div className="font-bold text-lg">
                                                        {rp.amount?.toLocaleString()} ₽
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDeleteRecurring(rp.id)}
                                        >
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Accounts Tab */}
                <TabsContent value="accounts" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Управление счетами</CardTitle>
                                    <CardDescription>
                                        Создавайте и управляйте счетами для учёта денег
                                    </CardDescription>
                                </div>
                                <Button onClick={() => setShowNewAccountForm(!showNewAccountForm)}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Новый счёт
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* New Account Form */}
                            {showNewAccountForm && (
                                <Card className="border-2 border-primary">
                                    <CardHeader>
                                        <CardTitle className="text-lg">Создать новый счёт</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div>
                                            <Label>Название счёта</Label>
                                            <Input
                                                value={newAccount.name}
                                                onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                                                placeholder="Например: Сбербанк"
                                            />
                                        </div>

                                        <div>
                                            <Label>Тип счёта</Label>
                                            <Select
                                                value={newAccount.account_type}
                                                onValueChange={(value) => setNewAccount({ ...newAccount, account_type: value })}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {ACCOUNT_TYPES.map(type => (
                                                        <SelectItem key={type.value} value={type.value}>
                                                            {type.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div>
                                            <Label>Иконка</Label>
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {ACCOUNT_ICONS.map(icon => (
                                                    <button
                                                        key={icon}
                                                        onClick={() => setNewAccount({ ...newAccount, icon })}
                                                        className={`text-2xl p-2 rounded border-2 ${newAccount.icon === icon ? 'border-primary' : 'border-transparent'
                                                            }`}
                                                    >
                                                        {icon}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <Label>Цвет</Label>
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {ACCOUNT_COLORS.map(color => (
                                                    <button
                                                        key={color}
                                                        onClick={() => setNewAccount({ ...newAccount, color })}
                                                        className={`w-8 h-8 rounded border-2 ${color} ${newAccount.color === color ? 'border-foreground' : 'border-transparent'
                                                            }`}
                                                    />
                                                ))}
                                            </div>
                                        </div>

                                        <div className="flex gap-2 pt-2">
                                            <Button onClick={handleCreateAccount} disabled={isSaving}>
                                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Создать'}
                                            </Button>
                                            <Button variant="outline" onClick={() => setShowNewAccountForm(false)}>
                                                Отмена
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Accounts List */}
                            <div className="grid gap-4">
                                {accounts.map((account) => (
                                    <div
                                        key={account.id}
                                        className="flex items-center justify-between p-4 border rounded-lg"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`text-3xl p-3 rounded ${account.color}`}>
                                                {account.icon}
                                            </div>
                                            <div>
                                                <div className="font-medium">{account.name}</div>
                                                <div className="text-sm text-muted-foreground">
                                                    {ACCOUNT_TYPES.find(t => t.value === account.account_type)?.label}
                                                </div>
                                            </div>
                                        </div>

                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDeleteAccount(account.id)}
                                        >
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="mapping" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Маппинг полей на счета</CardTitle>
                            <CardDescription>
                                Укажите, на какой счёт зачислять деньги по каждому полю дохода из отчётов
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {incomeFields.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <p>Нет полей дохода в шаблоне отчёта</p>
                                    <Link
                                        href={`/clubs/${clubId}/settings/reports`}
                                        className="text-primary underline mt-2 inline-block"
                                    >
                                        Настроить шаблон отчёта →
                                    </Link>
                                </div>
                            ) : (
                                <>
                                    <div className="grid gap-4">
                                        {incomeFields.map((field) => (
                                            <div
                                                key={field.metric_key}
                                                className="flex items-center justify-between p-4 border rounded-lg"
                                            >
                                                <div className="flex-1">
                                                    <div className="font-medium">{field.custom_label}</div>
                                                    <div className="text-sm text-muted-foreground">
                                                        {field.metric_key}
                                                    </div>
                                                </div>

                                                <div className="w-64">
                                                    <Select
                                                        value={field.account_id?.toString() || ''}
                                                        onValueChange={(value) =>
                                                            handleAccountChange(field.metric_key, value)
                                                        }
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Выберите счёт" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {accounts.map((account) => (
                                                                <SelectItem
                                                                    key={account.id}
                                                                    value={account.id.toString()}
                                                                >
                                                                    {account.icon} {account.name}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex justify-end pt-4 border-t">
                                        <Button onClick={handleSaveMapping} disabled={isSaving}>
                                            {isSaving ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    Сохранение...
                                                </>
                                            ) : (
                                                <>
                                                    <Save className="mr-2 h-4 w-4" />
                                                    Сохранить маппинг
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
