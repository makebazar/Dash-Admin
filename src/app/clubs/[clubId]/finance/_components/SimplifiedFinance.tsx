"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  TrendingUp, TrendingDown, DollarSign,
  Percent, ChevronLeft, ChevronRight, Settings, Plus,
  Calendar as CalendarIcon, Info, CreditCard, Wallet, Banknote,
  CheckCircle2, RefreshCw, AlertCircle, ArrowRightLeft, Scale, ShieldAlert
} from "lucide-react"

// Types matching backend
interface Account {
  id: number
  name: string
  account_type: string
  current_balance: number
  icon: string
  color: string
}

interface Category {
  id: number
  name: string
  type: "income" | "expense"
  icon: string
  color: string
}

interface Transaction {
  id: string
  amount: number
  type: "income" | "expense"
  category_id: number
  category_name: string
  category_icon: string
  account_id: number
  account_name: string
  transaction_date: string
  notes?: string
  description?: string
}

interface RecurringPayment {
  id: number
  name: string
  amount: number
  day_of_month: number
  category_id: number
  category_name?: string
  is_consumption_based: boolean
  consumption_unit?: string
  default_unit_price?: number
  has_split?: boolean
  split_config?: Array<{ amount: number; day: number }>
}

interface Credit {
  id: number
  name: string
  creditor: string
  total_amount: number
  remaining_amount: number
  monthly_payment: number
  payment_day: number
}

interface SalaryPayment {
  id: number
  amount: number
  payment_method: string
  payment_type: string
  month: number
  year: number
  employee_name: string
}

// --- UI Format Helpers ---
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0
  }).format(amount) + " ₽"
}

const formatShortCurrency = (amount: number) => {
  if (amount >= 1000000) return (amount / 1000000).toFixed(1) + "M ₽"
  if (amount >= 1000) return (amount / 1000).toFixed(0) + "K ₽"
  return amount + " ₽"
}

export default function SimplifiedFinance() {
  const params = useParams()
  const clubId = params?.clubId as string

  // Date selection
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  // Core data states
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [recurringPayments, setRecurringPayments] = useState<RecurringPayment[]>([])
  const [credits, setCredits] = useState<Credit[]>([])
  const [salaryPayments, setSalaryPayments] = useState<SalaryPayment[]>([])
  const [loading, setLoading] = useState(true)

  // Modals state
  const [isTaxSettingsOpen, setIsTaxSettingsOpen] = useState(false)
  const [isAddTransactionOpen, setIsAddTransactionOpen] = useState(false)
  const [isTransferOpen, setIsTransferOpen] = useState(false)
  const [isAdjustOpen, setIsAdjustOpen] = useState(false)
  const [isPayRecurringOpen, setIsPayRecurringOpen] = useState(false)
  const [isPayCreditOpen, setIsPayCreditOpen] = useState(false)

  // Settings states (stored in localStorage)
  const [taxRegime, setTaxRegime] = useState("patent_usn6") // 'usn6', 'usn15', 'patent_usn6', 'patent_usn15'
  const [customTaxRate, setCustomTaxRate] = useState<number>(6)
  const [patentCost, setPatentCost] = useState<number>(12500) // cost per month
  const [limitExceeded, setLimitExceeded] = useState<boolean>(false) // >20M annual revenue (VAT 5%)
  const [usnCategories, setUsnCategories] = useState<number[]>([]) // categories under USN in combined mode

  // Form states
  const [newTx, setNewTx] = useState({
    amount: "",
    type: "expense", // 'income', 'expense', 'dividend'
    category_id: "",
    account_id: "",
    notes: "",
    transaction_date: new Date().toISOString().split('T')[0]
  })

  const [transferData, setTransferData] = useState({
    from_account_id: "",
    to_account_id: "",
    amount: "",
    notes: "Внутренний перевод (инкассация)"
  })

  const [adjustData, setAdjustData] = useState<{
    account_id: string;
    new_balance: string;
    reason: string;
  }>({
    account_id: "",
    new_balance: "",
    reason: "Корректировка кассы (выравнивание остатков)"
  })

  const [selectedPayBill, setSelectedPayBill] = useState<{
    bill: RecurringPayment
    amount: number
    name: string
    isSplit: boolean
    day: number
  } | null>(null)

  const [payBillData, setPayBillData] = useState({
    account_id: "",
    notes: ""
  })

  const [selectedPayCredit, setSelectedPayCredit] = useState<Credit | null>(null)
  const [payCreditData, setPayCreditData] = useState({
    account_id: "",
    principal_amount: "",
    interest_amount: "0"
  })

  const monthNames = [
    "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
  ]

  // Hydrate settings from localStorage on client-side mount
  useEffect(() => {
    if (clubId) {
      const savedRegime = localStorage.getItem(`finance_simplified_regime_${clubId}`)
      const savedRate = localStorage.getItem(`finance_simplified_rate_${clubId}`)
      const savedPatent = localStorage.getItem(`finance_simplified_patent_${clubId}`)
      const savedLimit = localStorage.getItem(`finance_simplified_limit_${clubId}`)
      const savedUsnCat = localStorage.getItem(`finance_simplified_usncat_${clubId}`)

      if (savedRegime) setTaxRegime(savedRegime)
      if (savedRate) setCustomTaxRate(parseFloat(savedRate))
      if (savedPatent) setPatentCost(parseFloat(savedPatent))
      if (savedLimit) setLimitExceeded(savedLimit === "true")
      if (savedUsnCat) setUsnCategories(JSON.parse(savedUsnCat))

      fetchData()
    }
  }, [clubId, selectedMonth, selectedYear])

  // Save settings helpers
  const saveTaxSettings = () => {
    localStorage.setItem(`finance_simplified_regime_${clubId}`, taxRegime)
    localStorage.setItem(`finance_simplified_rate_${clubId}`, customTaxRate.toString())
    localStorage.setItem(`finance_simplified_patent_${clubId}`, patentCost.toString())
    localStorage.setItem(`finance_simplified_limit_${clubId}`, limitExceeded.toString())
    localStorage.setItem(`finance_simplified_usncat_${clubId}`, JSON.stringify(usnCategories))
    setIsTaxSettingsOpen(false)
    fetchData()
  }

  // Toggle USN categories
  const toggleUsnCategory = (id: number) => {
    setUsnCategories(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    )
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const startDateStr = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`
      const lastDay = new Date(selectedYear, selectedMonth, 0).getDate()
      const endDateStr = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-${lastDay}`

      // Parallel fetches
      const [accRes, catRes, txRes, recRes, credRes, payRes] = await Promise.all([
        fetch(`/api/clubs/${clubId}/finance/accounts`),
        fetch(`/api/clubs/${clubId}/finance/categories`),
        fetch(`/api/clubs/${clubId}/finance/transactions?start_date=${startDateStr}&end_date=${endDateStr}&limit=1000`),
        fetch(`/api/clubs/${clubId}/finance/recurring`),
        fetch(`/api/clubs/${clubId}/finance/credits`),
        fetch(`/api/clubs/${clubId}/payments?month=${selectedMonth}&year=${selectedYear}`)
      ])

      if (accRes.ok) {
        const d = await accRes.json()
        setAccounts(d.accounts || [])
      }
      if (catRes.ok) {
        const d = await catRes.json()
        setCategories(d.categories || [])
      }
      if (txRes.ok) {
        const d = await txRes.json()
        setTransactions(d.transactions || [])
      }
      if (recRes.ok) {
        const d = await recRes.json()
        setRecurringPayments(d.recurring_payments || [])
      }
      if (credRes.ok) {
        const d = await credRes.json()
        setCredits(d.credits || [])
      }
      if (payRes.ok) {
        const d = await payRes.json()
        setSalaryPayments(d.payments || [])
      }
    } catch (e) {
      console.error("Error loading simplified finance:", e)
    } finally {
      setLoading(false)
    }
  }

  // Monthly navigation
  const navigateMonth = (dir: number) => {
    let m = selectedMonth + dir
    let y = selectedYear
    if (m > 12) {
      m = 1
      y++
    } else if (m < 1) {
      m = 12
      y--
    }
    setSelectedMonth(m)
    setSelectedYear(y)
  }

  // --- Calculations ---

  // 1. ZP automatic sync
  const syncedSalariesExpense = salaryPayments.reduce((sum, p) => sum + parseFloat(p.amount as any), 0)

  // 2. Base Income/Expense calculations from transactions
  // Filter out dividends from normal expenses
  const normalExpenses = transactions.filter(t => t.type === 'expense' && !t.notes?.includes('[Dividend]'))
  const baseExpensesSum = normalExpenses.reduce((sum, t) => sum + parseFloat(t.amount as any), 0)
  
  // Total Income
  const baseIncomeSum = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + parseFloat(t.amount as any), 0)

  // Combine manual expenses + synced salary expenses
  // Note: if some salary payments are already logged in transactions manually (category "Зарплата"),
  // we filter them from transactions to avoid double-counting.
  const transactionsWithoutSalaries = normalExpenses.filter(t => t.category_name !== 'Зарплата сотрудников')
  const baseExpensesWithoutSalaries = transactionsWithoutSalaries.reduce((sum, t) => sum + parseFloat(t.amount as any), 0)
  
  const totalExpensesSum = baseExpensesWithoutSalaries + syncedSalariesExpense

  // Total Dividends sum
  const dividendsSum = transactions.filter(t => t.type === 'expense' && t.notes?.includes('[Dividend]')).reduce((sum, t) => sum + parseFloat(t.amount as any), 0)

  // 3. Taxes engine (USN + Patent + VAT)
  let calculatedTax = 0
  let taxBaseText = ""
  let vatAmount = 0
  let isPatentCostApplied = false

  // Combined mode calculations
  const totalIncomeTransactions = transactions.filter(t => t.type === 'income')
  
  const usnIncomeSum = totalIncomeTransactions
    .filter(t => usnCategories.includes(t.category_id))
    .reduce((sum, t) => sum + parseFloat(t.amount as any), 0)

  const patentIncomeSum = totalIncomeTransactions
    .filter(t => !usnCategories.includes(t.category_id))
    .reduce((sum, t) => sum + parseFloat(t.amount as any), 0)

  // 5% VAT if limit exceeded (>20M in 2026)
  const vatRate = limitExceeded ? 0.05 : 0

  if (taxRegime === 'usn6') {
    calculatedTax = baseIncomeSum * (customTaxRate / 100)
    taxBaseText = `УСН Доходы ${customTaxRate}% от всей выручки (${formatCurrency(baseIncomeSum)})`
  } else if (taxRegime === 'usn15') {
    const profitBase = Math.max(0, baseIncomeSum - totalExpensesSum)
    calculatedTax = profitBase * (customTaxRate / 100)
    taxBaseText = `УСН Доходы-Расходы ${customTaxRate}% от прибыли (${formatCurrency(profitBase)})`
  } else if (taxRegime === 'patent_usn6') {
    // Joint: Patent on computer rental (0% tax, covered by monthly cost) + USN 6% on Bar
    isPatentCostApplied = true
    const barUsnTax = usnIncomeSum * (customTaxRate / 100)
    
    if (limitExceeded) {
      vatAmount = usnIncomeSum * vatRate
    }
    
    calculatedTax = barUsnTax + patentCost + vatAmount
    taxBaseText = `Совмещение: Патент (${formatCurrency(patentCost)}/мес) + УСН Доходы ${customTaxRate}% за бар (${formatCurrency(usnIncomeSum)})`
  } else if (taxRegime === 'patent_usn15') {
    // Joint: Patent (fixed) + USN 15% on Bar profit (with proportionate expenses split!)
    isPatentCostApplied = true
    
    // Revenue share of the Bar
    const totalRevenue = baseIncomeSum || 1
    const barShare = usnIncomeSum / totalRevenue

    // Proportional expenses deducted for Bar
    const barExpenses = totalExpensesSum * barShare
    const barProfit = Math.max(0, usnIncomeSum - barExpenses)

    const barUsnTax = barProfit * (customTaxRate / 100)

    if (limitExceeded) {
      vatAmount = usnIncomeSum * vatRate
    }

    calculatedTax = barUsnTax + patentCost + vatAmount
    taxBaseText = `Совмещение: Патент (${formatCurrency(patentCost)}/мес) + УСН Доходы-Расходы ${customTaxRate}% за бар (Пропорция расходов: ${Math.round(barShare * 100)}%)`
  }

  // Deduct salary insurance contributions (Up to 50% for USN 6% regimes)
  let appliedInsuranceDeduction = 0
  if (taxRegime === 'usn6' || taxRegime === 'patent_usn6') {
    const maxDeduction = (calculatedTax - (isPatentCostApplied ? patentCost : 0)) * 0.5
    // Assume 30% of salaries paid represents insurance contributions (страховые взносы)
    const estimatedContributions = syncedSalariesExpense * 0.30
    appliedInsuranceDeduction = Math.min(maxDeduction, estimatedContributions)
    calculatedTax = Math.max(calculatedTax - appliedInsuranceDeduction, (isPatentCostApplied ? patentCost : 0))
  }

  // Final operating metrics
  const operatingProfit = baseIncomeSum - totalExpensesSum
  const netProfit = operatingProfit - calculatedTax

  // --- Handlers ---

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTx.amount || !newTx.account_id || !newTx.transaction_date) {
      alert("Заполните обязательные поля!")
      return
    }

    try {
      let resolvedCategoryId = newTx.category_id
      let resolvedNotes = newTx.notes
      let resolvedType = newTx.type

      // If dividend, categorize as Other expenses but add [Dividend] tag in notes
      if (newTx.type === 'dividend') {
        resolvedType = 'expense'
        resolvedNotes = `${resolvedNotes} [Dividend]`.trim()
        const catCheck = categories.find(c => c.name === 'Прочие расходы' && c.type === 'expense')
        resolvedCategoryId = catCheck ? catCheck.id.toString() : categories.find(c => c.type === 'expense')?.id.toString() || ""
      }

      const res = await fetch(`/api/clubs/${clubId}/finance/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category_id: parseInt(resolvedCategoryId),
          amount: parseFloat(newTx.amount),
          type: resolvedType,
          payment_method: "cash",
          status: "completed",
          transaction_date: newTx.transaction_date,
          description: newTx.type === 'dividend' ? "Вывод прибыли собственником (Дивиденды)" : "Ручная операция",
          notes: resolvedNotes,
          account_id: parseInt(newTx.account_id)
        })
      })

      if (res.ok) {
        setIsAddTransactionOpen(false)
        setNewTx({
          amount: "",
          type: "expense",
          category_id: "",
          account_id: "",
          notes: "",
          transaction_date: new Date().toISOString().split('T')[0]
        })
        await fetchData()
      } else {
        const d = await res.json()
        alert(d.error || "Ошибка создания операции")
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault()
    const { from_account_id, to_account_id, amount, notes } = transferData
    if (!from_account_id || !to_account_id || !amount) {
      alert("Заполните все поля!")
      return
    }

    if (from_account_id === to_account_id) {
      alert("Счет отправителя и получателя должны быть разными!")
      return
    }

    try {
      const fromAcc = accounts.find(a => a.id === parseInt(from_account_id))
      const toAcc = accounts.find(a => a.id === parseInt(to_account_id))

      // Category IDs for transfer (usually Prochie rashody / Prochie dohody or dynamic)
      const outCat = categories.find(c => c.name === 'Прочие расходы' && c.type === 'expense')?.id
      const inCat = categories.find(c => c.name === 'Прочие доходы' && c.type === 'income')?.id

      if (!outCat || !inCat) {
        alert("Ошибка: Не найдены системные категории для перевода!")
        return
      }

      // Record outflow
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
          account_id: parseInt(from_account_id)
        })
      })

      // Record inflow
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
          account_id: parseInt(to_account_id)
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
        await fetchData()
      } else {
        alert("Ошибка при выполнении перевода")
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
          reason: "Корректировка кассы (выравнивание остатков)"
        })
        await fetchData()
      } else {
        alert("Ошибка корректировки")
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Pre-configured payment mapping helper
  const getPaymentStatus = (recurringId: number, targetAmount: number) => {
    const relevantTransactions = transactions.filter(t =>
      t.notes && t.notes.includes(`[Recurring:${recurringId}]`)
    )

    const paidAmount = relevantTransactions.reduce((sum, t) => sum + parseFloat(t.amount as any), 0)

    let status = "unpaid"
    if (paidAmount >= targetAmount) status = "paid"
    else if (paidAmount > 0) status = "partial"

    return {
      status,
      paidAmount,
      remainingAmount: Math.max(0, targetAmount - paidAmount)
    }
  }

  const handleConfirmPayBill = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPayBill || !payBillData.account_id) return

    try {
      const res = await fetch(`/api/clubs/${clubId}/finance/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category_id: selectedPayBill.bill.category_id,
          amount: selectedPayBill.amount,
          type: "expense",
          payment_method: "cash",
          status: "completed",
          transaction_date: new Date().toISOString().split('T')[0],
          description: `Оплата по счету: ${selectedPayBill.name}`,
          notes: `[Recurring:${selectedPayBill.bill.id}] ${payBillData.notes}`,
          account_id: parseInt(payBillData.account_id)
        })
      })

      if (res.ok) {
        setIsPayRecurringOpen(false)
        setSelectedPayBill(null)
        setPayBillData({ account_id: "", notes: "" })
        await fetchData()
      } else {
        alert("Ошибка при оплате счета")
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleConfirmPayCredit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPayCredit || !payCreditData.account_id || !payCreditData.principal_amount) return

    try {
      const res = await fetch(`/api/clubs/${clubId}/finance/credits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credit_id: selectedPayCredit.id,
          amount: parseFloat(payCreditData.principal_amount) + parseFloat(payCreditData.interest_amount),
          payment_date: new Date().toISOString().split('T')[0],
          account_id: parseInt(payCreditData.account_id),
          principal_amount: parseFloat(payCreditData.principal_amount),
          interest_amount: parseFloat(payCreditData.interest_amount),
          notes: "Быстрая оплата кредита"
        })
      })

      if (res.ok) {
        setIsPayCreditOpen(false)
        setSelectedPayCredit(null)
        setPayCreditData({ account_id: "", principal_amount: "", interest_amount: "0" })
        await fetchData()
      } else {
        const d = await res.json()
        alert(d.error || "Ошибка оплаты кредита")
      }
    } catch (err) {
      console.error(err)
    }
  }



  // Parse splits/normal recurring items
  const renderBillTasks = () => {
    const list: Array<{
      id: string
      bill: RecurringPayment
      name: string
      amount: number
      day: number
      isSplit: boolean
    }> = []

    recurringPayments.forEach(rp => {
      if (rp.has_split && rp.split_config && rp.split_config.length > 0) {
        rp.split_config.forEach((sp, idx) => {
          list.push({
            id: `${rp.id}_split_${idx}`,
            bill: rp,
            name: `${rp.name} (${idx === 0 ? "Аванс" : "Расчет"})`,
            amount: parseFloat(sp.amount as any),
            day: sp.day,
            isSplit: true
          })
        })
      } else {
        list.push({
          id: rp.id.toString(),
          bill: rp,
          name: rp.name,
          amount: parseFloat(rp.amount as any),
          day: rp.day_of_month,
          isSplit: false
        })
      }
    })

    return list.sort((a, b) => a.day - b.day)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshCw className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground animate-pulse font-medium">Загрузка упрощенных финансов...</p>
        </div>
      </div>
    )
  }
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* 1. Header controls (Redesigned as Premium Dark Steel Panel with Glow) */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-6 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-8 rounded-[2rem] border border-slate-800 shadow-2xl relative overflow-hidden text-white group">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(16,185,129,0.08),transparent_50%)]" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-[radial-gradient(circle_at_70%_10%,rgba(99,102,241,0.05),transparent_60%)] pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
          <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-xl shadow-inner backdrop-blur-md group-hover:scale-105 transition-all duration-300">
            📊
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
              Финансы 2.0
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase tracking-widest animate-pulse">PRO</span>
            </h2>
            <p className="text-xs font-medium text-slate-400 mt-1">
              Управленческий учет, налоги РФ 2026 и автоматизация смен за {monthNames[selectedMonth - 1]} {selectedYear}
            </p>
          </div>
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row items-center gap-3.5 w-full lg:w-auto">
          {/* Calendar Picker */}
          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-2xl border border-white/10 shadow-inner backdrop-blur-md w-full sm:w-auto justify-between sm:justify-start">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigateMonth(-1)} 
              className="hover:bg-white/10 rounded-xl h-9 w-9 text-slate-300 hover:text-white transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2 px-3 font-extrabold text-slate-200 whitespace-nowrap min-w-[120px] text-center text-xs">
              <CalendarIcon className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>
                {monthNames[selectedMonth - 1]} {selectedYear}
              </span>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigateMonth(1)} 
              className="hover:bg-white/10 rounded-xl h-9 w-9 text-slate-300 hover:text-white transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button 
              onClick={() => setIsTaxSettingsOpen(true)}
              variant="outline" 
              className="w-full sm:w-auto rounded-2xl border-white/10 bg-white/5 hover:bg-white/10 text-white font-extrabold h-11 px-5 transition-all duration-200 shadow-sm"
            >
              <Settings className="h-4 w-4 mr-2 text-emerald-400" />
              Налоги УСН
            </Button>

            <Button 
              onClick={() => setIsAddTransactionOpen(true)}
              className="w-full sm:w-auto rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black h-11 px-6 shadow-[0_4px_20px_rgba(16,185,129,0.25)] hover:shadow-[0_4px_25px_rgba(16,185,129,0.4)] border-0 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="h-4 w-4 mr-2 stroke-[3px]" />
              Внести операцию
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Key Metrics Grid (Glassmorphism & Radial Glow) */}
      <div className="grid gap-6 md:grid-cols-4">
        
        {/* Metric 1: Inflow */}
        <div className="bg-gradient-to-br from-white to-emerald-50/10 hover:to-emerald-50/30 rounded-[2rem] border border-slate-200/60 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-emerald-500" />
          <div className="p-6">
            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
              <span>ПОСТУПИЛО</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shadow-inner group-hover:scale-110 transition-all duration-300">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <div className="text-3xl font-black text-slate-900 mt-4 tracking-tight">
              {formatCurrency(baseIncomeSum)}
            </div>
            <div className="text-[10px] font-extrabold text-emerald-600 bg-emerald-50/80 px-2 py-0.5 rounded-lg border border-emerald-100/50 uppercase mt-3.5 w-fit">
              Выручка смен и бара
            </div>
          </div>
        </div>

        {/* Metric 2: Outflow */}
        <div className="bg-gradient-to-br from-white to-rose-50/10 hover:to-rose-50/30 rounded-[2rem] border border-slate-200/60 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-400 to-rose-500" />
          <div className="p-6">
            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
              <span>ПОТРАЧЕНО</span>
              <div className="w-8 h-8 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500 shadow-inner group-hover:scale-110 transition-all duration-300">
                <TrendingDown className="h-4 w-4" />
              </div>
            </div>
            <div className="text-3xl font-black text-slate-900 mt-4 tracking-tight">
              {formatCurrency(totalExpensesSum)}
            </div>
            <div className="text-[10px] font-extrabold text-rose-600 bg-rose-50/80 px-2 py-0.5 rounded-lg border border-rose-100/50 uppercase mt-3.5 w-fit">
              С ЗП сотрудников ({formatShortCurrency(syncedSalariesExpense)})
            </div>
          </div>
        </div>

        {/* Metric 3: Taxes (USN Estimator) */}
        <div 
          onClick={() => setIsTaxSettingsOpen(true)}
          className="bg-gradient-to-br from-white to-amber-50/10 hover:to-amber-50/30 rounded-[2rem] border border-slate-200/60 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group cursor-pointer hover:border-amber-400/40"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-amber-500" />
          <div className="p-6">
            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
              <span>НАЛОГИ УСН</span>
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 shadow-inner group-hover:scale-110 transition-all duration-300">
                <Percent className="h-4 w-4" />
              </div>
            </div>
            <div className="text-3xl font-black text-slate-900 mt-4 tracking-tight">
              {formatCurrency(calculatedTax)}
            </div>
            <div className="text-[10px] font-extrabold text-amber-600 bg-amber-50/80 px-2 py-0.5 rounded-lg border border-amber-100/50 uppercase mt-3.5 w-fit flex items-center gap-1 hover:bg-amber-100 transition-colors duration-150">
              {taxRegime === 'usn6' ? 'УСН 6%' : taxRegime === 'usn15' ? 'УСН 15%' : 'УСН + Патент'}
              {limitExceeded && <span className="text-[9px] text-rose-600 font-black">+НДС 5%</span>}
            </div>
          </div>
        </div>

        {/* Metric 4: Net Profit (Stunning Cyber Premium Glow Card) */}
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white rounded-[2rem] border border-slate-800 shadow-[0_10px_35px_rgba(0,0,0,0.15)] hover:shadow-[0_15px_40px_rgba(16,185,129,0.15)] hover:border-emerald-500/30 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
          <div className="absolute -right-20 -bottom-20 w-44 h-44 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-all duration-500 pointer-events-none" />
          <div className="p-6">
            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
              <span>ЧИСТАЯ ПРИБЫЛЬ</span>
              <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-emerald-400 shadow-inner group-hover:scale-110 transition-all duration-300">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
            <div className={`text-3xl font-black mt-4 tracking-tight bg-clip-text text-transparent bg-gradient-to-r ${netProfit >= 0 ? 'from-emerald-400 via-teal-300 to-emerald-400' : 'from-rose-400 to-rose-500'}`}>
              {formatCurrency(netProfit)}
            </div>
            <div className={`text-[10px] font-extrabold px-2 py-0.5 rounded-lg uppercase mt-3.5 w-fit border ${netProfit >= 0 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-rose-400 bg-rose-500/10 border-rose-500/20'}`}>
              Чистыми после УСН
            </div>
          </div>
        </div>

      </div>

      {/* 2.1 Dividends and Owner Output Banner (Glassmorphic Luxury Gold Edition) */}
      {dividendsSum > 0 && (
        <div className="bg-gradient-to-r from-amber-500/5 via-amber-600/10 to-amber-500/5 border border-amber-500/20 rounded-[2rem] p-6 text-slate-900 flex flex-col lg:flex-row items-center justify-between gap-6 shadow-md relative overflow-hidden animate-in zoom-in-95 duration-300 group">
          <div className="absolute top-0 right-1/4 w-72 h-72 bg-amber-400/5 rounded-full blur-3xl pointer-events-none" />
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-2xl shadow-inner group-hover:rotate-12 transition-transform duration-300">
              💰
            </div>
            <div>
              <h4 className="font-black text-sm uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                Изъятие прибыли собственником
                <span className="text-[9px] font-black px-2 py-0.5 rounded bg-amber-500 text-slate-950 uppercase tracking-widest">ДИВИДЕНДЫ</span>
              </h4>
              <p className="text-xs text-slate-600 font-medium mt-1">
                Средства корректно выведены с баланса счетов и исключены из операционных расходов клуба.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6 relative z-10 w-full lg:w-auto justify-between lg:justify-end">
            <div className="text-center lg:text-right">
              <span className="text-[9px] font-extrabold text-amber-700 uppercase tracking-widest block">ВЫВЕДЕНО</span>
              <span className="text-xl font-black text-amber-800">{formatCurrency(dividendsSum)}</span>
            </div>
            <div className="w-px h-10 bg-amber-500/20 hidden lg:block" />
            <div className="text-center lg:text-right">
              <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block">ОСТАТОК ПРИБЫЛИ</span>
              <span className="text-xl font-black text-emerald-600">{formatCurrency(operatingProfit - dividendsSum)}</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Three-Panel Dashboard Columns (Highly Visual Redesign) */}
      <div className="grid gap-6 lg:grid-cols-3">
        
        {/* Column 1: Balances & Accounts */}
        <div className="bg-white/80 backdrop-blur-md rounded-[2.2rem] border border-slate-200/60 shadow-sm flex flex-col h-fit hover:shadow-md transition-all duration-300">
          <div className="p-6 pb-4 border-b border-slate-100/80">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-50 border flex items-center justify-center text-slate-500 shadow-sm">
                <Wallet className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Где лежат деньги</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Балансы сейфов и счетов</p>
              </div>
            </div>
          </div>
          
          <div className="p-6 space-y-5">
            
            {/* Accounts list (Custom slim scrollbars) */}
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
              {accounts.map(acc => (
                <div key={acc.id} className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-50/50 to-white border border-slate-100 hover:border-slate-200/80 rounded-2xl group hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-xl shadow-sm group-hover:scale-105 transition-all duration-300">
                      {acc.icon}
                    </div>
                    <div>
                      <div className="font-extrabold text-slate-900 text-xs tracking-tight">{acc.name}</div>
                      <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                        {acc.account_type === 'cash' ? 'Наличные' : acc.account_type === 'bank' ? 'Расчетный счет' : 'Терминал'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-slate-900 text-sm">{formatCurrency(acc.current_balance)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Actions buttons */}
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
              <Button 
                onClick={() => setIsTransferOpen(true)}
                variant="outline" 
                className="rounded-xl border-slate-200 hover:bg-slate-50 font-extrabold text-xs h-11 w-full text-slate-700 transition-all duration-200 active:scale-95"
              >
                <ArrowRightLeft className="h-3.5 w-3.5 mr-2 text-slate-500" />
                Инкассация
              </Button>
              <Button 
                onClick={() => setIsAdjustOpen(true)}
                variant="outline" 
                className="rounded-xl border-slate-200 hover:bg-slate-50 font-extrabold text-xs h-11 w-full text-slate-700 transition-all duration-200 active:scale-95"
              >
                <Scale className="h-3.5 w-3.5 mr-2 text-slate-500" />
                Сверить кассу
              </Button>
            </div>

          </div>
        </div>

        {/* Column 2: Upcoming Payments (Rent, Internet) */}
        <div className="bg-white/80 backdrop-blur-md rounded-[2.2rem] border border-slate-200/60 shadow-sm flex flex-col h-fit hover:shadow-md transition-all duration-300">
          <div className="p-6 pb-4 border-b border-slate-100/80">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-50 border flex items-center justify-center text-slate-500 shadow-sm">
                <CalendarIcon className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Регулярные платежи</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Обязательства этого месяца</p>
              </div>
            </div>
          </div>
          
          <div className="p-6">
            <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1 scrollbar-thin">
              {renderBillTasks().length === 0 ? (
                <div className="text-center py-12 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 text-slate-400 font-bold text-xs">
                  Нет запланированных платежей
                </div>
              ) : (
                renderBillTasks().map(task => {
                  const { status, paidAmount, remainingAmount } = getPaymentStatus(task.bill.id, task.amount)
                  const isPaid = status === "paid"

                  return (
                    <div 
                      key={task.id} 
                      className={`p-4 rounded-2xl border transition-all duration-300 ${
                        isPaid 
                          ? "bg-emerald-500/[0.02] border-emerald-100/50 opacity-60" 
                          : "bg-white border-slate-100 hover:border-slate-200 shadow-sm hover:-translate-y-0.5 hover:shadow"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base shadow-sm border ${isPaid ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-slate-50 border-slate-100'}`}>
                            {isPaid ? "✅" : "📅"}
                          </div>
                          <div>
                            <div className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                              {task.name}
                              {isPaid && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 fill-emerald-500/10" />}
                            </div>
                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">
                              Срок: {task.day}-е число
                            </div>
                          </div>
                        </div>

                        {isPaid ? (
                          <span className="text-[9px] font-black text-emerald-600 bg-emerald-100/70 px-2 py-1 rounded-lg uppercase tracking-wider">Оплачено</span>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedPayBill({
                                bill: task.bill,
                                amount: task.amount,
                                name: task.name,
                                isSplit: task.isSplit,
                                day: task.day
                              })
                              setIsPayRecurringOpen(true)
                            }}
                            className="h-8 text-[10px] font-black rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 text-white shadow-sm transition-all hover:scale-[1.03]"
                          >
                            {formatShortCurrency(task.amount)}
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* Column 3: Credits & Leasing (High-End Dark Metallic Aesthetics) */}
        <div className="bg-white/80 backdrop-blur-md rounded-[2.2rem] border border-slate-200/60 shadow-sm flex flex-col h-fit hover:shadow-md transition-all duration-300">
          <div className="p-6 pb-4 border-b border-slate-100/80">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-50 border flex items-center justify-center text-slate-500 shadow-sm">
                <Banknote className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Кредиты и лизинг</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Долги и лизинговые платежи</p>
              </div>
            </div>
          </div>
          
          <div className="p-6">
            <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1 scrollbar-thin">
              {credits.length === 0 ? (
                <div className="text-center py-12 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 text-slate-400 font-bold text-xs">
                  Нет активных кредитов
                </div>
              ) : (
                credits.map(cr => (
                  <div key={cr.id} className="p-5 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-white rounded-2xl border border-slate-800 relative overflow-hidden shadow-md group hover:border-amber-500/20 transition-all duration-300">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-amber-400 to-amber-600" />
                    
                    {/* Header */}
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <h4 className="font-extrabold text-white text-xs tracking-tight">{cr.name}</h4>
                        <p className="text-[9px] text-amber-500 font-extrabold uppercase tracking-widest mt-1">{cr.creditor}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] font-extrabold text-slate-500 block uppercase tracking-widest">ОСТАТОК</span>
                        <span className="font-black text-amber-400 text-sm tracking-tight">{formatCurrency(cr.remaining_amount)}</span>
                      </div>
                    </div>

                    <div className="w-full h-px bg-white/5 my-3.5" />

                    {/* Due details & button */}
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <span className="text-[9px] text-slate-500 font-extrabold block uppercase tracking-widest">СЛЕД. ПЛАТЕЖ</span>
                        <span className="text-xs font-black text-white">
                          {formatCurrency(cr.monthly_payment)}{" "}
                          <span className="text-[9px] text-slate-400 font-bold">до {cr.payment_day}-го</span>
                        </span>
                      </div>
                      
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedPayCredit(cr)
                          setPayCreditData(prev => ({
                            ...prev,
                            principal_amount: cr.monthly_payment.toString()
                          }))
                          setIsPayCreditOpen(true)
                        }}
                        className="h-8 text-[10px] font-black rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-[0_2px_12px_rgba(245,158,11,0.25)] border-0 transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]"
                      >
                        Оплатить
                      </Button>
                    </div>

                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

      {/* 4. Legal Disclaimer Note */}
      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-center text-[10px] font-bold text-slate-400/80 flex items-center justify-center gap-2 max-w-4xl mx-auto shadow-inner">
        <AlertCircle className="h-4 w-4 text-slate-300 shrink-0" />
        <span>
          Данные расчеты являются предварительными (управленческими) и носят аналитический характер. Для формирования официальной бухгалтерской и налоговой отчетности всегда консультируйтесь с вашим бухгалтером.
        </span>
      </div>

      {/* ======================================================
          MODALS & DIALOGS (Styled Premium)
          ====================================================== */}

      {/* Modal 1: Tax Settings */}
      <Dialog open={isTaxSettingsOpen} onOpenChange={setIsTaxSettingsOpen}>
        <DialogContent className="rounded-[2rem] max-w-lg border border-slate-200/80 bg-white p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black flex items-center gap-2 text-slate-900 uppercase tracking-tight">
              <Percent className="h-5 w-5 text-amber-500" />
              Налоговые настройки РФ
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Задайте ставки и режимы для управленческого расчета налогов и чистой прибыли.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            
            {/* Regime */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Налоговый режим</Label>
              <Select value={taxRegime} onValueChange={setTaxRegime}>
                <SelectTrigger className="rounded-xl h-11 border-slate-200 shadow-sm focus:ring-slate-400">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl shadow-lg">
                  <SelectItem value="usn6">💼 Только УСН «Доходы» (6%)</SelectItem>
                  <SelectItem value="usn15">💼 Только УСН «Доходы минус Расходы» (15%)</SelectItem>
                  <SelectItem value="patent_usn6">🚀 Совмещение: Патент (Компьютеры) + УСН «Доходы» (6%) за Бар</SelectItem>
                  <SelectItem value="patent_usn15">🚀 Совмещение: Патент (Компьютеры) + УСН «Доходы-Расходы» (15%) за Бар</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom rate (for regional incentives) */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Ставка налога УСН (%)</Label>
                <Input 
                  type="number"
                  value={customTaxRate}
                  onChange={(e) => setCustomTaxRate(parseFloat(e.target.value) || 0)}
                  placeholder="Обычно 6 или 15"
                  className="rounded-xl h-11 border-slate-200 shadow-sm"
                />
              </div>

              {/* Patent monthly cost */}
              {(taxRegime === 'patent_usn6' || taxRegime === 'patent_usn15') && (
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Стоимость патента (в месяц)</Label>
                  <Input 
                    type="number"
                    value={patentCost}
                    onChange={(e) => setPatentCost(parseFloat(e.target.value) || 0)}
                    placeholder="Например: 12500"
                    className="rounded-xl h-11 border-slate-200 shadow-sm"
                  />
                </div>
              )}
            </div>

            {/* VAT check (>20M limit in 2026) */}
            <div className="flex items-start gap-4 p-4 bg-slate-50 border border-slate-100 rounded-2xl shadow-inner">
              <Checkbox 
                id="limit"
                checked={limitExceeded}
                onCheckedChange={(checked) => setLimitExceeded(checked === true)}
                className="mt-1 rounded border-slate-300"
              />
              <div className="space-y-1">
                <Label htmlFor="limit" className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5 cursor-pointer">
                  Выручка клуба превысила 20 млн ₽ в год
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-slate-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[250px] leading-relaxed p-3 text-xs bg-slate-900 text-white rounded-lg">
                        В РФ с 2025/2026 года при доходе более 20 млн ₽ в год плательщики УСН обязаны уплачивать НДС (5% на часть УСН). Игровое время на патенте НДС не облагается!
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Label>
                <p className="text-[10px] text-rose-600 font-extrabold leading-relaxed uppercase">
                  Автоматически доначислять 5% НДС на продажи Бара (УСН)
                </p>
              </div>
            </div>

            {/* Combined mode categories selection */}
            {(taxRegime === 'patent_usn6' || taxRegime === 'patent_usn15') && (
              <div className="space-y-2.5">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                  Категории УСН (БАР / КУХНЯ)
                </Label>
                <p className="text-[9px] text-slate-400 font-bold leading-normal">
                  Неотмеченные категории автоматически относятся к Патенту (0% налога).
                </p>
                <div className="grid grid-cols-2 gap-2 max-h-[120px] overflow-y-auto p-3 bg-slate-50 rounded-2xl border border-slate-100 scrollbar-thin">
                  {categories.filter(c => c.type === 'income').map(cat => (
                    <div key={cat.id} className="flex items-center gap-2">
                      <Checkbox 
                        id={`cat-${cat.id}`}
                        checked={usnCategories.includes(cat.id)}
                        onCheckedChange={() => toggleUsnCategory(cat.id)}
                        className="rounded"
                      />
                      <label htmlFor={`cat-${cat.id}`} className="text-xs font-bold text-slate-700 cursor-pointer flex items-center gap-1.5">
                        <span>{cat.icon}</span> {cat.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          <DialogFooter className="gap-2 pt-3 border-t border-slate-100">
            <Button variant="ghost" onClick={() => setIsTaxSettingsOpen(false)} className="rounded-xl font-extrabold text-xs">
              Отмена
            </Button>
            <Button onClick={saveTaxSettings} className="rounded-xl font-extrabold text-xs bg-slate-900 hover:bg-slate-800 text-white px-5">
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal 2: Add Transaction */}
      <Dialog open={isAddTransactionOpen} onOpenChange={setIsAddTransactionOpen}>
        <DialogContent className="rounded-[2rem] max-w-md border border-slate-200 bg-white p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black flex items-center gap-2 text-slate-900 uppercase tracking-tight">
              <Plus className="h-5 w-5 text-slate-900" />
              Внести операцию
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Быстрое создание транзакции расходов, доходов или вывода прибыли.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateTransaction} className="space-y-4 py-3">
            
            {/* Type selection */}
            <div className="grid grid-cols-3 gap-1 bg-slate-50 border p-1 rounded-xl shadow-inner">
              <button 
                type="button" 
                onClick={() => setNewTx(prev => ({ ...prev, type: "expense" }))}
                className={`py-2 text-[10px] font-black rounded-lg uppercase tracking-wider transition-all duration-200 ${newTx.type === 'expense' ? 'bg-white shadow-md text-slate-950 font-black' : 'text-slate-400 hover:text-slate-950'}`}
              >
                💸 Расход
              </button>
              <button 
                type="button" 
                onClick={() => setNewTx(prev => ({ ...prev, type: "income" }))}
                className={`py-2 text-[10px] font-black rounded-lg uppercase tracking-wider transition-all duration-200 ${newTx.type === 'income' ? 'bg-white shadow-md text-slate-950 font-black' : 'text-slate-400 hover:text-slate-950'}`}
              >
                💰 Доход
              </button>
              <button 
                type="button" 
                onClick={() => setNewTx(prev => ({ ...prev, type: "dividend" }))}
                className={`py-2 text-[10px] font-black rounded-lg uppercase tracking-wider transition-all duration-200 ${newTx.type === 'dividend' ? 'bg-white shadow-md text-slate-950 font-black' : 'text-slate-400 hover:text-slate-950'}`}
              >
                💳 Дивиденды
              </button>
            </div>

            {/* Amount & Date */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Сумма (₽)</Label>
                <Input 
                  type="number"
                  value={newTx.amount}
                  onChange={(e) => setNewTx(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="0.00"
                  required
                  className="rounded-xl h-11 border-slate-200"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Дата операции</Label>
                <Input 
                  type="date"
                  value={newTx.transaction_date}
                  onChange={(e) => setNewTx(prev => ({ ...prev, transaction_date: e.target.value }))}
                  required
                  className="rounded-xl h-11 border-slate-200"
                />
              </div>
            </div>

            {/* Account */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Выберите счет списания / начисления</Label>
              <Select 
                value={newTx.account_id} 
                onValueChange={(value) => setNewTx(prev => ({ ...prev, account_id: value }))}
              >
                <SelectTrigger className="rounded-xl h-11 border-slate-200">
                  <SelectValue placeholder="Выберите счет" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {accounts.map(a => (
                    <SelectItem key={a.id} value={a.id.toString()}>{a.icon} {a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category (Hide for dividends) */}
            {newTx.type !== 'dividend' && (
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Категория</Label>
                <Select 
                  value={newTx.category_id} 
                  onValueChange={(value) => setNewTx(prev => ({ ...prev, category_id: value }))}
                >
                  <SelectTrigger className="rounded-xl h-11 border-slate-200">
                    <SelectValue placeholder="Выберите категорию" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {categories.filter(c => c.type === (newTx.type === 'dividend' ? 'expense' : newTx.type)).map(c => (
                      <SelectItem key={c.id} value={c.id.toString()}>{c.icon} {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Comment */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Комментарий</Label>
              <Input 
                value={newTx.notes}
                onChange={(e) => setNewTx(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Заметка к операции"
                className="rounded-xl h-11 border-slate-200"
              />
            </div>

            <DialogFooter className="pt-4 border-t border-slate-100 gap-2">
              <Button type="button" variant="ghost" onClick={() => setIsAddTransactionOpen(false)} className="rounded-xl font-extrabold text-xs">
                Отмена
              </Button>
              <Button type="submit" className="rounded-xl font-extrabold text-xs bg-slate-900 hover:bg-slate-800 text-white px-6">
                Создать
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal 3: Transfer (Инкассация) */}
      <Dialog open={isTransferOpen} onOpenChange={setIsTransferOpen}>
        <DialogContent className="rounded-[2rem] max-w-sm border border-slate-200 bg-white p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black flex items-center gap-2 text-slate-900 uppercase tracking-tight">
              <ArrowRightLeft className="h-5 w-5 text-slate-900" />
              Инкассация / Перевод
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Быстрый перевод средств между счетами клуба.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleTransfer} className="space-y-4 py-3">
            
            {/* From Account */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Откуда списать</Label>
              <Select 
                value={transferData.from_account_id}
                onValueChange={(val) => setTransferData(prev => ({ ...prev, from_account_id: val }))}
              >
                <SelectTrigger className="rounded-xl h-11 border-slate-200">
                  <SelectValue placeholder="Счет списания" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {accounts.map(a => (
                    <SelectItem key={a.id} value={a.id.toString()}>{a.icon} {a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* To Account */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Куда зачислить</Label>
              <Select 
                value={transferData.to_account_id}
                onValueChange={(val) => setTransferData(prev => ({ ...prev, to_account_id: val }))}
              >
                <SelectTrigger className="rounded-xl h-11 border-slate-200">
                  <SelectValue placeholder="Счет зачисления" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {accounts.map(a => (
                    <SelectItem key={a.id} value={a.id.toString()}>{a.icon} {a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Сумма перевода (₽)</Label>
              <Input 
                type="number"
                value={transferData.amount}
                onChange={(e) => setTransferData(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="0.00"
                required
                className="rounded-xl h-11 border-slate-200"
              />
            </div>

            <DialogFooter className="pt-4 border-t border-slate-100 gap-2">
              <Button type="button" variant="ghost" onClick={() => setIsTransferOpen(false)} className="rounded-xl font-extrabold text-xs">
                Отмена
              </Button>
              <Button type="submit" className="rounded-xl font-extrabold text-xs bg-slate-900 hover:bg-slate-800 text-white">
                Перевести
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal 4: Adjust Balance */}
      <Dialog open={isAdjustOpen} onOpenChange={setIsAdjustOpen}>
        <DialogContent className="rounded-[2rem] max-w-sm border border-slate-200 bg-white p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black flex items-center gap-2 text-slate-900 uppercase tracking-tight">
              <Scale className="h-5 w-5 text-slate-900" />
              Сверка кассы
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Укажите фактический баланс. Разница будет автоматически проведена как недостача или излишек.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAdjustBalance} className="space-y-4 py-3">
            
            {/* Account */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Выберите счет</Label>
              <Select 
                value={adjustData.account_id}
                onValueChange={(val) => setAdjustData(prev => ({ ...prev, account_id: val }))}
              >
                <SelectTrigger className="rounded-xl h-11 border-slate-200">
                  <SelectValue placeholder="Выберите счет" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {accounts.map(a => (
                    <SelectItem key={a.id} value={a.id.toString()}>{a.icon} {a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* New Balance */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Фактический остаток (₽)</Label>
              <Input 
                type="number"
                value={adjustData.new_balance}
                onChange={(e) => setAdjustData(prev => ({ ...prev, new_balance: e.target.value }))}
                placeholder="0.00"
                required
                className="rounded-xl h-11 border-slate-200"
              />
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Причина сверки</Label>
              <Input 
                value={adjustData.reason}
                onChange={(e) => setAdjustData(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="Например: Инвентаризация"
                className="rounded-xl h-11 border-slate-200"
              />
            </div>

            <DialogFooter className="pt-4 border-t border-slate-100 gap-2">
              <Button type="button" variant="ghost" onClick={() => setIsAdjustOpen(false)} className="rounded-xl font-extrabold text-xs">
                Отмена
              </Button>
              <Button type="submit" className="rounded-xl font-extrabold text-xs bg-slate-900 hover:bg-slate-800 text-white">
                Выровнять
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal 5: Pay Recurring Bill */}
      <Dialog open={isPayRecurringOpen} onOpenChange={setIsPayRecurringOpen}>
        <DialogContent className="rounded-[2rem] max-w-sm border border-slate-200 bg-white p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black flex items-center gap-2 text-slate-900 uppercase tracking-tight">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              Оплата счета
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Оплатить <strong>{selectedPayBill?.name}</strong> на сумму <strong className="text-slate-900">{formatCurrency(selectedPayBill?.amount || 0)}</strong>
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConfirmPayBill} className="space-y-4 py-3">
            
            {/* Account */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Откуда списать деньги</Label>
              <Select 
                value={payBillData.account_id}
                onValueChange={(val) => setPayBillData(prev => ({ ...prev, account_id: val }))}
              >
                <SelectTrigger className="rounded-xl h-11 border-slate-200">
                  <SelectValue placeholder="Выберите счет" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {accounts.map(a => (
                    <SelectItem key={a.id} value={a.id.toString()}>{a.icon} {a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Заметка к платежу</Label>
              <Input 
                value={payBillData.notes}
                onChange={(e) => setPayBillData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Необязательно"
                className="rounded-xl h-11 border-slate-200"
              />
            </div>

            <DialogFooter className="pt-4 border-t border-slate-100 gap-2">
              <Button type="button" variant="ghost" onClick={() => setIsPayRecurringOpen(false)} className="rounded-xl font-extrabold text-xs">
                Отмена
              </Button>
              <Button type="submit" className="rounded-xl font-extrabold text-xs bg-slate-900 hover:bg-slate-800 text-white px-6">
                Оплатить
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal 6: Pay Credit */}
      <Dialog open={isPayCreditOpen} onOpenChange={setIsPayCreditOpen}>
        <DialogContent className="rounded-[2rem] max-w-sm border border-slate-200 bg-white p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black flex items-center gap-2 text-slate-900 uppercase tracking-tight">
              <Banknote className="h-5 w-5 text-slate-900" />
              Оплата кредита
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Выплата по займу <strong>{selectedPayCredit?.name}</strong>. Долг: <strong className="text-slate-900">{formatCurrency(selectedPayCredit?.remaining_amount || 0)}</strong>
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConfirmPayCredit} className="space-y-4 py-3">
            
            {/* Account */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Откуда списать деньги</Label>
              <Select 
                value={payCreditData.account_id}
                onValueChange={(val) => setPayCreditData(prev => ({ ...prev, account_id: val }))}
              >
                <SelectTrigger className="rounded-xl h-11 border-slate-200">
                  <SelectValue placeholder="Выберите счет" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {accounts.map(a => (
                    <SelectItem key={a.id} value={a.id.toString()}>{a.icon} {a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Principal & Interest */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Тело долга (₽)</Label>
                <Input 
                  type="number"
                  value={payCreditData.principal_amount}
                  onChange={(e) => setPayCreditData(prev => ({ ...prev, principal_amount: e.target.value }))}
                  required
                  className="rounded-xl h-11 border-slate-200"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Проценты (₽)</Label>
                <Input 
                  type="number"
                  value={payCreditData.interest_amount}
                  onChange={(e) => setPayCreditData(prev => ({ ...prev, interest_amount: e.target.value }))}
                  className="rounded-xl h-11 border-slate-200"
                />
              </div>
            </div>

            <div className="text-[10px] font-extrabold text-slate-500 bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between shadow-inner">
              <span>Сумма к списанию:</span>
              <span className="text-slate-950 font-black text-sm">{formatCurrency(parseFloat(payCreditData.principal_amount || "0") + parseFloat(payCreditData.interest_amount || "0"))}</span>
            </div>

            <DialogFooter className="pt-4 border-t border-slate-100 gap-2">
              <Button type="button" variant="ghost" onClick={() => setIsPayCreditOpen(false)} className="rounded-xl font-extrabold text-xs">
                Отмена
              </Button>
              <Button type="submit" className="rounded-xl font-extrabold text-xs bg-slate-900 hover:bg-slate-800 text-white px-6">
                Провести платеж
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  )
}
