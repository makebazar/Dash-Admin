"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog"
import { AlertTriangle, CheckCircle2, Plus, Clock } from "lucide-react"

interface RecurringPayment {
  id: number
  name: string
  amount: number
  day_of_month: number
  category_id: number
  category_name?: string
  is_consumption_based?: boolean
}

interface FinancePaymentCalendarProps {
  clubId: string
  accounts: any[]
  categories: any[]
  transactions: any[]
  selectedMonth: number
  selectedYear: number
  onRefresh: () => void
}

const formatMoney = (amount: number) => {
  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 0
  }).format(amount) + ' ₽'
}

export function FinancePaymentCalendar({
  clubId,
  accounts,
  categories,
  transactions,
  selectedMonth,
  selectedYear,
  onRefresh
}: FinancePaymentCalendarProps) {
  const [recurringPayments, setRecurringPayments] = useState<RecurringPayment[]>([])
  const [loading, setLoading] = useState(true)

  // Payment modal state
  const [selectedBill, setSelectedBill] = useState<RecurringPayment | null>(null)
  const [isPayModalOpen, setIsPayModalOpen] = useState(false)
  const [payAmount, setPayAmount] = useState("")
  const [payAccountId, setPayAccountId] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // New recurring modal state
  const [isNewRecurringOpen, setIsNewRecurringOpen] = useState(false)
  const [newBill, setNewBill] = useState({
    name: "",
    amount: "",
    day_of_month: "1",
    category_id: ""
  })

  useEffect(() => {
    if (clubId) {
      fetchRecurring()
    }
  }, [clubId])

  useEffect(() => {
    if (accounts.length > 0 && !payAccountId) {
      setPayAccountId(accounts[0].id.toString())
    }
  }, [accounts])

  const fetchRecurring = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/clubs/[clubId]/finance/recurring`.replace('[clubId]', clubId))
      if (res.ok) {
        const data = await res.json()
        setRecurringPayments(data.recurring_payments || [])
      }
    } catch (e) {
      console.error("Failed to fetch recurring payments:", e)
    } finally {
      setLoading(false)
    }
  }

  // Calculate Payment status
  const getPaymentStatus = (rpId: number, targetAmount: number) => {
    const relevantTx = transactions.filter(t =>
      t.notes && t.notes.includes(`[Recurring:${rpId}]`)
    )
    const paidAmount = relevantTx.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0)

    if (paidAmount >= targetAmount && targetAmount > 0) return { status: 'paid', paidAmount, remaining: 0 }
    if (paidAmount > 0) return { status: 'partial', paidAmount, remaining: Math.max(0, targetAmount - paidAmount) }
    return { status: 'unpaid', paidAmount: 0, remaining: targetAmount }
  }

  // Calculate Cash Gap Alert
  const totalCurrentBalance = accounts.reduce((sum, a) => sum + parseFloat(a.current_balance || 0), 0)
  const totalPlannedExpenses = recurringPayments.reduce((sum, rp) => {
    const stat = getPaymentStatus(rp.id, rp.amount)
    return sum + stat.remaining
  }, 0)

  const projectedBalance = totalCurrentBalance - totalPlannedExpenses
  const isCashGap = projectedBalance < 0

  const handleOpenPayModal = (rp: RecurringPayment, remaining: number) => {
    setSelectedBill(rp)
    setPayAmount(remaining.toString())
    setIsPayModalOpen(true)
  }

  const handleConfirmPay = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBill || !payAccountId || !payAmount) return

    setSubmitting(true)
    try {
      const res = await fetch(`/api/clubs/${clubId}/finance/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category_id: selectedBill.category_id,
          amount: parseFloat(payAmount),
          type: "expense",
          payment_method: "cash",
          status: "completed",
          transaction_date: new Date().toISOString().split('T')[0],
          description: `Оплата счета: ${selectedBill.name}`,
          notes: `[Recurring:${selectedBill.id}] Оплата регулярного счета`,
          account_id: parseInt(payAccountId)
        })
      })

      if (res.ok) {
        setIsPayModalOpen(false)
        onRefresh()
      } else {
        alert("Ошибка при проведении оплаты")
      }
    } catch (e) {
      console.error(e)
    } finally {
      setSubmitting(false)
    }
  }

  const handleCreateRecurring = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newBill.name || !newBill.category_id || !newBill.amount) return

    setSubmitting(true)
    try {
      const res = await fetch(`/api/clubs/${clubId}/finance/recurring`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newBill.name,
          category_id: parseInt(newBill.category_id),
          amount: parseFloat(newBill.amount),
          day_of_month: parseInt(newBill.day_of_month)
        })
      })

      if (res.ok) {
        setIsNewRecurringOpen(false)
        setNewBill({ name: "", amount: "", day_of_month: "1", category_id: "" })
        fetchRecurring()
      } else {
        alert("Ошибка добавления платежа")
      }
    } catch (e) {
      console.error(e)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header & Add Button */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-slate-900">График регулярных платежей</h3>
        <Button onClick={() => setIsNewRecurringOpen(true)} className="rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-medium h-9 px-3">
          <Plus className="h-4 w-4 mr-1.5" /> Добавить счет
        </Button>
      </div>

      {/* Table of Monthly Payments */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">Срок (День)</th>
                <th className="px-5 py-3">Название платежа</th>
                <th className="px-5 py-3">Категория</th>
                <th className="px-5 py-3 text-right">Сумма к оплате</th>
                <th className="px-5 py-3 text-center">Статус</th>
                <th className="px-5 py-3 text-center">Действие</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recurringPayments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-400 font-medium">
                    Регулярные платежи не добавлены
                  </td>
                </tr>
              ) : (
                recurringPayments.map((rp) => {
                  const { status, paidAmount, remaining } = getPaymentStatus(rp.id, rp.amount)

                  return (
                    <tr key={rp.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3.5 font-bold text-slate-900">
                        {rp.day_of_month}-е число
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-slate-800">
                        {rp.name}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">
                        {rp.category_name || 'Коммунальные и прочие'}
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold text-slate-900">
                        {formatMoney(rp.amount)}
                      </td>
                      <td className="px-5 py-3.5 text-center whitespace-nowrap">
                        {status === 'paid' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Оплачено
                          </span>
                        ) : status === 'partial' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                            <Clock className="h-3 w-3 mr-1" /> Частично ({formatMoney(paidAmount)})
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                            <Clock className="h-3 w-3 mr-1" /> К оплате
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {status !== 'paid' && (
                          <Button
                            onClick={() => handleOpenPayModal(rp, remaining)}
                            className="rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-[11px] px-3 py-1 h-7 font-medium"
                          >
                            Оплатить счет
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pay Modal */}
      <Dialog open={isPayModalOpen} onOpenChange={setIsPayModalOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Оплата счета: {selectedBill?.name}</DialogTitle>
            <DialogDescription className="text-xs">Проведение оплаты регулярного платежа</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConfirmPay} className="space-y-4 py-2 text-xs">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Сумма (₽)</label>
              <Input
                type="number"
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
                className="rounded-xl font-bold text-base h-10"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Счет списания</label>
              <Select value={payAccountId} onValueChange={setPayAccountId}>
                <SelectTrigger className="rounded-xl h-10">
                  <SelectValue placeholder="Выберите счет" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map(a => (
                    <SelectItem key={a.id} value={a.id.toString()}>{a.name} ({formatMoney(a.current_balance)})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsPayModalOpen(false)} className="rounded-xl">
                Отмена
              </Button>
              <Button type="submit" className="rounded-xl bg-slate-900 text-white hover:bg-slate-800" disabled={submitting}>
                Подтвердить оплату
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* New Recurring Modal */}
      <Dialog open={isNewRecurringOpen} onOpenChange={setIsNewRecurringOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Новый регулярный платеж</DialogTitle>
            <DialogDescription className="text-xs">Ежемесячное списание (аренда, коммунальные, софт)</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateRecurring} className="space-y-4 py-2 text-xs">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Название счета</label>
              <Input
                placeholder="Аренда помещения"
                value={newBill.name}
                onChange={e => setNewBill(prev => ({ ...prev, name: e.target.value }))}
                className="rounded-xl h-10"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Плановая сумма (₽)</label>
              <Input
                type="number"
                placeholder="150000"
                value={newBill.amount}
                onChange={e => setNewBill(prev => ({ ...prev, amount: e.target.value }))}
                className="rounded-xl font-bold h-10"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">День месяца к оплате (1..31)</label>
              <Input
                type="number"
                min={1}
                max={31}
                value={newBill.day_of_month}
                onChange={e => setNewBill(prev => ({ ...prev, day_of_month: e.target.value }))}
                className="rounded-xl h-10"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Категория затрат</label>
              <Select value={newBill.category_id} onValueChange={val => setNewBill(prev => ({ ...prev, category_id: val }))}>
                <SelectTrigger className="rounded-xl h-10">
                  <SelectValue placeholder="Выберите категорию" />
                </SelectTrigger>
                <SelectContent>
                  {categories.filter(c => c.type === 'expense').map(c => (
                    <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsNewRecurringOpen(false)} className="rounded-xl">
                Отмена
              </Button>
              <Button type="submit" className="rounded-xl bg-slate-900 text-white hover:bg-slate-800" disabled={submitting}>
                Сохранить шаблон
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
