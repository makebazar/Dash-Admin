"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Repeat, Clock, ToggleLeft, ToggleRight, Edit, Trash2, Zap } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"

interface RecurringPayment {
    id: number
    name: string
    category_name: string
    category_icon: string
    category_color: string
    amount: number
    type: 'income' | 'expense'
    frequency: string
    interval: number
    day_of_month: number | null
    next_generation_date: string | null
    is_active: boolean
    start_date: string
    end_date: string | null
    description: string
    account_id?: number
    account_name?: string
    is_consumption_based: boolean
    consumption_unit: string | null
    default_unit_price: number | null
}

interface Category {
    id: number
    name: string
    type: 'income' | 'expense'
    icon: string
    color: string
}

interface Account {
    id: number
    name: string
    icon: string
    color: string
}

interface RecurringPaymentsProps {
    clubId: string
}

export default function RecurringPayments({ clubId }: RecurringPaymentsProps) {
    const [payments, setPayments] = useState<RecurringPayment[]>([])
    const [categories, setCategories] = useState<Category[]>([])
    const [accounts, setAccounts] = useState<Account[]>([])
    const [loading, setLoading] = useState(true)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingPayment, setEditingPayment] = useState<RecurringPayment | null>(null)
    const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false)
    const [generatingPayment, setGeneratingPayment] = useState<RecurringPayment | null>(null)
    const [generateFormData, setGenerateFormData] = useState({
        amount: '',
        status: 'completed' as 'completed' | 'pending',
        payment_date: new Date().toISOString().split('T')[0]
    })

    const [formData, setFormData] = useState({
        category_id: '',
        account_id: '',
        name: '',
        amount: '',
        type: 'expense' as 'income' | 'expense',
        frequency: 'monthly',
        interval: '1',
        day_of_month: '',
        payment_method: 'cash',
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        description: '',
        is_consumption_based: false,
        consumption_unit: 'кВт',
        default_unit_price: ''
    })

    useEffect(() => {
        fetchPayments()
        fetchCategories()
        fetchAccounts()
    }, [clubId])

    const fetchAccounts = async () => {
        try {
            const res = await fetch(`/api/clubs/${clubId}/finance/accounts`)
            const data = await res.json()
            setAccounts(data.accounts || [])
        } catch (error) {
            console.error('Failed to fetch accounts:', error)
        }
    }

    const fetchCategories = async () => {
        try {
            const res = await fetch(`/api/clubs/${clubId}/finance/categories`)
            const data = await res.json()
            setCategories(data.categories || [])
        } catch (error) {
            console.error('Failed to fetch categories:', error)
        }
    }

    const fetchPayments = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/finance/recurring`)
            const data = await res.json()
            setPayments(data.recurring_payments || [])
        } catch (error) {
            console.error('Failed to fetch recurring payments:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        try {
            const url = `/api/clubs/${clubId}/finance/recurring`
            const method = editingPayment ? 'PUT' : 'POST'
            const body = editingPayment
                ? { ...formData, id: editingPayment.id }
                : formData

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })

            if (res.ok) {
                setIsDialogOpen(false)
                resetForm()
                fetchPayments()
            }
        } catch (error) {
            console.error('Failed to save recurring payment:', error)
        }
    }

    const handleToggleActive = async (payment: RecurringPayment) => {
        try {
            const res = await fetch(`/api/clubs/${clubId}/finance/recurring`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: payment.id,
                    is_active: !payment.is_active
                })
            })
            if (res.ok) {
                fetchPayments()
            }
        } catch (error) {
            console.error('Failed to toggle payment:', error)
        }
    }

    const handleDelete = async (id: number) => {
        if (!confirm('Удалить этот повторяющийся платёж?')) return

        try {
            const res = await fetch(`/api/clubs/${clubId}/finance/recurring?id=${id}`, {
                method: 'DELETE'
            })
            if (res.ok) {
                fetchPayments()
            }
        } catch (error) {
            console.error('Failed to delete payment:', error)
        }
    }

    const handleGenerateTransaction = (payment: RecurringPayment) => {
        setGeneratingPayment(payment)
        setGenerateFormData({
            amount: payment.amount.toString(),
            status: 'completed',
            payment_date: new Date().toISOString().split('T')[0]
        })
        setIsGenerateDialogOpen(true)
    }

    const confirmGenerateTransaction = async () => {
        if (!generatingPayment) return

        const now = new Date()
        const month = now.getMonth() + 1 // 1-12
        const year = now.getFullYear()

        try {
            const res = await fetch(`/api/clubs/${clubId}/finance/recurring/${generatingPayment.id}/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    target_month: month,
                    target_year: year,
                    custom_amount: parseFloat(generateFormData.amount),
                    status: generateFormData.status,
                    payment_date: generateFormData.payment_date
                })
            })

            const data = await res.json()

            if (res.ok) {
                alert(`✅ Платёж запланирован: ${generatingPayment.name}. Оплатить его можно на вкладке "Расходы" или на Dashboard.`)
                setIsGenerateDialogOpen(false)
                fetchPayments()
            } else if (res.status === 409) {
                alert('⚠️ Платёж для этого месяца уже запланирован')
            } else {
                alert(`❌ Ошибка: ${data.error}`)
            }
        } catch (error) {
            console.error('Failed to generate transaction:', error)
            alert('❌ Не удалось создать транзакцию')
        }
    }

    const resetForm = () => {
        setEditingPayment(null)
        setFormData({
            category_id: '',
            account_id: '',
            name: '',
            amount: '',
            type: 'expense',
            frequency: 'monthly',
            interval: '1',
            day_of_month: '',
            payment_method: 'cash',
            start_date: new Date().toISOString().split('T')[0],
            end_date: '',
            description: '',
            is_consumption_based: false,
            consumption_unit: 'кВт',
            default_unit_price: ''
        })
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('ru-RU', {
            maximumFractionDigits: 0
        }).format(amount) + ' ₽'
    }

    const getFrequencyLabel = (frequency: string, interval: number) => {
        const labels: Record<string, string> = {
            daily: interval > 1 ? `Каждые ${interval} дней` : 'Ежедневно',
            weekly: interval > 1 ? `Каждые ${interval} недель` : 'Еженедельно',
            monthly: interval > 1 ? `Каждые ${interval} месяцев` : 'Ежемесячно',
            yearly: interval > 1 ? `Каждые ${interval} лет` : 'Ежегодно'
        }
        return labels[frequency] || frequency
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-semibold">Повторяющиеся платежи</h3>
                    <p className="text-sm text-muted-foreground">
                        Автоматизация регулярных расходов и доходов
                    </p>
                </div>
                <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Добавить
                </Button>
            </div>

            {/* Payments List */}
            <div className="grid gap-4 md:grid-cols-2">
                {loading ? (
                    <div className="col-span-2 text-center py-8 text-muted-foreground">
                        Загрузка...
                    </div>
                ) : payments.length === 0 ? (
                    <div className="col-span-2 text-center py-8 text-muted-foreground">
                        <Repeat className="h-12 w-12 mx-auto mb-2 opacity-20" />
                        <p>Нет повторяющихся платежей</p>
                        <p className="text-xs mt-1">Создайте шаблон для автоматизации</p>
                    </div>
                ) : (
                    payments.map((payment) => (
                        <Card key={payment.id} className={!payment.is_active ? 'opacity-60' : ''}>
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-10 h-10 rounded-lg flex items-center justify-center text-2xl"
                                            style={{ backgroundColor: payment.category_color + '20' }}
                                        >
                                            {payment.category_icon}
                                        </div>
                                        <div>
                                            <CardTitle className="text-base">{payment.name}</CardTitle>
                                            <CardDescription className="text-xs">
                                                {payment.category_name}
                                                {payment.is_consumption_based && (
                                                    <Badge variant="secondary" className="ml-2 text-[10px] h-4">
                                                        Учет потребления
                                                    </Badge>
                                                )}
                                            </CardDescription>
                                        </div>
                                    </div>
                                    <Switch
                                        checked={payment.is_active}
                                        onCheckedChange={() => handleToggleActive(payment)}
                                    />
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span
                                        className={`text-2xl font-bold ${payment.type === 'income' ? 'text-emerald-600' : 'text-red-600'
                                            }`}
                                    >
                                        {payment.type === 'income' ? '+' : '-'}
                                        {payment.is_consumption_based ? (
                                            <span className="text-lg">ЦЕНА: {formatCurrency(payment.default_unit_price || 0)} / {payment.consumption_unit}</span>
                                        ) : (
                                            formatCurrency(payment.amount)
                                        )}
                                    </span>
                                    <Badge variant="outline">
                                        <Repeat className="h-3 w-3 mr-1" />
                                        {getFrequencyLabel(payment.frequency, payment.interval)}
                                    </Badge>
                                </div>

                                {payment.day_of_month && (
                                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                                        <Clock className="h-4 w-4" />
                                        <span>Каждое {payment.day_of_month} число месяца</span>
                                    </div>
                                )}

                                {payment.next_generation_date && payment.is_active && (
                                    <div className="text-xs text-muted-foreground">
                                        Следующий платеж: {new Date(payment.next_generation_date).toLocaleDateString('ru-RU')}
                                    </div>
                                )}

                                {payment.description && (
                                    <p className="text-sm text-muted-foreground italic">
                                        {payment.description}
                                    </p>
                                )}

                                <div className="flex flex-col gap-2 pt-2">
                                    {payment.is_active && (
                                        <Button
                                            variant="default"
                                            size="sm"
                                            className="w-full"
                                            onClick={() => handleGenerateTransaction(payment)}
                                        >
                                            <Zap className="h-4 w-4 mr-2" />
                                            Выставить на текущий месяц
                                        </Button>
                                    )}
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex-1"
                                            onClick={() => {
                                                setEditingPayment(payment)
                                                setFormData({
                                                    category_id: '',
                                                    account_id: payment.account_id?.toString() || '',
                                                    name: payment.name,
                                                    amount: payment.amount.toString(),
                                                    type: payment.type,
                                                    frequency: payment.frequency,
                                                    interval: payment.interval.toString(),
                                                    day_of_month: payment.day_of_month?.toString() || '',
                                                    payment_method: 'cash',
                                                    start_date: payment.start_date,
                                                    end_date: payment.end_date || '',
                                                    description: payment.description || '',
                                                    is_consumption_based: payment.is_consumption_based,
                                                    consumption_unit: payment.consumption_unit || 'кВт',
                                                    default_unit_price: payment.default_unit_price?.toString() || ''
                                                })
                                                setIsDialogOpen(true)
                                            }}
                                        >
                                            <Edit className="h-4 w-4 mr-1" />
                                            Изменить
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleDelete(payment.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            {/* Add/Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {editingPayment ? 'Редактировать платеж' : 'Новый повторяющийся платеж'}
                        </DialogTitle>
                        <DialogDescription>
                            Настройте автоматический шаблон платежа
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <Label>Название</Label>
                            <Input
                                placeholder="Например: Аренда помещения"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                            />
                        </div>

                        <div>
                            <Label>Тип</Label>
                            <Select
                                value={formData.type}
                                onValueChange={(value: 'income' | 'expense') =>
                                    setFormData({ ...formData, type: value })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="income">💰 Доход</SelectItem>
                                    <SelectItem value="expense">💸 Расход</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Category selection */}
                        <div>
                            <Label>Категория</Label>
                            <Select
                                value={formData.category_id}
                                onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Выберите категорию" />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories
                                        .filter(cat => cat.type === formData.type)
                                        .map(cat => (
                                            <SelectItem key={cat.id} value={cat.id.toString()}>
                                                {cat.icon} {cat.name}
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Conditional Consumption Mode for Utility/Communal categories */}
                        {(() => {
                            const selectedCategory = categories.find(c => c.id.toString() === formData.category_id);
                            const isCommunal = selectedCategory?.name.toLowerCase().includes('коммунальн') ||
                                selectedCategory?.name.toLowerCase().includes('жкх');

                            if (!isCommunal && !formData.is_consumption_based) return null;

                            return (
                                <div className="space-y-3 p-3 bg-muted/50 rounded-lg border border-dashed">
                                    <div className="flex items-center justify-between">
                                        <Label className="flex items-center gap-2 cursor-pointer">
                                            <Zap className="h-4 w-4 text-amber-500" />
                                            Режим потребления
                                        </Label>
                                        <Switch
                                            checked={formData.is_consumption_based}
                                            onCheckedChange={(checked) => setFormData({ ...formData, is_consumption_based: checked })}
                                        />
                                    </div>

                                    {formData.is_consumption_based && (
                                        <div className="grid grid-cols-2 gap-3 pt-1">
                                            <div className="space-y-1">
                                                <Label className="text-xs">Ед. изм.</Label>
                                                <Input
                                                    placeholder="кВт, м³, ед."
                                                    value={formData.consumption_unit}
                                                    onChange={(e) => setFormData({ ...formData, consumption_unit: e.target.value })}
                                                    className="h-8 text-xs"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">Цена за ед.</Label>
                                                <Input
                                                    type="number"
                                                    placeholder="0.00"
                                                    value={formData.default_unit_price}
                                                    onChange={(e) => setFormData({ ...formData, default_unit_price: e.target.value })}
                                                    className="h-8 text-xs"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                        {/* Amount */}
                        <div>
                            <Label>Сумма</Label>
                            <Input
                                type="number"
                                placeholder="0"
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                required={!formData.is_consumption_based}
                                disabled={formData.is_consumption_based}
                            />
                            {formData.is_consumption_based && (
                                <p className="text-[10px] text-muted-foreground mt-1">
                                    Сумма будет рассчитана автоматически на основе потребления
                                </p>
                            )}
                        </div>

                        {/* Frequency details */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Частота</Label>
                                <Select
                                    value={formData.frequency}
                                    onValueChange={(value) => setFormData({ ...formData, frequency: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="monthly">Ежемесячно</SelectItem>
                                        <SelectItem value="weekly">Еженедельно</SelectItem>
                                        <SelectItem value="yearly">Ежегодно</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {formData.frequency === 'monthly' && (
                                <div>
                                    <Label>День месяца</Label>
                                    <Input
                                        type="number"
                                        min="1"
                                        max="31"
                                        placeholder="1-31"
                                        value={formData.day_of_month}
                                        onChange={(e) => setFormData({ ...formData, day_of_month: e.target.value })}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Description */}
                        <div>
                            <Label>Описание (опционально)</Label>
                            <Textarea
                                placeholder="Дополнительная информация..."
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                rows={2}
                            />
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                                Отмена
                            </Button>
                            <Button type="submit">
                                {editingPayment ? 'Сохранить' : 'Создать'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Generate Transaction Dialog */}
            <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {generatingPayment?.type === 'expense' ? 'Запланировать расход на текущий месяц' : 'Выставить доход на текущий месяц'}
                        </DialogTitle>
                        <DialogDescription>
                            {generatingPayment && `${generatingPayment.name} - ${generatingPayment.amount} ₽`}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            {generatingPayment?.type === 'expense'
                                ? 'Будет создан запланированный расход. Оплату можно будет зафиксировать полностью или частями на вкладке "Расходы" или на Dashboard.'
                                : 'Будет создана транзакция дохода на указанную сумму.'}
                        </p>

                        <div>
                            <Label>Сумма</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={generateFormData.amount}
                                onChange={(e) => setGenerateFormData({ ...generateFormData, amount: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsGenerateDialogOpen(false)}>
                            Отмена
                        </Button>
                        <Button onClick={confirmGenerateTransaction}>
                            {generatingPayment?.type === 'expense' ? 'Запланировать' : 'Создать транзакцию'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    )
}
