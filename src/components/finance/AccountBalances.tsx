'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

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
            case 'bank': return 'Банк'
            case 'card': return 'Терминал'
            default: return 'Прочие'
        }
    }

    if (loading) {
        return (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[1, 2, 3, 4].map(i => (
                    <Card key={i} className="animate-pulse">
                        <CardHeader className="pb-2">
                            <div className="h-4 bg-gray-200 rounded w-20"></div>
                        </CardHeader>
                        <CardContent>
                            <div className="h-8 bg-gray-200 rounded w-32"></div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Total Balance Card */}
            <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                        💰 Общий баланс
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold text-primary">
                        {formatCurrency(total)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                        Across {balances.reduce((sum, b) => sum + b.account_count, 0)} accounts
                    </p>
                </CardContent>
            </Card>

            {/* Account Type Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {balances.map(balance => {
                    const mainAccount = balance.accounts[0]
                    return (
                        <Card key={balance.account_type}>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                    <span className="text-lg">{mainAccount?.icon || '💰'}</span>
                                    {getAccountTypeLabel(balance.account_type)}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {formatCurrency(balance.total_balance)}
                                </div>
                                {balance.account_count > 1 && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {balance.account_count} счетов
                                    </p>
                                )}

                                {/* Show individual accounts if multiple */}
                                {balance.account_count > 1 && (
                                    <div className="mt-3 space-y-1">
                                        {balance.accounts.map(account => (
                                            <div key={account.id} className="text-xs flex justify-between items-center py-1 border-t">
                                                <span className="text-muted-foreground truncate flex-1">
                                                    {account.name}
                                                </span>
                                                <span className="font-medium ml-2">
                                                    {formatCurrency(account.balance)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )
                })}
            </div>
        </div>
    )
}
