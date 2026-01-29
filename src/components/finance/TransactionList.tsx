"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Plus, Search, Filter, TrendingUp, TrendingDown, Edit, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface Transaction {
    id: number
    category_name: string
    category_icon: string
    category_color: string
    amount: number
    type: 'income' | 'expense'
    payment_method: string
    status: string
    transaction_date: string
    description: string
    created_by_name: string
    account_id?: number
    account_name?: string
}

interface Account {
    id: number
    name: string
    icon: string
    color: string
}

interface Category {
    id: number
    name: string
    type: 'income' | 'expense'
    icon: string
    color: string
}

interface TransactionListProps {
    clubId: string
}

export default function TransactionList({ clubId }: TransactionListProps) {
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [categories, setCategories] = useState<Category[]>([])
    const [accounts, setAccounts] = useState<Account[]>([])
    const [loading, setLoading] = useState(true)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)

    // Filters
    const [searchTerm, setSearchTerm] = useState('')
    const [typeFilter, setTypeFilter] = useState<string>('all')
    const [categoryFilter, setCategoryFilter] = useState<string>('all')
    const [statusFilter, setStatusFilter] = useState<string>('all')

    // Form state
    const [formData, setFormData] = useState({
        category_id: '',
        account_id: '',
        amount: '',
        type: 'expense' as 'income' | 'expense',
        payment_method: 'cash',
        status: 'completed',
        transaction_date: new Date().toISOString().split('T')[0],
        description: '',
        notes: ''
    })

    useEffect(() => {
        fetchTransactions()
        fetchCategories()
        fetchAccounts()
    }, [clubId, typeFilter, categoryFilter, statusFilter, searchTerm])

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

    const fetchTransactions = async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (typeFilter !== 'all') params.append('type', typeFilter)
            if (categoryFilter !== 'all') params.append('category_id', categoryFilter)
            if (statusFilter !== 'all') params.append('status', statusFilter)
            if (searchTerm) params.append('search', searchTerm)

            const res = await fetch(`/api/clubs/${clubId}/finance/transactions?${params}`)
            const data = await res.json()
            setTransactions(data.transactions || [])
        } catch (error) {
            console.error('Failed to fetch transactions:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        try {
            const url = editingTransaction
                ? `/api/clubs/${clubId}/finance/transactions`
                : `/api/clubs/${clubId}/finance/transactions`

            const method = editingTransaction ? 'PUT' : 'POST'
            const body = editingTransaction
                ? { ...formData, id: editingTransaction.id }
                : formData

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })

            if (res.ok) {
                setIsDialogOpen(false)
                resetForm()
                fetchTransactions()
            }
        } catch (error) {
            console.error('Failed to save transaction:', error)
        }
    }

    const handleDelete = async (id: number) => {
        if (!confirm('Удалить эту транзакцию?')) return

        try {
            const res = await fetch(`/api/clubs/${clubId}/finance/transactions?id=${id}`, {
                method: 'DELETE'
            })
            if (res.ok) {
                fetchTransactions()
            }
        } catch (error) {
            console.error('Failed to delete transaction:', error)
        }
    }

    const handleEdit = (transaction: Transaction) => {
        setEditingTransaction(transaction)
        setFormData({
            category_id: '', // Will need to map from name to ID
            amount: transaction.amount.toString(),
            type: transaction.type,
            payment_method: transaction.payment_method,
            status: transaction.status,
            transaction_date: transaction.transaction_date,
            description: transaction.description || '',
            account_id: transaction.account_id?.toString() || '',
            notes: ''
        })
        setIsDialogOpen(true)
    }

    const resetForm = () => {
        setEditingTransaction(null)
        setFormData({
            category_id: '',
            account_id: '',
            amount: '',
            type: 'expense',
            payment_method: 'cash',
            status: 'completed',
            transaction_date: new Date().toISOString().split('T')[0],
            description: '',
            notes: ''
        })
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('ru-RU', {
            maximumFractionDigits: 0
        }).format(amount) + ' ₽'
    }

    const getStatusBadge = (status: string) => {
        const variants: Record<string, { label: string; variant: any }> = {
            completed: { label: 'Выполнено', variant: 'default' },
            pending: { label: 'Ожидает', variant: 'secondary' },
            planned: { label: 'Запланировано', variant: 'outline' },
            cancelled: { label: 'Отменено', variant: 'destructive' }
        }
        const config = variants[status] || variants.completed
        return <Badge variant={config.variant}>{config.label}</Badge>
    }

    const getPaymentMethodLabel = (method: string) => {
        const labels: Record<string, string> = {
            cash: 'Наличные',
            card: 'Карта',
            bank_transfer: 'Перевод',
            other: 'Другое'
        }
        return labels[method] || method
    }

    return (
        <div className="space-y-4">
            {/* Filters and Actions */}
            <div className="flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px]">
                    <Label>Поиск</Label>
                    <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Поиск по описанию..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                </div>

                <div className="w-[150px]">
                    <Label>Тип</Label>
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Все</SelectItem>
                            <SelectItem value="income">Доходы</SelectItem>
                            <SelectItem value="expense">Расходы</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="w-[180px]">
                    <Label>Категория</Label>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Все категории</SelectItem>
                            {categories.map(cat => (
                                <SelectItem key={cat.id} value={cat.id.toString()}>
                                    {cat.icon} {cat.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="w-[150px]">
                    <Label>Статус</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Все</SelectItem>
                            <SelectItem value="completed">Выполнено</SelectItem>
                            <SelectItem value="pending">Ожидает</SelectItem>
                            <SelectItem value="planned">Запланировано</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Добавить
                </Button>
            </div>

            {/* Transactions Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Список транзакций</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-8 text-muted-foreground">
                            Загрузка...
                        </div>
                    ) : transactions.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            Нет транзакций
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {transactions.map((transaction) => (
                                <div
                                    key={transaction.id}
                                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                                >
                                    <div className="flex items-center gap-4 flex-1">
                                        <div
                                            className="w-10 h-10 rounded-lg flex items-center justify-center text-2xl"
                                            style={{ backgroundColor: transaction.category_color + '20' }}
                                        >
                                            {transaction.category_icon}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">{transaction.category_name}</span>
                                                {getStatusBadge(transaction.status)}
                                            </div>
                                            <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                                                <span>{new Date(transaction.transaction_date).toLocaleDateString('ru-RU')}</span>
                                                <span>•</span>
                                                <span>{getPaymentMethodLabel(transaction.payment_method)}</span>
                                                {transaction.description && (
                                                    <>
                                                        <span>•</span>
                                                        <span>{transaction.description}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div
                                            className={`text-lg font-bold ${transaction.type === 'income' ? 'text-emerald-600' : 'text-red-600'
                                                }`}
                                        >
                                            {transaction.type === 'income' ? '+' : '-'}
                                            {formatCurrency(transaction.amount)}
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleEdit(transaction)}
                                            >
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDelete(transaction.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Add/Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {editingTransaction ? 'Редактировать транзакцию' : 'Новая транзакция'}
                        </DialogTitle>
                        <DialogDescription>
                            Заполните данные о финансовой операции
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-4">
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

                        <div>
                            <Label>Сумма</Label>
                            <Input
                                type="number"
                                placeholder="0"
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                required
                            />
                        </div>

                        <div>
                            <Label>Дата</Label>
                            <Input
                                type="date"
                                value={formData.transaction_date}
                                onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                                required
                            />
                        </div>

                        <div>
                            <Label>Счёт</Label>
                            <Select
                                value={formData.account_id}
                                onValueChange={(value) => setFormData({ ...formData, account_id: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Выберите счёт" />
                                </SelectTrigger>
                                <SelectContent>
                                    {accounts.map(acc => (
                                        <SelectItem key={acc.id} value={acc.id.toString()}>
                                            {acc.icon} {acc.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label>Способ оплаты (технический)</Label>
                            <Select
                                value={formData.payment_method}
                                onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="cash">💵 Наличные</SelectItem>
                                    <SelectItem value="card">💳 Карта</SelectItem>
                                    <SelectItem value="bank_transfer">🏦 Перевод</SelectItem>
                                    <SelectItem value="other">📝 Другое</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label>Описание</Label>
                            <Textarea
                                placeholder="Дополнительная информация..."
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                rows={3}
                            />
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                                Отмена
                            </Button>
                            <Button type="submit">
                                {editingTransaction ? 'Сохранить' : 'Создать'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
