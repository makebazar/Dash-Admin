"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Zap, Calendar, DollarSign } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

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
    account_id?: number
}

interface Account {
    id: number
    name: string
    type: string
}

interface PaymentModalProps {
    isOpen: boolean
    onClose: () => void
    payment: RecurringPayment | null
    accounts: Account[]
    onConfirm: (data: { amount: number, date: string, notes: string, accountId: number }) => Promise<void>
}

export function PaymentModal({ isOpen, onClose, payment, accounts, onConfirm }: PaymentModalProps) {
    const [amount, setAmount] = useState<string>("")
    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0])
    const [consumption, setConsumption] = useState<string>("")
    const [unitPrice, setUnitPrice] = useState<string>("")
    const [selectedAccountId, setSelectedAccountId] = useState<string>("")
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (payment && isOpen) {
            setDate(new Date().toISOString().split('T')[0])
            // Default to payment's account if set, otherwise first available account
            const defaultAccount = payment.account_id ? payment.account_id.toString() : (accounts.length > 0 ? accounts[0].id.toString() : "")
            setSelectedAccountId(defaultAccount)

            if (payment.is_consumption_based) {
                setConsumption("")
                setUnitPrice(payment.default_unit_price?.toString() || "0")
                setAmount("0")
            } else {
                setAmount(payment.amount.toString())
                setConsumption("")
                setUnitPrice("")
            }
        }
    }, [payment, isOpen, accounts])

    useEffect(() => {
        if (payment?.is_consumption_based && consumption && unitPrice) {
            const val = parseFloat(consumption)
            const price = parseFloat(unitPrice)
            if (!isNaN(val) && !isNaN(price)) {
                setAmount((val * price).toFixed(2))
            }
        }
    }, [consumption, unitPrice, payment])

    const handleConfirm = async () => {
        if (!payment || !selectedAccountId) return

        setLoading(true)
        try {
            const finalAmount = parseFloat(amount)
            let notes = ""

            if (payment.is_consumption_based) {
                notes = `${payment.name}: ${consumption} ${payment.consumption_unit} x ${unitPrice}₽ [Recurring:${payment.id}]`
            } else {
                notes = `Авто-платеж: ${payment.name} [Recurring:${payment.id}]`
            }

            await onConfirm({
                amount: finalAmount,
                date: date,
                notes: notes,
                accountId: parseInt(selectedAccountId)
            })
            onClose()
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    if (!payment) return null

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <span>{payment.category_icon || '💰'}</span>
                        Оплата: {payment.name}
                    </DialogTitle>
                    <DialogDescription>
                        {payment.is_consumption_based
                            ? "Введите показания счетчика для расчета суммы."
                            : "Подтвердите сумму, дату и счет списания."}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    {/* Account Selection */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="account" className="text-right">
                            Счет
                        </Label>
                        <div className="col-span-3">
                            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Выберите счет" />
                                </SelectTrigger>
                                <SelectContent>
                                    {accounts.map(acc => (
                                        <SelectItem key={acc.id} value={acc.id.toString()}>
                                            {acc.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Date Selection */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="date" className="text-right">
                            Дата
                        </Label>
                        <div className="col-span-3 relative">
                            <Input
                                id="date"
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="pl-9"
                            />
                            <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        </div>
                    </div>

                    {/* Consumption Fields */}
                    {payment.is_consumption_based && (
                        <>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="consumption" className="text-right">
                                    Расход ({payment.consumption_unit})
                                </Label>
                                <Input
                                    id="consumption"
                                    type="number"
                                    value={consumption}
                                    onChange={(e) => setConsumption(e.target.value)}
                                    placeholder="0"
                                    className="col-span-3"
                                    autoFocus
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="price" className="text-right">
                                    Цена за ед.
                                </Label>
                                <Input
                                    id="price"
                                    type="number"
                                    value={unitPrice}
                                    onChange={(e) => setUnitPrice(e.target.value)}
                                    className="col-span-3"
                                />
                            </div>
                        </>
                    )}

                    {/* Amount Field */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="amount" className="text-right font-bold">
                            Сумма (₽)
                        </Label>
                        <div className="col-span-3 relative">
                            <Input
                                id="amount"
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="pl-9 font-bold"
                            />
                            <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={loading}>
                        Отмена
                    </Button>
                    <Button onClick={handleConfirm} disabled={loading || !amount || parseFloat(amount) <= 0 || !selectedAccountId}>
                        {loading ? "Обработка..." : `Оплатить ${amount} ₽`}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
