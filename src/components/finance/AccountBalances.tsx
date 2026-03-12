'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { Info } from "lucide-react"

interface Account {
    id: number
    name: string
    balance: number
    icon: string
    color: string
}

interface AccountBalance {
    account_type: string
    total_balance: number
    account_count: number
    accounts: Account[]
}

interface AccountBalancesProps {
    clubId: string
}

export function AccountBalances({ clubId }: AccountBalancesProps) {
    const [balances, setBalances] = useState<AccountBalance[]>([])
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchBalances()
    }, [clubId])

    const fetchBalances = async () => {
        try {
            const res = await fetch(`/api/clubs/${clubId}/finance/accounts/balance`)
            const data = await res.json()
            setBalances(data.balances || [])
            setTotal(data.total || 0)
        } catch (error) {
            console.error('Failed to fetch account balances:', error)
        } finally {
            setLoading(false)
        }
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('ru-RU', {
            maximumFractionDigits: 0
        }).format(amount) + ' ₽'
    }

    const getAccountTypeLabel = (type: string) => {
        switch (type) {
            case 'cash': return 'Наличные'
            case 'bank': return 'Банковский счет'
            case 'card': return 'Эквайринг'
            default: return 'Прочие'
        }
    }

    if (loading) {
        return (
            <div className="space-y-3">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-20 bg-slate-100 animate-pulse rounded-2xl" />
                ))}
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Total Balance Compact */}
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className="p-5 rounded-2xl bg-slate-900 text-white shadow-lg shadow-slate-200 relative overflow-hidden group cursor-help">
                            <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-all duration-500" />
                            <div className="relative z-10">
                                <div className="flex items-center gap-2 mb-1">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Суммарный капитал</p>
                                    <Info className="h-3 w-3 text-slate-600" />
                                </div>
                                <div className="text-3xl font-black tracking-tight">
                                    {formatCurrency(total)}
                                </div>
                            </div>
                        </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[200px] p-3">
                        Общая сумма денег на всех активных счетах клуба (наличные + безнал + банк).
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>

            {/* Account Type List */}
            <div className="space-y-3">
                {balances.map(balance => {
                    const mainAccount = balance.accounts[0]
                    return (
                        <div key={balance.account_type} className="p-4 rounded-2xl bg-white border border-slate-100 hover:border-primary/20 transition-all shadow-sm group">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-xl shadow-inner group-hover:bg-primary/5 transition-colors">
                                        {mainAccount?.icon || '💰'}
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">{getAccountTypeLabel(balance.account_type)}</p>
                                        <p className="text-lg font-black text-slate-900 leading-none mt-0.5">{formatCurrency(balance.total_balance)}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Individual accounts list - always show if exists */}
                            <div className="space-y-1.5">
                                {balance.accounts.map(account => (
                                    <div key={account.id} className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                                        <span className="text-[11px] font-bold text-slate-500 truncate max-w-[120px]">
                                            {account.name}
                                        </span>
                                        <span className="text-[11px] font-black text-slate-700">
                                            {formatCurrency(account.balance)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
