"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { PageShell } from "@/components/layout/PageShell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2 } from "lucide-react"

type ShiftPlanRow = {
  date: string
  dow: number
  shift_type: "DAY" | "NIGHT"
  target_revenue: number
  fact_revenue: number
}

type MonthTarget = {
  target_revenue: number
  history_weeks: number
  updated_at: string
} | null

type ApiResponse = {
  month: number
  year: number
  timeZone: string
  month_target: MonthTarget
  rows: ShiftPlanRow[]
}

const formatCurrency = (value: number) => {
  const v = Number.isFinite(value) ? value : 0
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(v)
}

const dowLabel = (dow: number) => {
  const labels = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"]
  return labels[dow] || String(dow)
}

export default function SalesPlanPage() {
  const params = useParams()
  const clubId = String(params.clubId || "")

  const now = new Date()
  const [month, setMonth] = useState<number>(now.getMonth() + 1)
  const [year, setYear] = useState<number>(now.getFullYear())
  const [targetRevenue, setTargetRevenue] = useState<string>("")
  const [historyWeeks, setHistoryWeeks] = useState<string>("8")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [data, setData] = useState<ApiResponse | null>(null)

  const fetchData = async (m: number, y: number) => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/clubs/${clubId}/sales-plan?month=${m}&year=${y}`)
      const json = (await res.json()) as ApiResponse
      if (!res.ok) throw new Error((json as any)?.error || "Ошибка загрузки")
      setData(json)
      if (json.month_target) {
        setTargetRevenue(String(json.month_target.target_revenue || 0))
        setHistoryWeeks(String(json.month_target.history_weeks || 8))
      }
    } catch (e: any) {
      console.error(e)
      alert(e?.message || "Ошибка загрузки")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!clubId) return
    fetchData(month, year)
  }, [clubId])

  const summary = useMemo(() => {
    const rows = data?.rows || []
    const plan = rows.reduce((sum, r) => sum + Number(r.target_revenue || 0), 0)
    const fact = rows.reduce((sum, r) => sum + Number(r.fact_revenue || 0), 0)
    const diff = fact - plan
    const percent = plan > 0 ? (fact / plan) * 100 : 0
    return { plan, fact, diff, percent }
  }, [data])

  const onReload = async () => {
    await fetchData(month, year)
  }

  const onRecalc = async () => {
    const target = Number(targetRevenue)
    const weeks = Number(historyWeeks)
    if (!Number.isFinite(target) || target < 0) return alert("Некорректная цель")
    if (!Number.isFinite(weeks) || weeks < 1 || weeks > 26) return alert("Некорректная история (1–26 недель)")

    setIsSaving(true)
    try {
      const res = await fetch(`/api/clubs/${clubId}/sales-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month,
          year,
          target_revenue: target,
          history_weeks: weeks,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "Ошибка пересчёта")
      await fetchData(month, year)
    } catch (e: any) {
      console.error(e)
      alert(e?.message || "Ошибка пересчёта")
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          <p className="text-sm font-medium text-slate-500 animate-pulse">Загрузка плана...</p>
        </div>
      </div>
    )
  }

  return (
    <PageShell maxWidth="6xl">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between mb-12">
        <div className="space-y-3">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900">План продаж</h1>
          <p className="text-slate-500 text-lg">DAY/NIGHT по календарю месяца</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-xl h-12" onClick={onReload}>
            Обновить
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-10">
        <div className="bg-white rounded-3xl border border-slate-200 p-6">
          <div className="text-xs font-bold uppercase tracking-widest text-slate-500">План</div>
          <div className="text-3xl font-semibold text-slate-900 mt-2">{formatCurrency(summary.plan)}</div>
        </div>
        <div className="bg-white rounded-3xl border border-slate-200 p-6">
          <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Факт</div>
          <div className="text-3xl font-semibold text-slate-900 mt-2">{formatCurrency(summary.fact)}</div>
        </div>
        <div className="bg-white rounded-3xl border border-slate-200 p-6">
          <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Выполнение</div>
          <div className="text-3xl font-semibold text-slate-900 mt-2">
            {Number.isFinite(summary.percent) ? `${summary.percent.toFixed(1)}%` : "0%"}
          </div>
          <div className="text-xs font-medium text-slate-500 mt-1">{formatCurrency(summary.diff)}</div>
        </div>
      </div>

      <Card className="rounded-3xl border-slate-200 mb-8">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Параметры</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid gap-4 md:grid-cols-5 items-end">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Месяц</Label>
              <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
                <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }).map((_, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>
                      {i + 1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Год</Label>
              <Input
                className="h-10 rounded-xl border-slate-200 bg-white"
                value={String(year)}
                onChange={e => setYear(Number(e.target.value))}
                inputMode="numeric"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Цель на месяц</Label>
              <Input
                className="h-10 rounded-xl border-slate-200 bg-white"
                value={targetRevenue}
                onChange={e => setTargetRevenue(e.target.value)}
                inputMode="numeric"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">История (недель)</Label>
              <Select value={historyWeeks} onValueChange={setHistoryWeeks}>
                <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="4">4</SelectItem>
                  <SelectItem value="8">8</SelectItem>
                  <SelectItem value="12">12</SelectItem>
                  <SelectItem value="16">16</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              className="h-10 rounded-xl bg-slate-900 text-white hover:bg-slate-800"
              onClick={onRecalc}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Считаю...
                </>
              ) : (
                "Пересчитать"
              )}
            </Button>
          </div>

          <div className="mt-3 text-xs font-medium text-slate-500">
            Таймзона клуба: {data?.timeZone || "Europe/Moscow"}
          </div>
        </CardContent>
      </Card>

      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow className="hover:bg-transparent border-slate-100">
              <TableHead className="text-xs font-bold uppercase tracking-widest text-slate-500 py-4">Дата</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-widest text-slate-500 py-4">День</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-widest text-slate-500 py-4">Смена</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-widest text-slate-500 py-4 text-right">План</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-widest text-slate-500 py-4 text-right">Факт</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-widest text-slate-500 py-4 text-right">% </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.rows || []).map((r, idx) => {
              const plan = Number(r.target_revenue || 0)
              const fact = Number(r.fact_revenue || 0)
              const pct = plan > 0 ? (fact / plan) * 100 : 0
              return (
                <TableRow key={`${r.date}-${r.shift_type}-${idx}`} className="hover:bg-slate-50/50 border-slate-100">
                  <TableCell className="py-4 font-medium text-slate-900">{r.date}</TableCell>
                  <TableCell className="py-4 text-slate-600">{dowLabel(r.dow)}</TableCell>
                  <TableCell className="py-4 text-slate-600">{r.shift_type === "NIGHT" ? "Ночь" : "День"}</TableCell>
                  <TableCell className="py-4 text-right font-medium text-slate-900">{formatCurrency(plan)}</TableCell>
                  <TableCell className="py-4 text-right font-medium text-slate-900">{formatCurrency(fact)}</TableCell>
                  <TableCell className="py-4 text-right text-slate-600">{plan > 0 ? `${pct.toFixed(1)}%` : "—"}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </PageShell>
  )
}

