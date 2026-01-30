"use client"

import { useState, useEffect } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
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
import { Textarea } from "@/components/ui/textarea"

interface Account {
    id: number
    name: string
    icon: string
    color: string
}

interface PayExpenseDialogProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    expense: {
        id: number
        name: string
        amount: number
        amount_paid: number
        description?: string
        is_consumption_based?: boolean
        consumption_unit?: string
        consumption_value?: number
        unit_price?: number
    } | null
    clubId: string
    onSuccess: () => void
}

export default function PayExpenseDialog({
    isOpen,
    onOpenChange,
    expense,
    clubId,
    onSuccess
}: PayExpenseDialogProps) {
    const [accounts, setAccounts] = useState<Account[]>([])
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        amount: '',
        account_id: '',
        payment_date: new Date().toISOString().split('T')[0],
        description: '',
        consumption_value: '',
        unit_price: ''
    })

    useEffect(() => {
        if (isOpen) {
            fetchAccounts()
            if (expense) {
                const remaining = expense.amount - expense.amount_paid
                setFormData({
                    amount: remaining.toString(),
                    account_id: '',
                    payment_date: new Date().toISOString().split('T')[0],
                    description: `Оплата: ${expense.name}`,
                    consumption_value: expense.consumption_value?.toString() || '',
                    unit_price: expense.unit_price?.toString() || ''
                })
            }
        }
    }, [isOpen, expense])

    const fetchAccounts = async () => {
        try {
            const res = await fetch(`/api/clubs/${clubId}/finance/accounts`)
            const data = await res.json()
            setAccounts(data.accounts || [])

            // Set first account as default if none selected
            if (data.accounts?.length > 0 && !formData.account_id) {
                setFormData(prev => ({ ...prev, account_id: data.accounts[0].id.toString() }))
            }
        } catch (error) {
            console.error('Failed to fetch accounts:', error)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!expense) return

        setLoading(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/finance/scheduled/${expense.id}/pay`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    amount: parseFloat(formData.amount)
                })
            })

            if (res.ok) {
                onOpenChange(false)
                onSuccess()
            } else {
                const data = await res.json()
                alert(`Ошибка: ${data.error}`)
            }
        } catch (error) {
            console.error('Failed to record payment:', error)
            alert('Не удалось зафиксировать оплату')
        } finally {
            setLoading(false)
        }
    }

    const calculateAmount = () => {
        if (expense?.is_consumption_based) {
            const consumption = parseFloat(formData.consumption_value) || 0
            const price = parseFloat(formData.unit_price) || 0
            return (consumption * price).toFixed(2)
        }
        return formData.amount
    }

    const handleUpdateExpense = async (updateData: any) => {
        try {
            await fetch(`/api/clubs/${clubId}/finance/scheduled/${expense?.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            })
        } catch (error) {
            console.error('Failed to update expense:', error)
        }
    }

    const handlePaySubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!expense) return

        const finalAmount = expense.is_consumption_based
            ? parseFloat(calculateAmount())
            : parseFloat(formData.amount)

        setLoading(true)
        try {
            // 1. If consumption based, update the expense with actual data first
            if (expense.is_consumption_based) {
                const updateRes = await fetch(`/api/clubs/${clubId}/finance/scheduled/${expense.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        consumption_value: parseFloat(formData.consumption_value),
                        unit_price: parseFloat(formData.unit_price),
                        amount: finalAmount
                    })
                })
                if (!updateRes.ok) throw new Error('Failed to update consumption data')
            }

            // 2. Process the payment
            const res = await fetch(`/api/clubs/${clubId}/finance/scheduled/${expense.id}/pay`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: finalAmount,
                    account_id: formData.account_id,
                    payment_date: formData.payment_date,
                    description: formData.description
                })
            })

            if (res.ok) {
                onOpenChange(false)
                onSuccess()
            } else {
                const data = await res.json()
                alert(`Ошибка: ${data.error}`)
            }
        } catch (error: any) {
            console.error('Failed to process payment:', error)
            alert(error.message || 'Не удалось зафиксировать оплату')
        } finally {
            setLoading(false)
        }
    }

    if (!expense) return null

    const remaining = expense.amount - expense.amount_paid

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Оплата расхода</DialogTitle>
                    <DialogDescription>
                        {expense.name} (Осталось оплатить: {new Intl.NumberFormat('ru-RU').format(remaining)} ₽)
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handlePaySubmit} className="space-y-4 py-4">
                    {expense.is_consumption_based && (
                        <div className="grid grid-cols-2 gap-4 p-3 bg-amber-50 rounded-lg border border-amber-100">
                            <div className="space-y-2">
                                <Label className="text-xs">Потребление ({expense.consumption_unit})</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.consumption_value}
                                    onChange={(e) => setFormData({ ...formData, consumption_value: e.target.value })}
                                    required
                                    className="h-8"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs">Цена за единицу</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.unit_price}
                                    onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                                    required
                                    className="h-8"
                                />
                            </div>
                            <div className="col-span-2 pt-1 border-t border-amber-100">
                                <p className="text-xs font-bold text-amber-800">
                                    Итого к оплате: {new Intl.NumberFormat('ru-RU').format(calculateAmount() as any)} ₽
                                </p>
                            </div>
                        </div>
                    )}

                    {!expense.is_consumption_based && (
                        <div className="space-y-2">
                            <Label htmlFor="amount">Сумма оплаты</Label>
                            <Input
                                id="amount"
                                type="number"
                                step="0.01"
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                required
                            />
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="account">Счёт списания</Label>
                        <Select
                            value={formData.account_id}
                            onValueChange={(value) => setFormData({ ...formData, account_id: value })}
                        >
                            <SelectTrigger id="account">
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

                    <div className="space-y-2">
                        <Label htmlFor="date">Дата оплаты</Label>
                        <Input
                            id="date"
                            type="date"
                            value={formData.payment_date}
                            onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Комментарий</Label>
                        <Textarea
                            id="description"
                            placeholder="Например: Аванс за февраль"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={2}
                        />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Отмена
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? 'Обработка...' : 'Подтвердить оплату'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
