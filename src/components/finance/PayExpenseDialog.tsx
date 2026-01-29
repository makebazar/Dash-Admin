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
        description: ''
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
                    description: `Оплата: ${expense.name}`
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

                <form onSubmit={handleSubmit} className="space-y-4 py-4">
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
