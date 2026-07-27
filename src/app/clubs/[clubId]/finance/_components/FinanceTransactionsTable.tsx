"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog"
import {
  Plus, Search, ArrowRightLeft, Scale, Trash2, Download, Paperclip, ExternalLink
} from "lucide-react"

interface FinanceTransactionsTableProps {
  clubId: string
  transactions: any[]
  categories: any[]
  accounts: any[]
  onRefresh: () => void
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 0
  }).format(amount) + ' ₽'
}

export function FinanceTransactionsTable({
  clubId,
  transactions,
  categories,
  accounts,
  onRefresh
}: FinanceTransactionsTableProps) {
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [categoryFilter, setCategoryFilter] = useState("all")

  // Local optimistic state for instant zero-latency UI updates
  const [localTxList, setLocalTxList] = useState<any[]>(transactions || [])

  useEffect(() => {
    setLocalTxList(transactions || [])
  }, [transactions])

  // Modals state
  const [isAddTxOpen, setIsAddTxOpen] = useState(false)
  const [isTransferOpen, setIsTransferOpen] = useState(false)
  const [isAdjustOpen, setIsAdjustOpen] = useState(false)

  // Form states
  const [newTx, setNewTx] = useState({
    amount: "",
    type: "expense", // 'income' | 'expense' | 'dividend'
    category_id: "",
    account_id: "",
    notes: "",
    attachment_url: "",
    transaction_date: new Date().toISOString().split('T')[0]
  })

  const [transferData, setTransferData] = useState({
    from_account_id: "",
    to_account_id: "",
    amount: "",
    notes: "Внутренний перевод (инкассация)"
  })

  const [adjustData, setAdjustData] = useState({
    account_id: "",
    new_balance: "",
    reason: "Корректировка остатков счета"
  })

  // Export to CSV helper
  const handleExportCSV = () => {
    if (filteredTransactions.length === 0) {
      alert("Нет данных для экспорта!")
      return
    }

    const headers = ["ID", "Дата", "Тип", "Категория", "Счет", "Сумма", "Описание", "Чек/Ссылка"]
    const rows = filteredTransactions.map(t => [
      t.id,
      t.transaction_date ? new Date(t.transaction_date).toLocaleDateString('ru-RU') : '',
      t.is_transfer ? 'Перевод' : (t.type === 'income' ? 'Доход' : 'Расход'),
      `"${(t.category_name || '').replace(/"/g, '""')}"`,
      `"${(t.account_name || '').replace(/"/g, '""')}"`,
      t.amount,
      `"${(t.notes || t.description || '').replace(/"/g, '""')}"`,
      t.attachment_url || ''
    ])

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", `transactions_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const [isSubmitting, setIsSubmitting] = useState(false)

  // Handlers
  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault()
    const resolvedAccountId = parseInt(newTx.account_id) || accounts[0]?.id
    
    if (!newTx.amount || !newTx.transaction_date) {
      alert("Укажите сумму и дату операции!")
      return
    }

    if (!resolvedAccountId) {
      alert("Счет не выбран и счета клуба отсутствуют! Добавьте счет в настройках финансов.")
      return
    }

    setIsSubmitting(true)
    try {
      let resolvedCategoryId = parseInt(newTx.category_id)
      let resolvedNotes = newTx.notes
      let resolvedType = newTx.type

      if (newTx.type === 'dividend') {
        resolvedType = 'expense'
        resolvedNotes = `${resolvedNotes} [Dividend]`.trim()
        const catCheck = categories.find(c => c.name.toLowerCase().includes('дивиденд') || c.name.toLowerCase().includes('прочие расходы')) || categories.find(c => c.type === 'expense')
        resolvedCategoryId = catCheck ? catCheck.id : 10
      } else if (!resolvedCategoryId || isNaN(resolvedCategoryId)) {
        const defaultCat = categories.find(c => c.type === (resolvedType === 'income' ? 'income' : 'expense'))
        resolvedCategoryId = defaultCat ? defaultCat.id : (resolvedType === 'income' ? 2 : 10)
      }

      const res = await fetch(`/api/clubs/${clubId}/finance/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category_id: resolvedCategoryId,
          amount: parseFloat(newTx.amount),
          type: resolvedType,
          payment_method: "cash",
          status: "completed",
          transaction_date: newTx.transaction_date,
          description: newTx.type === 'dividend' ? "Вывод прибыли собственником (Дивиденды)" : (newTx.type === 'income' ? "Внесение дохода" : "Финансовый расход"),
          notes: resolvedNotes,
          attachment_url: newTx.attachment_url,
          account_id: resolvedAccountId,
          is_transfer: false
        })
      })

      if (res.ok) {
        const resData = await res.json()
        if (resData.transaction) {
          setLocalTxList(prev => [resData.transaction, ...prev])
        }
        setIsAddTxOpen(false)
        setNewTx({
          amount: "",
          type: "expense",
          category_id: "",
          account_id: accounts[0]?.id?.toString() || "",
          notes: "",
          attachment_url: "",
          transaction_date: new Date().toISOString().split('T')[0]
        })
        onRefresh()
      } else {
        const d = await res.json()
        alert(d.error || "Ошибка создания операции")
      }
    } catch (err) {
      console.error(err)
      alert("Ошибка при создании операции")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault()
    const { from_account_id, to_account_id, amount, notes } = transferData
    if (!from_account_id || !to_account_id || !amount) {
      alert("Заполните все обязательные поля!")
      return
    }

    if (from_account_id === to_account_id) {
      alert("Счет отправителя и получателя должны быть разными!")
      return
    }

    try {
      const fromAcc = accounts.find(a => a.id === parseInt(from_account_id))
      const toAcc = accounts.find(a => a.id === parseInt(to_account_id))

      const outCat = categories.find(c => c.name === 'Прочие расходы' && c.type === 'expense')?.id || categories[0]?.id
      const inCat = categories.find(c => c.name === 'Прочие доходы' && c.type === 'income')?.id || categories[0]?.id

      // Outflow with is_transfer = true
      const outRes = await fetch(`/api/clubs/${clubId}/finance/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category_id: outCat,
          amount: parseFloat(amount),
          type: "expense",
          payment_method: "bank_transfer",
          status: "completed",
          transaction_date: new Date().toISOString().split('T')[0],
          description: `Инкассация: перевод на счет ${toAcc?.name}`,
          notes: `${notes} [TransferOut]`,
          account_id: parseInt(from_account_id),
          is_transfer: true
        })
      })

      // Inflow with is_transfer = true
      const inRes = await fetch(`/api/clubs/${clubId}/finance/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category_id: inCat,
          amount: parseFloat(amount),
          type: "income",
          payment_method: "bank_transfer",
          status: "completed",
          transaction_date: new Date().toISOString().split('T')[0],
          description: `Инкассация: перевод со счета ${fromAcc?.name}`,
          notes: `${notes} [TransferIn]`,
          account_id: parseInt(to_account_id),
          is_transfer: true
        })
      })

      if (outRes.ok && inRes.ok) {
        setIsTransferOpen(false)
        setTransferData({
          from_account_id: "",
          to_account_id: "",
          amount: "",
          notes: "Внутренний перевод (инкассация)"
        })
        onRefresh()
      } else {
        alert("Ошибка выполнения перевода")
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleAdjustBalance = async (e: React.FormEvent) => {
    e.preventDefault()
    const { account_id, new_balance, reason } = adjustData
    if (!account_id || new_balance === "") {
      alert("Заполните все поля!")
      return
    }

    try {
      const res = await fetch(`/api/clubs/${clubId}/finance/accounts/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: parseInt(account_id),
          new_balance: parseFloat(new_balance),
          reason
        })
      })

      if (res.ok) {
        setIsAdjustOpen(false)
        setAdjustData({
          account_id: "",
          new_balance: "",
          reason: "Корректировка остатков счета"
        })
        onRefresh()
      } else {
        alert("Ошибка корректировки")
      }
    } catch (err) {
      console.error(err)
    }
  }

  const [deletingTxId, setDeletingTxId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const confirmDeleteTx = async () => {
    if (!deletingTxId) return
    const targetId = deletingTxId.toString()
    setLocalTxList(prev => prev.filter(t => t.id.toString() !== targetId))
    setDeletingTxId(null)
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/clubs/${clubId}/finance/transactions?id=${targetId}`, {
        method: "DELETE"
      })
      if (res.ok) {
        onRefresh()
      } else {
        const d = await res.json()
        alert(d.error || "Ошибка при удалении операции")
        onRefresh()
      }
    } catch (e) {
      console.error(e)
      alert("Ошибка сети при удалении операции")
      onRefresh()
    } finally {
      setIsDeleting(false)
    }
  }

  // Filtering
  const filteredTransactions = localTxList.filter(t => {
    if (typeFilter === 'income' && (t.type !== 'income' || t.is_transfer)) return false
    if (typeFilter === 'expense' && (t.type !== 'expense' || t.is_transfer)) return false
    if (typeFilter === 'transfer' && !t.is_transfer && !t.notes?.includes('[Transfer')) return false
    if (categoryFilter !== 'all' && t.category_id?.toString() !== categoryFilter) return false
    if (search) {
      const s = search.toLowerCase()
      const desc = (t.description || '').toLowerCase()
      const notes = (t.notes || '').toLowerCase()
      const cat = (t.category_name || '').toLowerCase()
      return desc.includes(s) || notes.includes(s) || cat.includes(s)
    }
    return true
  })

  return (
    <div className="space-y-6">
      {/* Action Buttons & Filters Bar */}
      <div className="flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center">
        <div className="flex flex-col sm:flex-row gap-2 flex-1">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Поиск по описанию, примечанию..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-10 pl-9 rounded-xl border-slate-200 bg-white text-xs font-medium text-slate-900 placeholder:text-slate-400 shadow-xs focus-visible:ring-1 focus-visible:ring-slate-400"
            />
          </div>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-10 w-full sm:w-[140px] rounded-xl border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-xs">
              <SelectValue placeholder="Все типы" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">Все типы</SelectItem>
              <SelectItem value="income">Доходы</SelectItem>
              <SelectItem value="expense">Расходы</SelectItem>
              <SelectItem value="transfer">Переводы</SelectItem>
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-10 w-full sm:w-[170px] rounded-xl border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-xs">
              <SelectValue placeholder="Все категории" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">Все категории</SelectItem>
              {categories.map(c => (
                <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2">
          <div className="flex items-center gap-2">
            <Button
              onClick={handleExportCSV}
              variant="outline"
              size="icon"
              title="Экспорт CSV"
              className="h-10 w-10 rounded-xl border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-xs"
            >
              <Download className="h-4 w-4 text-slate-600" />
            </Button>

            <Button
              onClick={() => setIsTransferOpen(true)}
              variant="outline"
              size="icon"
              title="Инкассация / Перевод между счетами"
              className="h-10 w-10 rounded-xl border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-xs"
            >
              <ArrowRightLeft className="h-4 w-4 text-blue-600" />
            </Button>

            <Button
              onClick={() => setIsAdjustOpen(true)}
              variant="outline"
              size="icon"
              title="Корректировка остатков"
              className="h-10 w-10 rounded-xl border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-xs"
            >
              <Scale className="h-4 w-4 text-amber-600" />
            </Button>
          </div>

          <Button
            onClick={() => setIsAddTxOpen(true)}
            className="h-10 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-semibold px-4 shadow-xs"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Новая операция
          </Button>
        </div>
      </div>

      {/* Mobile Transactions List (< 768px) */}
      <div className="space-y-3 md:hidden">
        {filteredTransactions.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-xs font-medium">
            Операции за выбранный период не найдены
          </div>
        ) : (
          filteredTransactions.map((tx) => {
            const isTransfer = tx.is_transfer || tx.notes?.includes('[Transfer')
            const isDividend = tx.notes?.includes('[Dividend]')

            return (
              <div key={tx.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">
                    {tx.transaction_date ? new Date(tx.transaction_date).toLocaleDateString('ru-RU') : '-'}
                  </span>
                  {isTransfer ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                      Перевод
                    </span>
                  ) : isDividend ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700">
                      Дивиденды
                    </span>
                  ) : tx.type === 'income' ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                      Доход
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                      Расход
                    </span>
                  )}
                </div>

                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-sm text-slate-900">{tx.category_name || 'Прочее'}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{tx.account_name || 'Основной счет'}</p>
                    {(tx.notes || tx.description) && (
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{tx.notes || tx.description}</p>
                    )}
                  </div>
                  <span className={`text-base font-black shrink-0 ${
                    isTransfer ? 'text-blue-600' : tx.type === 'income' ? 'text-emerald-600' : 'text-slate-900'
                  }`}>
                    {tx.type === 'income' ? '+' : '-'}{formatCurrency(parseFloat(tx.amount || 0))}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  {tx.attachment_url ? (
                    <a
                      href={tx.attachment_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline bg-blue-50 px-2 py-0.5 rounded-full"
                    >
                      <Paperclip className="h-3 w-3" /> Чек
                    </a>
                  ) : (
                    <span />
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeletingTxId(tx.id.toString())}
                    className="h-8 px-2 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Удалить
                  </Button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Desktop Transactions Table (≥ 768px) */}
      <Card className="hidden md:block rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Дата</th>
                  <th className="px-6 py-4">Тип</th>
                  <th className="px-6 py-4">Категория</th>
                  <th className="px-6 py-4">Счет</th>
                  <th className="px-6 py-4">Описание / Чек</th>
                  <th className="px-6 py-4 text-right">Сумма</th>
                  <th className="px-4 py-4 text-center">Действие</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-medium">
                      Операции за выбранный период не найдены
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx) => {
                    const isTransfer = tx.is_transfer || tx.notes?.includes('[Transfer')
                    const isDividend = tx.notes?.includes('[Dividend]')

                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-slate-600 font-medium">
                          {tx.transaction_date ? new Date(tx.transaction_date).toLocaleDateString('ru-RU') : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {isTransfer ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                              Перевод
                            </span>
                          ) : isDividend ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-700">
                              Дивиденды
                            </span>
                          ) : tx.type === 'income' ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                              Доход
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700">
                              Расход
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-semibold text-slate-800">
                          {tx.category_name || 'Прочее'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                          {tx.account_name || 'Основной счет'}
                        </td>
                        <td className="px-6 py-4 text-slate-500 max-w-xs truncate">
                          <div className="flex items-center gap-2">
                            <span className="truncate">{tx.notes || tx.description || '-'}</span>
                            {tx.attachment_url && (
                              <a
                                href={tx.attachment_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline shrink-0 bg-blue-50 px-2 py-0.5 rounded-full"
                              >
                                <Paperclip className="h-3 w-3" /> Чек
                              </a>
                            )}
                          </div>
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-right font-black ${
                          isTransfer ? 'text-blue-600' : tx.type === 'income' ? 'text-emerald-600' : 'text-slate-900'
                        }`}>
                          {tx.type === 'income' ? '+' : '-'}{formatCurrency(parseFloat(tx.amount || 0))}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingTxId(tx.id.toString())}
                            className="h-8 w-8 text-slate-400 hover:text-rose-600 rounded-lg"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add Transaction Modal */}
      <Dialog open={isAddTxOpen} onOpenChange={setIsAddTxOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Новая финансовая операция</DialogTitle>
            <DialogDescription>Зафиксируйте приход, расход или выплату дивидендов</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateTransaction} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Тип операции</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'expense', label: 'Расход' },
                  { id: 'income', label: 'Доход' },
                  { id: 'dividend', label: 'Дивиденды' }
                ].map(t => (
                  <Button
                    key={t.id}
                    type="button"
                    variant={newTx.type === t.id ? 'default' : 'outline'}
                    onClick={() => setNewTx(prev => ({ ...prev, type: t.id }))}
                    className="rounded-xl text-xs"
                  >
                    {t.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Сумма (₽)</Label>
              <Input
                type="number"
                placeholder="1000"
                value={newTx.amount}
                onChange={e => setNewTx(prev => ({ ...prev, amount: e.target.value }))}
                className="rounded-xl text-lg font-bold"
                required
              />
            </div>

            {newTx.type !== 'dividend' && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Категория</Label>
                <Select
                  value={newTx.category_id}
                  onValueChange={val => setNewTx(prev => ({ ...prev, category_id: val }))}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Выберите категорию" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories
                      .filter(c => c.type === (newTx.type === 'income' ? 'income' : 'expense'))
                      .map(c => (
                        <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Счет</Label>
              <Select
                value={newTx.account_id}
                onValueChange={val => setNewTx(prev => ({ ...prev, account_id: val }))}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Выберите счет" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map(a => (
                    <SelectItem key={a.id} value={a.id.toString()}>{a.name} ({formatCurrency(a.current_balance)})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Дата</Label>
              <Input
                type="date"
                value={newTx.transaction_date}
                onChange={e => setNewTx(prev => ({ ...prev, transaction_date: e.target.value }))}
                className="rounded-xl"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Ссылка на скан / фото чека</Label>
              <Input
                placeholder="https://..."
                value={newTx.attachment_url}
                onChange={e => setNewTx(prev => ({ ...prev, attachment_url: e.target.value }))}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Примечание</Label>
              <Input
                placeholder="Заметка к операции..."
                value={newTx.notes}
                onChange={e => setNewTx(prev => ({ ...prev, notes: e.target.value }))}
                className="rounded-xl"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsAddTxOpen(false)} className="rounded-xl">
                Отмена
              </Button>
              <Button type="submit" disabled={isSubmitting} className="rounded-xl bg-slate-900 text-white">
                {isSubmitting ? "Проведение..." : "Провести операцию"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Internal Transfer Modal */}
      <Dialog open={isTransferOpen} onOpenChange={setIsTransferOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-blue-600" />
              Инкассация / Перевод между счетами
            </DialogTitle>
            <DialogDescription>
              Перевод не влияет на Выручку и Расходы клуба в отчете P&L, изменяя только остатки счетов.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleTransfer} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Счет списания (Откуда)</Label>
              <Select
                value={transferData.from_account_id}
                onValueChange={val => setTransferData(prev => ({ ...prev, from_account_id: val }))}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Счет отправителя" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map(a => (
                    <SelectItem key={a.id} value={a.id.toString()}>{a.name} ({formatCurrency(a.current_balance)})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Счет зачисления (Куда)</Label>
              <Select
                value={transferData.to_account_id}
                onValueChange={val => setTransferData(prev => ({ ...prev, to_account_id: val }))}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Счет получателя" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map(a => (
                    <SelectItem key={a.id} value={a.id.toString()}>{a.name} ({formatCurrency(a.current_balance)})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Сумма перевода (₽)</Label>
              <Input
                type="number"
                placeholder="50000"
                value={transferData.amount}
                onChange={e => setTransferData(prev => ({ ...prev, amount: e.target.value }))}
                className="rounded-xl font-bold"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Примечание</Label>
              <Input
                value={transferData.notes}
                onChange={e => setTransferData(prev => ({ ...prev, notes: e.target.value }))}
                className="rounded-xl"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsTransferOpen(false)} className="rounded-xl">
                Отмена
              </Button>
              <Button type="submit" className="rounded-xl bg-blue-600 text-white hover:bg-blue-700">
                Выполнить перевод
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Adjust Balance Modal */}
      <Dialog open={isAdjustOpen} onOpenChange={setIsAdjustOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Scale className="h-5 w-5 text-amber-600" />
              Корректировка остатка счета
            </DialogTitle>
            <DialogDescription>
              Установите фактический остаток наличных или безналичных средств на счете.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAdjustBalance} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Счет</Label>
              <Select
                value={adjustData.account_id}
                onValueChange={val => setAdjustData(prev => ({ ...prev, account_id: val }))}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Выберите счет" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map(a => (
                    <SelectItem key={a.id} value={a.id.toString()}>{a.name} (Текущий: {formatCurrency(a.current_balance)})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Фактический остаток (₽)</Label>
              <Input
                type="number"
                placeholder="100000"
                value={adjustData.new_balance}
                onChange={e => setAdjustData(prev => ({ ...prev, new_balance: e.target.value }))}
                className="rounded-xl font-bold"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Причина корректировки</Label>
              <Input
                value={adjustData.reason}
                onChange={e => setAdjustData(prev => ({ ...prev, reason: e.target.value }))}
                className="rounded-xl"
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsAdjustOpen(false)} className="rounded-xl">
                Отмена
              </Button>
              <Button type="submit" className="rounded-xl bg-amber-600 text-white hover:bg-amber-700">
                Сохранить остаток
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={!!deletingTxId} onOpenChange={(open) => !open && setDeletingTxId(null)}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Удалить операцию?</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Вы уверены, что хотите удалить эту финансовую запись? Действие нельзя будет отменить.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeletingTxId(null)} className="rounded-xl flex-1">
              Отмена
            </Button>
            <Button
              onClick={confirmDeleteTx}
              disabled={isDeleting}
              className="rounded-xl flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold"
            >
              {isDeleting ? "Удаление..." : "Удалить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
