"use client"

import { TrendingUp, TrendingDown, ShieldCheck } from "lucide-react"

interface FinanceDDSReportProps {
  ddsData: {
    operating: { income: number; expense: number; net: number }
    investing: { income: number; expense: number; net: number }
    financing: { income: number; expense: number; net: number }
  }
}

const formatMoney = (amount: number) => {
  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 0
  }).format(amount) + ' ₽'
}

export function FinanceDDSReport({ ddsData }: FinanceDDSReportProps) {
  const dds = ddsData || {
    operating: { income: 0, expense: 0, net: 0 },
    investing: { income: 0, expense: 0, net: 0 },
    financing: { income: 0, expense: 0, net: 0 },
  }

  const totalNetCashFlow = dds.operating.net + dds.investing.net + dds.financing.net

  const sections = [
    {
      title: "1. Операционная деятельность",
      desc: "Выручка смени и ПК, закупка товара бара, зарплата персонала, коммуналка",
      data: dds.operating,
    },
    {
      title: "2. Инвестиционная деятельность",
      desc: "Покупка и модернизация компьютерного железа, ремонт помещений, закупка оборудования",
      data: dds.investing,
    },
    {
      title: "3. Финансовая деятельность",
      desc: "Кредиты, займы, уплата процентов и выплаты дивидендов собственникам",
      data: dds.financing,
    }
  ]

  return (
    <div className="space-y-6">
      {/* Informational banner in Native Style */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-5 space-y-1">
        <div className="flex items-center gap-1.5 text-slate-700 font-bold text-sm">
          <ShieldCheck className="h-4.5 w-4.5 text-emerald-600" />
          Отчет Движения Денежных Средств (ДДС / Cash Flow)
        </div>
        <p className="text-xs text-slate-500 max-w-3xl">
          Отчет ДДС отражает реальный приход и отход денег по счетам. В отличие от отчета о прибылях (P&L), ДДС учитывает перемещение денежных средств, выплаты дивидендов и инвестиции в железо.
        </p>
      </div>

      {/* Cashflow Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        {sections.map((sec, idx) => (
          <div key={idx} className="bg-white border border-slate-200/80 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-xs">
            <div>
              <div className="pb-3 border-b border-slate-100">
                <h4 className="font-bold text-sm text-slate-900">{sec.title}</h4>
                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">{sec.desc}</p>
              </div>

              <div className="space-y-2 text-xs mt-3">
                <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <span className="text-slate-500 flex items-center gap-1">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-600" /> Приход:
                  </span>
                  <span className="font-bold text-slate-900">{formatMoney(sec.data.income)}</span>
                </div>

                <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <span className="text-slate-500 flex items-center gap-1">
                    <TrendingDown className="h-3.5 w-3.5 text-rose-600" /> Расход:
                  </span>
                  <span className="font-bold text-slate-900">{formatMoney(sec.data.expense)}</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Чистый поток</span>
              <span className={`text-sm font-bold ${sec.data.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {sec.data.net >= 0 ? '+' : ''}{formatMoney(sec.data.net)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Summary Total Card */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-5 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h4 className="text-sm font-bold text-slate-900">Итоговое изменение остатка денег (Net Cash Flow)</h4>
          <p className="text-xs text-slate-500 mt-0.5">Фактическое изменение суммы всех доступных средств клуба за выбранный период</p>
        </div>
        <span className={`text-2xl font-bold ${totalNetCashFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
          {totalNetCashFlow >= 0 ? '+' : ''}{formatMoney(totalNetCashFlow)}
        </span>
      </div>
    </div>
  )
}
