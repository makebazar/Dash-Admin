"use client"

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Download, Eye, AlertCircle, CheckCircle2, DollarSign } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface RevenueImportProps {
    clubId: string
}

interface ImportResult {
    preview: boolean
    imported_count: number
    transaction_ids: number[]
    total_cash: number
    total_card: number
    total_sbp: number
    total_revenue: number
    shifts_processed: number
    skipped_count: number
    skipped_reasons: string[]
}

export default function RevenueImport({ clubId }: RevenueImportProps) {
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<ImportResult | null>(null)

    const handleImport = async (preview: boolean) => {
        if (!startDate || !endDate) {
            alert('Выберите даты начала и окончания периода')
            return
        }

        setLoading(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/finance/import/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ start_date: startDate, end_date: endDate, preview })
            })

            const data = await res.json()

            if (res.ok) {
                setResult(data)
                if (!preview && data.imported_count > 0) {
                    alert(`✅ Успешно импортировано ${data.imported_count} транзакций!`)
                }
            } else {
                alert(`❌ Ошибка: ${data.error}`)
            }
        } catch (error) {
            console.error('Import error:', error)
            alert('❌ Не удалось выполнить импорт')
        } finally {
            setLoading(false)
        }
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('ru-RU', {
            maximumFractionDigits: 0
        }).format(amount) + ' ₽'
    }

    const setCurrentMonth = () => {
        const now = new Date()
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)

        setStartDate(firstDay.toISOString().split('T')[0])
        setEndDate(lastDay.toISOString().split('T')[0])
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div>
                <h3 className="text-lg font-semibold">Импорт выручки из смен</h3>
                <p className="text-sm text-muted-foreground">
                    Автоматический импорт доходов с разделением по методам оплаты
                </p>
            </div>

            {/* Controls */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Выберите период</CardTitle>
                    <CardDescription>
                        Импорт выручки из закрытых смен за указанный период
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <Label>Дата начала</Label>
                            <Input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        <div>
                            <Label>Дата окончания</Label>
                            <Input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                        <div className="flex items-end">
                            <Button
                                variant="outline"
                                onClick={setCurrentMonth}
                                className="w-full"
                            >
                                Текущий месяц
                            </Button>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={() => handleImport(true)}
                            disabled={loading || !startDate || !endDate}
                        >
                            <Eye className="h-4 w-4 mr-2" />
                            Предпросмотр
                        </Button>
                        <Button
                            onClick={() => handleImport(false)}
                            disabled={loading || !startDate || !endDate}
                        >
                            <Download className="h-4 w-4 mr-2" />
                            {loading ? 'Импортируем...' : 'Импортировать'}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Results */}
            {result && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            {result.preview ? (
                                <>
                                    <Eye className="h-5 w-5 text-blue-600" />
                                    Предпросмотр импорта
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                                    Результаты импорта
                                </>
                            )}
                        </CardTitle>
                        {result.preview && (
                            <CardDescription>
                                Это предпросмотр. Транзакции не были созданы.
                            </CardDescription>
                        )}
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Summary */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                                <div className="text-xs text-emerald-700 mb-1">Транзакций</div>
                                <div className="text-xl font-bold text-emerald-900">
                                    {result.imported_count}
                                </div>
                            </div>

                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                <div className="text-xs text-blue-700 mb-1">💵 Наличные</div>
                                <div className="text-lg font-bold text-blue-900">
                                    {formatCurrency(result.total_cash)}
                                </div>
                            </div>

                            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                                <div className="text-xs text-purple-700 mb-1">💳 Безнал</div>
                                <div className="text-lg font-bold text-purple-900">
                                    {formatCurrency(result.total_card)}
                                </div>
                            </div>

                            {result.total_sbp > 0 && (
                                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                                    <div className="text-xs text-orange-700 mb-1">📱 СБП</div>
                                    <div className="text-lg font-bold text-orange-900">
                                        {formatCurrency(result.total_sbp)}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Total Revenue */}
                        <div className="bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-300 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <DollarSign className="h-5 w-5 text-emerald-700" />
                                    <span className="font-medium text-emerald-900">Общая выручка</span>
                                </div>
                                <span className="text-2xl font-bold text-emerald-900">
                                    {formatCurrency(result.total_revenue)}
                                </span>
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="flex gap-4 text-sm">
                            <Badge variant="outline">
                                Смен обработано: {result.shifts_processed}
                            </Badge>
                            {result.skipped_count > 0 && (
                                <Badge variant="secondary">
                                    Пропущено: {result.skipped_count}
                                </Badge>
                            )}
                        </div>

                        {/* Skipped reasons */}
                        {result.skipped_reasons.length > 0 && (
                            <div className="mt-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <AlertCircle className="h-4 w-4 text-orange-600" />
                                    <span className="text-sm font-medium text-orange-900">
                                        Пропущенные смены:
                                    </span>
                                </div>
                                <div className="space-y-1">
                                    {result.skipped_reasons.map((reason, idx) => (
                                        <div key={idx} className="text-sm text-muted-foreground pl-6">
                                            • {reason}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Preview reminder */}
                        {result.preview && result.imported_count > 0 && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
                                <p className="text-sm text-blue-900">
                                    💡 Нажмите "Импортировать" чтобы создать {result.imported_count} транзакций
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
