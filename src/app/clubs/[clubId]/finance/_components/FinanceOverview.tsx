"use client"

interface FinanceOverviewProps {
  analytics: any
  accounts: any[]
  onOpenTaxSettings: () => void
}

const formatMoney = (amount: number) => {
  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 0
  }).format(amount) + ' ₽'
}

export function FinanceOverview({
  analytics,
  accounts,
  onOpenTaxSettings
}: FinanceOverviewProps) {
  const summary = analytics?.summary || {
    total_income: 0,
    total_expense: 0,
    profit: 0,
    calculated_tax: 0,
    net_profit: 0,
    tax_base_text: '',
    profitability: 0
  }

  const topExpenses = analytics?.top_expenses || []

  // Bar COGS & Sales calculations
  const barIncome = parseFloat(summary.bar_sales || 0)
  const barCogs = parseFloat(summary.bar_cogs || 0)
  const barGrossMargin = parseFloat(summary.bar_gross_margin || 0)
  const barMarginPercent = summary.bar_margin_percent || 0

  return (
    <div className="space-y-6">

      {/* Summary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Revenue Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between h-full min-h-[150px] shadow-xs">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Выручка
            </p>
            <p className="text-3xl font-bold text-emerald-600 tracking-tight whitespace-nowrap">
              {formatMoney(summary.total_income)}
            </p>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100 mt-4">
            <span>Операционная выручка</span>
            <span className="font-semibold text-slate-900">{summary.income_count || 0} приходов</span>
          </div>
        </div>

        {/* 2. Expenses Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between h-full min-h-[150px] shadow-xs">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Расходы
            </p>
            <p className="text-3xl font-bold text-slate-900 tracking-tight whitespace-nowrap">
              {formatMoney(summary.total_expense)}
            </p>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100 mt-4">
            <span>Операционные издержки</span>
            <span className="font-semibold text-slate-900">{summary.expense_count || 0} расходов</span>
          </div>
        </div>

        {/* 3. Operating Profit Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between h-full min-h-[150px] shadow-xs">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Операционная прибыль
            </p>
            <p className="text-3xl font-bold text-slate-900 tracking-tight whitespace-nowrap">
              {formatMoney(summary.profit)}
            </p>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100 mt-4">
            <span>Рентабельность</span>
            <span className="font-semibold text-slate-900">{summary.profitability}%</span>
          </div>
        </div>

        {/* 4. Net Profit Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between h-full min-h-[150px] shadow-xs">
          <div>
            <div className="flex justify-between items-center mb-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Чистая прибыль
              </p>
              <span className="text-[11px] font-semibold text-emerald-600">
                P&L итог
              </span>
            </div>
            <p className="text-3xl font-bold text-emerald-600 tracking-tight whitespace-nowrap">
              {formatMoney(summary.net_profit)}
            </p>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100 mt-4">
            <span>Расчетный налог</span>
            <span className="font-semibold text-rose-600">-{formatMoney(summary.calculated_tax)}</span>
          </div>
        </div>
      </div>

      {/* Bar Margin & Account Balances Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Margin Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-2">
              <span className="font-bold text-base text-slate-900">Маржинальность Бара</span>
              <span className="text-xs font-semibold text-purple-600">
                Маржа {barMarginPercent}%
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              <div className="py-3 flex justify-between items-center">
                <span className="text-xs text-slate-500 font-medium">Выручка Бара</span>
                <span className="text-sm font-bold text-slate-900">{formatMoney(barIncome)}</span>
              </div>

              <div className="py-3 flex justify-between items-center">
                <span className="text-xs text-slate-500 font-medium">Себестоимость товара (COGS)</span>
                <span className="text-sm font-bold text-rose-600">-{formatMoney(barCogs)}</span>
              </div>

              <div className="py-3 flex justify-between items-center">
                <span className="text-xs text-slate-500 font-medium">Валовая прибыль бара</span>
                <span className="text-sm font-bold text-emerald-600">{formatMoney(barGrossMargin)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Account Balances Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-2">
              <span className="font-bold text-base text-slate-900">Остатки на счетах</span>
              <span className="text-xs font-semibold text-slate-500">
                {accounts.length} счета
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {accounts.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">Счета не добавлены</p>
              ) : (
                accounts.map((acc) => (
                  <div key={acc.id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-xs text-slate-900">{acc.name}</p>
                      <p className="text-[11px] text-slate-400">{acc.account_type === 'cash' ? 'Касса' : 'Банковский счет'}</p>
                    </div>
                    <span className="font-bold text-sm text-slate-900">
                      {formatMoney(parseFloat(acc.current_balance || 0))}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Top Expense Categories */}
      {topExpenses.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
          <div className="pb-4 border-b border-slate-100 mb-4">
            <span className="font-bold text-base text-slate-900">Топ статей расходов</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {topExpenses.map((exp: any, idx: number) => (
              <div key={idx} className="p-3 border border-slate-100 rounded-xl bg-slate-50/50">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 truncate">{exp.category_name}</p>
                <p className="text-base font-bold text-slate-900 mt-1">{formatMoney(exp.total_amount)}</p>
                <p className="text-xs text-slate-500 mt-0.5">{exp.transaction_count} операций</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
