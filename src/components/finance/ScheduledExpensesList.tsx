"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { DollarSign, Calendar, Clock, CheckCircle2, AlertCircle, Trash2 } from "lucide-react"
import PayExpenseDialog from './PayExpenseDialog'

interface ScheduledExpense {
    id: number
    name: string
    category_name: string
    category_icon: string
    category_color: string
    amount: number
    amount_paid: number
    due_date: string
    status: 'unpaid' | 'partial' | 'paid' | 'cancelled'
    description: string
}

interface ScheduledExpensesListProps {
    clubId: string
}

export default function ScheduledExpensesList({ clubId }: ScheduledExpensesListProps) {
    const [expenses, setExpenses] = useState<ScheduledExpense[]>([])
    const [loading, setLoading] = useState(true)
    const [isPayDialogOpen, setIsPayDialogOpen] = useState(false)
    const [selectedExpense, setSelectedExpense] = useState<ScheduledExpense | null>(null)

    useEffect(() => {
        fetchExpenses()
    }, [clubId])

    const fetchExpenses = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/finance/scheduled`)
            const data = await res.json()
            setExpenses(data.scheduled_expenses || [])
        } catch (error) {
            console.error('Failed to fetch scheduled expenses:', error)
        } finally {
            setLoading(false)
        }
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('ru-RU').format(amount) + ' ₽'
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'paid':
                return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100"><CheckCircle2 className="w-3 h-3 mr-1" /> Оплачено</Badge>
            case 'partial':
                return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100"><Clock className="w-3 h-3 mr-1" /> Частично</Badge>
            case 'cancelled':
                return <Badge variant="secondary">Отменено</Badge>
            default:
                return <Badge variant="outline" className="text-muted-foreground"><AlertCircle className="w-3 h-3 mr-1" /> Не оплачено</Badge>
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-semibold">Запланированные расходы</h3>
                    <p className="text-sm text-muted-foreground">
                        Отслеживание оплаты постоянных платежей
                    </p>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {loading ? (
                    <div className="col-span-full text-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                        <p className="text-muted-foreground">Загрузка расходов...</p>
                    </div>
                ) : expenses.length === 0 ? (
                    <Card className="col-span-full py-12 text-center text-muted-foreground">
                        <Calendar className="h-12 w-12 mx-auto mb-2 opacity-20" />
                        <p>Нет запланированных расходов</p>
                        <p className="text-xs">Сгенерируйте их из повторяющихся платежей</p>
                    </Card>
                ) : (
                    expenses.map((expense) => {
                        const paidPercentage = (expense.amount_paid / expense.amount) * 100
                        const remaining = expense.amount - expense.amount_paid

                        return (
                            <Card key={expense.id} className="relative overflow-hidden">
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="w-10 h-10 rounded-lg flex items-center justify-center text-2xl"
                                                style={{ backgroundColor: expense.category_color + '20' }}
                                            >
                                                {expense.category_icon}
                                            </div>
                                            <div>
                                                <CardTitle className="text-sm font-bold">{expense.name}</CardTitle>
                                                <CardDescription className="text-xs">
                                                    {new Date(expense.due_date).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
                                                </CardDescription>
                                            </div>
                                        </div>
                                        {getStatusBadge(expense.status)}
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex justify-between items-end">
                                        <div>
                                            <p className="text-xs text-muted-foreground mb-1">Общая сумма</p>
                                            <p className="text-xl font-bold">{formatCurrency(expense.amount)}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-muted-foreground mb-1">Оплачено</p>
                                            <p className="text-sm font-medium text-emerald-600">{formatCurrency(expense.amount_paid)}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <div className="flex justify-between text-[10px] text-muted-foreground">
                                            <span>Прогресс</span>
                                            <span>{Math.round(paidPercentage)}%</span>
                                        </div>
                                        <Progress value={paidPercentage} className="h-2" />
                                    </div>

                                    <div className="flex gap-2 pt-2">
                                        {expense.status !== 'paid' && (
                                            <Button
                                                className="flex-1"
                                                onClick={() => {
                                                    setSelectedExpense(expense)
                                                    setIsPayDialogOpen(true)
                                                }}
                                            >
                                                <DollarSign className="w-4 h-4 mr-2" />
                                                Оплатить
                                            </Button>
                                        )}
                                        {expense.status === 'paid' && (
                                            <Button variant="outline" className="flex-1" disabled>
                                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                                Полностью оплачено
                                            </Button>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })
                )}
            </div>

            <PayExpenseDialog
                isOpen={isPayDialogOpen}
                onOpenChange={setIsPayDialogOpen}
                expense={selectedExpense ? {
                    id: selectedExpense.id,
                    name: selectedExpense.name,
                    amount: selectedExpense.amount,
                    amount_paid: selectedExpense.amount_paid
                } : null}
                clubId={clubId}
                onSuccess={fetchExpenses}
            />
        </div>
    )
}
