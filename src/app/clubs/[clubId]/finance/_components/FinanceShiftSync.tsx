"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog"
import {
  ArrowRight, RefreshCw, ShoppingBag, Receipt, ChevronDown, ChevronUp, AlertCircle, CheckCircle2, Settings
} from "lucide-react"

interface ShiftExpenseItem {
  amount: string | number
  comment: string
}

interface ShiftReport {
  id: string
  opened_at: string
  closed_at: string
  revenue_cash: number
  revenue_card: number
  revenue_sbp: number
  total_revenue: number
  bar_sales: number
  receipts_count: number
  expenses_cash_list: ShiftExpenseItem[]
  total_expenses: number
  admin_comment?: string
  closed_by_name?: string
}

interface FinanceShiftSyncProps {
  clubId: string
  accounts: any[]
  onSuccess: () => void
}

const formatMoney = (amount: number) => {
  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 0
  }).format(amount) + ' ₽'
}

export function FinanceShiftSync({ clubId, accounts, onSuccess }: FinanceShiftSyncProps) {
  const [pendingShifts, setPendingShifts] = useState<ShiftReport[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedShift, setSelectedShift] = useState<ShiftReport | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [cashAccountId, setCashAccountId] = useState("")
  const [cardAccountId, setCardAccountId] = useState("")
  const [sbpAccountId, setSbpAccountId] = useState("")
  const [expandedShiftId, setExpandedShiftId] = useState<string | null>(null)
  const [submittingShiftId, setSubmittingShiftId] = useState<string | null>(null)

  useEffect(() => {
    if (clubId) {
      fetchPendingShifts()
    }
  }, [clubId])

  useEffect(() => {
    if (accounts.length > 0) {
      const cashAcc = accounts.find(a => a.account_type === 'cash') || accounts[0]
      const cardAcc = accounts.find(a => a.account_type === 'card' || a.account_type === 'bank') || accounts[0]
      const bankAcc = accounts.find(a => a.account_type === 'bank') || cardAcc || accounts[0]

      if (cashAcc) setCashAccountId(cashAcc.id.toString())
      if (cardAcc) setCardAccountId(cardAcc.id.toString())
      if (bankAcc) setSbpAccountId(bankAcc.id.toString())
    }
  }, [accounts])

  const fetchPendingShifts = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/clubs/${clubId}/finance/shift-sync`)
      if (res.ok) {
        const data = await res.json()
        setPendingShifts(data.pending_shifts || [])
      }
    } catch (e) {
      console.error("Failed to fetch pending shifts:", e)
    } finally {
      setLoading(false)
    }
  }

  // 1-Click direct acceptance without modal!
  const handleDirectSync = async (shift: ShiftReport) => {
    if (!cashAccountId && accounts.length > 0) {
      alert("Не найден счет для приемки кассы!")
      return
    }

    setSubmittingShiftId(shift.id)
    try {
      const res = await fetch(`/api/clubs/${clubId}/finance/shift-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shift_report_id: shift.id,
          cash_account_id: parseInt(cashAccountId || accounts[0]?.id.toString()),
          card_account_id: cardAccountId ? parseInt(cardAccountId) : undefined,
          sbp_account_id: sbpAccountId ? parseInt(sbpAccountId) : undefined
        })
      })

      if (res.ok) {
        setPendingShifts(prev => prev.filter(s => s.id !== shift.id))
        onSuccess()
      } else {
        const d = await res.json()
        alert(d.error || "Ошибка приемки выручки")
      }
    } catch (e) {
      console.error(e)
      alert("Ошибка при вызове приемки")
    } finally {
      setSubmittingShiftId(null)
    }
  }

  const handleOpenSettingsModal = (shift: ShiftReport) => {
    setSelectedShift(shift)
    setIsModalOpen(true)
  }

  if (loading) {
    return (
      <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-8 text-center text-xs text-slate-400 font-medium">
        Проверка не принятых смен...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Banner in Native Style */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-5 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-sm text-slate-900">Сверка выручки со смен</span>
            <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
              {pendingShifts.length} не принятых
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Зачисление выручки со смен администраторов на счета финансового учета клуба
          </p>
        </div>

        <Button
          onClick={fetchPendingShifts}
          variant="outline"
          className="rounded-xl border-slate-200 bg-white hover:bg-slate-100 text-xs h-9 px-3 font-medium shadow-xs"
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
          Обновить
        </Button>
      </div>

      {pendingShifts.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-8 text-center space-y-2">
          <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
          <h4 className="font-bold text-sm text-slate-900">Все смены сверены</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Выручка по всем закрытым сменам полностью принята и зачислена на счета финансового учета.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pendingShifts.map((shift) => {
            const isExpensesExpanded = expandedShiftId === shift.id
            const expensesList = shift.expenses_cash_list || []
            const isSyncing = submittingShiftId === shift.id

            return (
              <div key={shift.id} className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  {/* Shift Top Header */}
                  <div className="flex justify-between items-start pb-3 border-b border-slate-100">
                    <div>
                      <p className="font-bold text-xs text-slate-900">Админ: {shift.closed_by_name}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {shift.closed_at ? new Date(shift.closed_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 font-medium">
                        {shift.receipts_count} чеков
                      </span>
                      <button
                        onClick={() => handleOpenSettingsModal(shift)}
                        className="text-slate-400 hover:text-slate-700 p-1 rounded-md hover:bg-slate-100"
                        title="Настройки счетов зачисления"
                      >
                        <Settings className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Revenue Channels */}
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <span className="text-slate-600 font-medium">
                        Наличные:
                      </span>
                      <span className="font-bold text-slate-900">{formatMoney(shift.revenue_cash)}</span>
                    </div>

                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <span className="text-slate-600 font-medium">
                        Терминал (карты):
                      </span>
                      <span className="font-bold text-slate-900">{formatMoney(shift.revenue_card)}</span>
                    </div>

                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <span className="text-slate-600 font-medium">
                        СБП / Переводы:
                      </span>
                      <span className="font-bold text-slate-900">{formatMoney(shift.revenue_sbp)}</span>
                    </div>
                  </div>

                  {/* Bar Sales Badge */}
                  {shift.bar_sales > 0 && (
                    <div className="flex justify-between items-center text-[10px] px-2.5 py-1.5 rounded-lg bg-purple-50 text-purple-800 border border-purple-100 font-medium">
                      <span>Продажи бара:</span>
                      <span className="font-bold">{formatMoney(shift.bar_sales)}</span>
                    </div>
                  )}

                  {/* Itemized Cash Expenses */}
                  {expensesList.length > 0 && (
                    <div className="border border-rose-100 rounded-lg bg-rose-50/40 overflow-hidden">
                      <button
                        onClick={() => setExpandedShiftId(isExpensesExpanded ? null : shift.id)}
                        className="w-full flex items-center justify-between p-2 text-[10px] font-bold text-rose-900 hover:bg-rose-50 transition-colors"
                      >
                        <span>
                          Изъятия из кассы ({expensesList.length}): -{formatMoney(shift.total_expenses)}
                        </span>
                        {isExpensesExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>

                      {isExpensesExpanded && (
                        <div className="p-2 pt-0 border-t border-rose-100/60 space-y-1 text-[10px]">
                          {expensesList.map((exp, idx) => (
                            <div key={idx} className="flex justify-between items-center text-slate-700">
                              <span className="truncate max-w-[150px] text-slate-600">• {exp.comment || 'Расход'}</span>
                              <span className="font-bold text-rose-700">-{formatMoney(parseFloat(exp.amount as any || 0))}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Admin Comment */}
                  {shift.admin_comment && (
                    <p className="text-[10px] italic text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">
                      "{shift.admin_comment}"
                    </p>
                  )}
                </div>

                {/* Card Footer - 1-Click Acceptance! */}
                <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Выручка</span>
                    <span className="text-base font-bold text-slate-900">{formatMoney(shift.total_revenue)}</span>
                  </div>

                  <Button
                    onClick={() => handleDirectSync(shift)}
                    disabled={isSyncing}
                    className="rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs px-3.5 py-1.5 h-9 font-medium"
                  >
                    {isSyncing ? "Приемка..." : "Принять выручку"} <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Account Settings Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Настройка счетов зачисления смены</DialogTitle>
            <DialogDescription className="text-xs">
              Укажите счета по умолчанию для зачисления Наличных, Терминала и СБП
            </DialogDescription>
          </DialogHeader>

          {selectedShift && (
            <div className="space-y-4 py-2 text-xs">
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Счет зачисления НАЛИЧНЫХ (Касса)</label>
                  <Select value={cashAccountId} onValueChange={setCashAccountId}>
                    <SelectTrigger className="rounded-xl h-10">
                      <SelectValue placeholder="Выберите кассу" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map(a => (
                        <SelectItem key={a.id} value={a.id.toString()}>{a.name} ({formatMoney(a.current_balance)})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Счет зачисления ТЕРМИНАЛА (Эквайринг)</label>
                  <Select value={cardAccountId} onValueChange={setCardAccountId}>
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

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Счет зачисления СБП / ПЕРЕВОДОВ (Банк)</label>
                  <Select value={sbpAccountId} onValueChange={setSbpAccountId}>
                    <SelectTrigger className="rounded-xl h-10">
                      <SelectValue placeholder="Выберите банковский счет" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map(a => (
                        <SelectItem key={a.id} value={a.id.toString()}>{a.name} ({formatMoney(a.current_balance)})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setIsModalOpen(false)} className="rounded-xl">
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
