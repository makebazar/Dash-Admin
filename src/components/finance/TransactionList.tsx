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
import { Plus, Search, Filter, TrendingUp, TrendingDown, Edit, Trash2, ChevronDown, Info } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { formatLocalDate } from "@/lib/utils"

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
    related_shift_report_id?: number
}

interface TransactionGroup {
    shift_report_id: number
    shift_date: string
    transactions: Transaction[]
    total: number
    is_expanded: boolean
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
    startDate: string
    endDate: string
    dialogOpen?: boolean
    onDialogOpenChange?: (open: boolean) => void
}

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

export default function TransactionList({
    clubId,
    startDate,
    endDate,
    dialogOpen,
    onDialogOpenChange
}: TransactionListProps) {
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [categories, setCategories] = useState<Category[]>([])
    const [accounts, setAccounts] = useState<Account[]>([])
    const [loading, setLoading] = useState(true)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
    const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set())

    // Filters
    const [searchTerm, setSearchTerm] = useState('')
    const [typeFilter, setTypeFilter] = useState<string>('all')
    const [categoryFilter, setCategoryFilter] = useState<string>('all')
    const [statusFilter, setStatusFilter] = useState<string>('all')
    const [hideImported, setHideImported] = useState(false)

    // Form state
    const [formData, setFormData] = useState({
        category_id: '',
        account_id: '',
        amount: '',
        type: 'expense' as 'income' | 'expense',
        payment_method: 'cash',
        status: 'completed',
        transaction_date: formatLocalDate(new Date()),
        description: '',
        notes: ''
    })

    useEffect(() => {
        fetchTransactions()
        fetchCategories()
        fetchAccounts()
    }, [clubId, typeFilter, categoryFilter, statusFilter, searchTerm, startDate, endDate])

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
            params.append('start_date', startDate)
            params.append('end_date', endDate)

            const res = await fetch(`/api/clubs/${clubId}/finance/transactions?${params}`)
            const data = await res.json()
            setTransactions(data.transactions || [])
        } catch (error) {
            console.error('Failed to fetch transactions:', error)
        } finally {
            setLoading(false)
        }
    }

    const isDialogControlled = dialogOpen !== undefined && !!onDialogOpenChange
    const effectiveDialogOpen = isDialogControlled ? dialogOpen : isDialogOpen
    const setDialogOpen = (open: boolean) => {
        if (isDialogControlled) {
            onDialogOpenChange?.(open)
            return
        }
        setIsDialogOpen(open)
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
                setDialogOpen(false)
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

        // Convert ISO date to YYYY-MM-DD for the date input
        const dateOnly = transaction.transaction_date.split('T')[0]

        setFormData({
            category_id: '', // Will need to map from name to ID
            amount: transaction.amount.toString(),
            type: transaction.type,
            payment_method: transaction.payment_method,
            status: transaction.status,
            transaction_date: dateOnly,
            description: transaction.description || '',
            account_id: transaction.account_id?.toString() || '',
            notes: ''
        })
        setDialogOpen(true)
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
            transaction_date: formatLocalDate(new Date()),
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

    const toggleGroup = (shiftReportId: number) => {
        setExpandedGroups(prev => {
            const next = new Set(prev)
            if (next.has(shiftReportId)) {
                next.delete(shiftReportId)
            } else {
                next.add(shiftReportId)
            }
            return next
        })
    }

    // Group transactions by shift_report_id
    const groupTransactions = (): (Transaction | TransactionGroup)[] => {
        // Filter out imported transactions if hideImported is true
        const filteredTransactions = hideImported
            ? transactions.filter(t => !t.related_shift_report_id)
            : transactions

        // Separate shift transactions from regular ones
        const shiftTransactions = filteredTransactions.filter(t => t.related_shift_report_id)
        const regularTransactions = filteredTransactions.filter(t => !t.related_shift_report_id)

        // Group shift transactions by shift_report_id
        const groupsMap = new Map<string, Transaction[]>()
        shiftTransactions.forEach(t => {
            if (t.related_shift_report_id) {
                const shiftId = String(t.related_shift_report_id)
                if (!groupsMap.has(shiftId)) {
                    groupsMap.set(shiftId, [])
                }
                groupsMap.get(shiftId)!.push(t)
            }
        })

        // Convert groups to TransactionGroup objects
        const groups: any[] = Array.from(groupsMap.entries()).map(([id, trans]) => ({
            shift_report_id: id,
            shift_date: trans[0].transaction_date,
            transactions: trans,
            total: trans.reduce((sum, t) => {
                const amount = typeof t.amount === 'string' ? parseFloat(t.amount) : t.amount
                return sum + (t.type === 'income' ? amount : -amount)
            }, 0),
            is_expanded: expandedGroups.has(id as any)
        }))

        // Sort groups by date (newest first)
        groups.sort((a, b) => new Date(b.shift_date).getTime() - new Date(a.shift_date).getTime())

        // Combine groups and regular transactions, maintaining chronological order
        const result: (Transaction | TransactionGroup)[] = [...groups, ...regularTransactions]

        return result
    }

    return (
        <div className="space-y-6">
            {/* Filters Redesign */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <div className="flex flex-wrap gap-3 items-center">
                    <div className="flex-1 min-w-[240px] relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Поиск по описанию..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white transition-colors"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger className="w-[130px] rounded-xl border-slate-200">
                                <SelectValue placeholder="Тип" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="all">Все типы</SelectItem>
                                <SelectItem value="income">Доходы</SelectItem>
                                <SelectItem value="expense">Расходы</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                            <SelectTrigger className="w-[180px] rounded-xl border-slate-200">
                                <SelectValue placeholder="Категория" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="all">Все категории</SelectItem>
                                {categories.map(cat => (
                                    <SelectItem key={cat.id} value={cat.id.toString()}>
                                        {cat.icon} {cat.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[150px] rounded-xl border-slate-200">
                                <SelectValue placeholder="Статус" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="all">Все статусы</SelectItem>
                                <SelectItem value="completed">Выполнено</SelectItem>
                                <SelectItem value="pending">Ожидает</SelectItem>
                                <SelectItem value="planned">Планово</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                    <div className="flex items-center gap-4">
                        <TooltipProvider>
                            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                                <Switch
                                    checked={hideImported}
                                    onCheckedChange={setHideImported}
                                    id="hide-imported"
                                    className="scale-75"
                                />
                                <Label htmlFor="hide-imported" className="cursor-pointer text-[11px] font-black uppercase text-slate-500 tracking-tight">
                                    Скрыть импорт смен
                                </Label>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Info className="h-3 w-3 text-slate-300 cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-[200px]">
                                        Выручка смен попадает сюда автоматически. Включите этот фильтр, чтобы видеть только ручные операции.
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                        </TooltipProvider>
                    </div>

                    <Button 
                        onClick={() => { resetForm(); setDialogOpen(true); }}
                        className="rounded-xl font-bold text-xs px-6 h-9 shadow-sm shadow-primary/10"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Добавить операцию
                    </Button>
                </div>
            </div>

            {/* List View */}
            <div className="space-y-3">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 space-y-4">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
                        <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Загрузка данных...</p>
                    </div>
                ) : transactions.length === 0 ? (
                    <div className="bg-white border border-dashed rounded-3xl py-20 flex flex-col items-center justify-center text-slate-400">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-2xl">🔍</div>
                        <p className="font-bold text-sm">Операции не найдены</p>
                        <p className="text-xs">Попробуйте изменить параметры фильтрации</p>
                    </div>
                ) : (
                    <div className="grid gap-3">
                        {groupTransactions().map((item) => {
                            if ('shift_report_id' in item) {
                                const group = item as TransactionGroup
                                return (
                                    <div key={`group-${group.shift_report_id}`} className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden transition-all hover:shadow-md">
                                        <div
                                            className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50/50 transition-colors"
                                            onClick={() => toggleGroup(group.shift_report_id)}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-2xl flex items-center justify-center shadow-inner">
                                                    🕒
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-black text-slate-900">Импорт выручки</span>
                                                        <span className="text-[10px] font-black uppercase bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">Отчет смены</span>
                                                    </div>
                                                    <div className="text-[11px] font-bold text-slate-400 uppercase mt-0.5">
                                                        {new Date(group.shift_date).toLocaleDateString('ru-RU', {day: 'numeric', month: 'long', year: 'numeric'})} • {group.transactions.length} поз.
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-6">
                                                <div className="text-right">
                                                    <div className={`text-lg font-black ${group.total >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                        {group.total >= 0 ? '+' : ''}{formatCurrency(group.total)}
                                                    </div>
                                                    <div className="text-[10px] font-black text-slate-400 uppercase">Суммарно за смену</div>
                                                </div>
                                                <div className={`w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center transition-transform ${group.is_expanded ? 'rotate-180 bg-slate-100' : ''}`}>
                                                    <ChevronDown className="h-4 w-4 text-slate-400" />
                                                </div>
                                            </div>
                                        </div>

                                        {group.is_expanded && (
                                            <div className="bg-slate-50/30 border-t border-slate-100 p-4 pt-2 space-y-2">
                                                {group.transactions.map((transaction) => {
                                                    const isInc = transaction.type === 'income'
                                                    return (
                                                        <div key={transaction.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl group/item">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-sm shadow-inner">
                                                                    {transaction.account_name?.includes('Касса') ? '💵' : '💳'}
                                                                </div>
                                                                <div>
                                                                    <div className="text-xs font-bold text-slate-700">{transaction.description || transaction.payment_method}</div>
                                                                    <div className="text-[10px] font-bold text-slate-400 uppercase">{transaction.account_name}</div>
                                                                </div>
                                                            </div>
                                                            <div className={`text-sm font-black ${transaction.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                                {transaction.type === 'income' ? '+' : '-'}{formatCurrency(Math.abs(transaction.amount))}
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )
                            } else {
                                const transaction = item as Transaction
                                const isIncome = transaction.type === 'income'
                                return (
                                    <div key={transaction.id} className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4 flex items-center justify-between transition-all hover:shadow-md hover:border-primary/10 group">
                                        <div className="flex items-center gap-4">
                                            <div
                                                className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-inner transition-transform group-hover:scale-105"
                                                style={{ backgroundColor: resolveColor(transaction.category_color) + '15' }}
                                            >
                                                {transaction.category_icon}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-black text-slate-900">{transaction.category_name}</span>
                                                    <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded ${
                                                        transaction.status === 'completed' ? 'bg-emerald-100 text-emerald-600' :
                                                        transaction.status === 'pending' ? 'bg-amber-100 text-amber-600' :
                                                        'bg-slate-100 text-slate-500'
                                                    }`}>
                                                        {transaction.status === 'completed' ? 'Оплачено' : 
                                                         transaction.status === 'pending' ? 'Ожидание' : 'Планово'}
                                                    </span>
                                                </div>
                                                <div className="text-[11px] font-bold text-slate-400 uppercase mt-0.5 flex items-center gap-2">
                                                    <span>{new Date(transaction.transaction_date).toLocaleDateString('ru-RU')}</span>
                                                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                                                    <span>{transaction.account_name || getPaymentMethodLabel(transaction.payment_method)}</span>
                                                    {transaction.description && (
                                                        <>
                                                            <span className="w-1 h-1 rounded-full bg-slate-300" />
                                                            <span className="normal-case text-slate-500 italic max-w-[200px] truncate">{transaction.description}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-6">
                                            <div className="text-right">
                                                <div className={`text-lg font-black ${isIncome ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                    {isIncome ? '+' : '-'}{formatCurrency(Math.abs(transaction.amount))}
                                                </div>
                                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                                                    {transaction.created_by_name}
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" onClick={() => handleEdit(transaction)} className="h-8 w-8 rounded-lg hover:bg-slate-100 hover:text-primary">
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleDelete(transaction.id)} className="h-8 w-8 rounded-lg hover:bg-rose-50 hover:text-rose-600">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            }
                        })}
                    </div>
                )}
            </div>

            {/* Add/Edit Dialog */}
            <Dialog open={effectiveDialogOpen} onOpenChange={setDialogOpen}>
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
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Тип операции</Label>
                            <Select
                                value={formData.type}
                                onValueChange={(value: 'income' | 'expense') =>
                                    setFormData({ ...formData, type: value })
                                }
                            >
                                <SelectTrigger className="rounded-xl h-11">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    <SelectItem value="income">💰 Доход (Поступление денег)</SelectItem>
                                    <SelectItem value="expense">💸 Расход (Выплата/Трата)</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-[10px] text-slate-400 ml-1">Выберите «Доход», если деньги пришли, или «Расход», если вы их потратили.</p>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Категория</Label>
                            <Select
                                value={formData.category_id}
                                onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                            >
                                <SelectTrigger className="rounded-xl h-11">
                                    <SelectValue placeholder="Выберите категорию" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    {categories
                                        .filter(cat => cat.type === formData.type)
                                        .map(cat => (
                                            <SelectItem key={cat.id} value={cat.id.toString()}>
                                                {cat.icon} {cat.name}
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                            <p className="text-[10px] text-slate-400 ml-1">Нужна для отчетов. Если подходящей нет — добавьте её в настройках.</p>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Сумма</Label>
                            <div className="relative">
                                <Input
                                    type="number"
                                    placeholder="0.00"
                                    value={formData.amount}
                                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                    required
                                    className="rounded-xl h-11 pr-8 font-bold"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₽</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Дата</Label>
                                <Input
                                    type="date"
                                    value={formData.transaction_date}
                                    onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                                    required
                                    className="rounded-xl h-11"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Счёт</Label>
                                <Select
                                    value={formData.account_id}
                                    onValueChange={(value) => setFormData({ ...formData, account_id: value })}
                                >
                                    <SelectTrigger className="rounded-xl h-11">
                                        <SelectValue placeholder="Откуда/Куда?" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        {accounts.map(acc => (
                                            <SelectItem key={acc.id} value={acc.id.toString()}>
                                                {acc.icon} {acc.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Описание (необязательно)</Label>
                            <Textarea
                                placeholder="Например: Закупка хозтоваров для админов"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                rows={2}
                                className="rounded-xl border-slate-200 resize-none"
                            />
                        </div>

                        <DialogFooter className="pt-2">
                            <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)} className="rounded-xl font-bold text-slate-500">
                                Отмена
                            </Button>
                            <Button type="submit" className="rounded-xl font-black px-8">
                                {editingTransaction ? 'Сохранить изменения' : 'Создать операцию'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
