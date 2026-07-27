"use client"

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { PageShell } from '@/components/layout/PageShell'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Settings, Filter, Plus } from "lucide-react"

import { FinanceOverview } from './_components/FinanceOverview'
import { FinancePaymentCalendar } from './_components/FinancePaymentCalendar'
import { FinanceTransactionsTable } from './_components/FinanceTransactionsTable'
import { FinanceDDSReport } from './_components/FinanceDDSReport'

export default function FinancePage() {
  const params = useParams()
  const clubId = params?.clubId as string

  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [periodMode, setPeriodMode] = useState<"month" | "all">("month")

  // Data states
  const [analytics, setAnalytics] = useState<any>(null)
  const [accounts, setAccounts] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])

  // Modal state
  const [isTaxModalOpen, setIsTaxModalOpen] = useState(false)

  const monthNames = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ]

  const startDateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
  const lastDay = new Date(selectedYear, selectedMonth, 0).getDate()
  const endDateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${lastDay}`

  useEffect(() => {
    if (clubId) {
      fetchData(true)
    }
  }, [clubId, selectedMonth, selectedYear, periodMode])

  const fetchData = async (isInitial = false) => {
    if (isInitial || !analytics) {
      setLoading(true)
    }
    try {
      const dateParams = periodMode === "all"
        ? `start_date=all`
        : `start_date=${startDateStr}&end_date=${endDateStr}`

      const [analyticsRes, accountsRes, categoriesRes, txRes] = await Promise.all([
        fetch(`/api/clubs/${clubId}/finance/analytics?${dateParams}`),
        fetch(`/api/clubs/${clubId}/finance/accounts`),
        fetch(`/api/clubs/${clubId}/finance/categories`),
        fetch(`/api/clubs/${clubId}/finance/transactions?${dateParams}&limit=1000`)
      ])

      if (analyticsRes.ok) {
        const data = await analyticsRes.json()
        setAnalytics(data)
      }

      if (accountsRes.ok) {
        const data = await accountsRes.json()
        setAccounts(data.accounts || [])
      }

      if (categoriesRes.ok) {
        const data = await categoriesRes.json()
        setCategories(data.categories || [])
      }

      if (txRes.ok) {
        const data = await txRes.json()
        setTransactions(data.transactions || [])
      }
    } catch (error) {
      console.error('Error fetching finance data:', error)
    } finally {
      setLoading(false)
    }
  }

  const navigateMonth = (direction: number) => {
    setPeriodMode("month")
    let newMonth = selectedMonth + direction
    let newYear = selectedYear
    if (newMonth > 12) { newMonth = 1; newYear++ }
    else if (newMonth < 1) { newMonth = 12; newYear-- }
    setSelectedMonth(newMonth)
    setSelectedYear(newYear)
  }

  if (loading && !analytics) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground font-medium">Загрузка финансовых данных...</p>
        </div>
      </div>
    )
  }

  return (
    <PageShell maxWidth="5xl">
      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div className="space-y-0.5">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 truncate">
            Финансы
          </h1>
          <p className="text-slate-500 text-xs md:text-sm font-medium">
            Управленческий учет (P&L), движения денег (ДДС) и налоги
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Period Mode Selector */}
          <Select
            value={periodMode}
            onValueChange={(val: "month" | "all") => setPeriodMode(val)}
          >
            <SelectTrigger className="w-[140px] rounded-xl border-slate-200 bg-white h-10 text-xs font-semibold text-slate-700 shadow-xs">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="month">По месяцам</SelectItem>
              <SelectItem value="all">За всё время</SelectItem>
            </SelectContent>
          </Select>

          {/* Month Selector */}
          {periodMode === "month" && (
            <div className="flex items-center bg-white rounded-xl shadow-xs border border-slate-200 h-10 px-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigateMonth(-1)}
                className="hover:bg-slate-100 rounded-lg h-8 w-8 text-slate-600"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-1.5 px-2 font-bold text-slate-800 text-xs whitespace-nowrap">
                <CalendarIcon className="h-3.5 w-3.5 text-slate-500" />
                <span>
                  {monthNames[selectedMonth - 1]} {selectedYear}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigateMonth(1)}
                className="hover:bg-slate-100 rounded-lg h-8 w-8 text-slate-600"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          <Link href={`/clubs/${clubId}/finance/settings`}>
            <Button
              variant="outline"
              className="rounded-xl border-slate-200 bg-white hover:bg-slate-50 font-semibold text-slate-700 h-10 px-3.5 text-xs shadow-xs"
            >
              <Settings className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
              Настройки
            </Button>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex items-center gap-4 sm:gap-6 border-b border-slate-200 w-full mb-6 bg-transparent p-0 rounded-none h-auto overflow-x-auto justify-start scrollbar-none whitespace-nowrap">
          <TabsTrigger
            value="overview"
            className="pb-3 text-xs md:text-sm font-semibold text-slate-500 hover:text-slate-900 border-b-2 border-transparent data-[state=active]:border-slate-900 data-[state=active]:text-slate-900 rounded-none bg-transparent shadow-none px-1 transition-all"
          >
            Обзор и P&L
          </TabsTrigger>
          <TabsTrigger
            value="calendar"
            className="pb-3 text-xs md:text-sm font-semibold text-slate-500 hover:text-slate-900 border-b-2 border-transparent data-[state=active]:border-slate-900 data-[state=active]:text-slate-900 rounded-none bg-transparent shadow-none px-1 transition-all"
          >
            Календарь платежей
          </TabsTrigger>
          <TabsTrigger
            value="transactions"
            className="pb-3 text-xs md:text-sm font-semibold text-slate-500 hover:text-slate-900 border-b-2 border-transparent data-[state=active]:border-slate-900 data-[state=active]:text-slate-900 rounded-none bg-transparent shadow-none px-1 transition-all"
          >
            Операции
          </TabsTrigger>
          <TabsTrigger
            value="dds"
            className="pb-3 text-xs md:text-sm font-semibold text-slate-500 hover:text-slate-900 border-b-2 border-transparent data-[state=active]:border-slate-900 data-[state=active]:text-slate-900 rounded-none bg-transparent shadow-none px-1 transition-all"
          >
            Отчет ДДС
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="focus-visible:outline-none">
          <FinanceOverview
            analytics={analytics}
            accounts={accounts}
            onOpenTaxSettings={() => setIsTaxModalOpen(true)}
          />
        </TabsContent>

        <TabsContent value="calendar" className="focus-visible:outline-none">
          <FinancePaymentCalendar
            clubId={clubId}
            accounts={accounts}
            categories={categories}
            transactions={transactions}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            onRefresh={fetchData}
          />
        </TabsContent>

        <TabsContent value="transactions" className="focus-visible:outline-none">
          <FinanceTransactionsTable
            clubId={clubId}
            transactions={transactions}
            categories={categories}
            accounts={accounts}
            onRefresh={fetchData}
          />
        </TabsContent>

        <TabsContent value="dds" className="focus-visible:outline-none">
          <FinanceDDSReport ddsData={analytics?.dds_breakdown} />
        </TabsContent>
      </Tabs>
    </PageShell>
  )
}
