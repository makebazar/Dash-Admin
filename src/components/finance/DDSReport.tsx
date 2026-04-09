"use client"

import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table"
import { DollarSign, Wallet, ArrowUpRight, Info } from "lucide-react"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

const UITooltip = Tooltip

interface DDSData {
    operating: { income: number; expense: number; net: number }
    investing: { income: number; expense: number; net: number }
    financing: { income: number; expense: number; net: number }
}

interface DDSReportProps {
    data: DDSData
    formatCurrency: (amount: number) => string
}

export default function DDSReport({ data, formatCurrency }: DDSReportProps) {
    const totalNet = data.operating.net + data.investing.net + data.financing.net

    const sections = [
        {
            title: "Операционная деятельность",
            description: "Основная выручка клуба, закупки товаров, зарплаты и аренда",
            icon: <Wallet className="h-6 w-6 text-blue-600" />,
            data: data.operating,
            color: "blue"
        },
        {
            title: "Инвестиционная деятельность",
            description: "Приобретение оборудования, капитальный ремонт и модернизация",
            icon: <ArrowUpRight className="h-6 w-6 text-amber-600" />,
            data: data.investing,
            color: "amber"
        },
        {
            title: "Финансовая деятельность",
            description: "Кредиты, займы, инвестиции и распределение прибыли",
            icon: <DollarSign className="h-6 w-6 text-emerald-600" />,
            data: data.financing,
            color: "emerald"
        }
    ]

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 sm:p-8 pb-8 border-b border-slate-100">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Движение денежных средств</h2>
                            <p className="text-sm font-medium text-slate-500 mt-2">
                                Классификация потоков по международным стандартам финансовой отчетности
                            </p>
                        </div>
                        <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl shadow-slate-200 min-w-[240px] relative overflow-hidden group">
                            <div className="absolute -right-4 -top-4 w-20 h-20 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-all" />
                            <div className="relative z-10">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Чистый денежный поток</p>
                                <div className={`text-3xl font-black tracking-tight ${totalNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {formatCurrency(totalNet)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div>
                    <TooltipProvider>
                        <div className="divide-y divide-slate-50">
                            {sections.map((section, idx) => (
                                <div key={idx} className="p-8 hover:bg-slate-50/30 transition-colors">
                                    <div className="flex flex-col md:flex-row gap-8">
                                        <div className="md:w-1/3 space-y-3">
                                            <div className={`w-12 h-12 rounded-2xl bg-${section.color}-50 flex items-center justify-center shadow-inner`}>
                                                {section.icon}
                                            </div>
                                            <div>
                                                <h4 className="font-black text-lg text-slate-900">{section.title}</h4>
                                                <p className="text-xs font-medium text-slate-500 leading-relaxed">{section.description}</p>
                                            </div>
                                        </div>
                                        
                                        <div className="md:w-2/3">
                                            <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm relative group">
                                                <UITooltip>
                                                    <TooltipTrigger asChild>
                                                        <div className="absolute right-4 top-4 text-slate-300 hover:text-primary cursor-help transition-colors">
                                                            <Info className="h-4 w-4" />
                                                        </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="left" className="max-w-[200px] p-3 leading-relaxed">
                                                        {idx === 0 ? "Операционка: сколько клуб зарабатывает и тратит на жизнь каждый день." : 
                                                         idx === 1 ? "Инвестиции: траты на «железо» и ремонт, которые окупятся в будущем." : 
                                                         "Финансы: кредиты, личные вложения или вывод прибыли владельцами."}
                                                    </TooltipContent>
                                                </UITooltip>
                                                <Table>
                                                    <TableBody>
                                                        <TableRow className="hover:bg-transparent border-none">
                                                            <TableCell className="py-4 px-6 text-sm font-bold text-slate-600">Поступления (Inflow)</TableCell>
                                                            <TableCell className="text-right py-4 px-6 text-emerald-600 font-black">
                                                                + {formatCurrency(section.data.income)}
                                                            </TableCell>
                                                        </TableRow>
                                                        <TableRow className="hover:bg-transparent border-none">
                                                            <TableCell className="py-4 px-6 text-sm font-bold text-slate-600">Платежи (Outflow)</TableCell>
                                                            <TableCell className="text-right py-4 px-6 text-rose-600 font-black">
                                                                - {formatCurrency(section.data.expense)}
                                                            </TableCell>
                                                        </TableRow>
                                                        <TableRow className="bg-slate-50/80 hover:bg-slate-50/80 border-t border-slate-100">
                                                            <TableCell className="py-4 px-6 text-sm font-black text-slate-900">Чистый поток по разделу</TableCell>
                                                            <TableCell className={`text-right py-4 px-6 text-lg font-black ${section.data.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                                {formatCurrency(section.data.net)}
                                                            </TableCell>
                                                        </TableRow>
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </TooltipProvider>

                    <div className="p-8 bg-slate-900 text-white">
                        <div className="flex justify-between items-center">
                            <div className="space-y-1">
                                <div className="text-xl font-black tracking-tight">ИТОГО Чистый денежный поток</div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Суммарное изменение остатков на всех счетах за период</p>
                            </div>
                            <div className={`text-4xl font-black tracking-tighter ${totalNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {formatCurrency(totalNet)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Guide / FAQ Section for beginners */}
            <div className="grid gap-6 md:grid-cols-2">
                <div className="bg-blue-50/50 rounded-3xl p-6 sm:p-8 border border-blue-100 shadow-sm">
                    <h4 className="text-sm font-black text-blue-900 flex items-center gap-2 mb-3 uppercase tracking-tight">
                        <Info className="h-4 w-4" /> Как читать этот отчет?
                    </h4>
                    <ul className="space-y-3">
                        <li className="flex gap-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                            <p className="text-xs text-blue-800 leading-relaxed">
                                <strong>Чистый поток</strong> — это реальная разница между пришедшими и ушедшими деньгами. Если он плюс — денег стало больше.
                            </p>
                        </li>
                        <li className="flex gap-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                            <p className="text-xs text-blue-800 leading-relaxed">
                                <strong>Inflow</strong> — все поступления. <strong>Outflow</strong> — все траты.
                            </p>
                        </li>
                    </ul>
                </div>

                <div className="bg-emerald-50/50 rounded-3xl p-6 sm:p-8 border border-emerald-100 shadow-sm">
                    <h4 className="text-sm font-black text-emerald-900 flex items-center gap-2 mb-3 uppercase tracking-tight">
                        💡 Совет по анализу
                    </h4>
                    <p className="text-xs text-emerald-800 leading-relaxed">
                        Ваша главная цель — чтобы <strong>Операционная деятельность</strong> всегда была в плюсе. Именно из неё вы должны покупать новые ПК (Инвестиции) и забирать прибыль (Финансы). Если операционка в минусе — клуб проедает свои запасы или кредиты.
                    </p>
                </div>
            </div>
        </div>
    )
}
