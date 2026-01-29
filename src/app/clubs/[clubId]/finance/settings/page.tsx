"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Save, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface Account {
    id: number
    name: string
    icon: string
    color: string
    account_type: string
}

interface IncomeField {
    metric_key: string
    custom_label: string
    account_id?: number
}

export default function FinanceSettingsPage({ params }: { params: Promise<{ clubId: string }> }) {
    const router = useRouter()
    const [clubId, setClubId] = useState('')
    const [accounts, setAccounts] = useState<Account[]>([])
    const [incomeFields, setIncomeFields] = useState<IncomeField[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        params.then(p => {
            setClubId(p.clubId)
            fetchData(p.clubId)
        })
    }, [params])

    const fetchData = async (id: string) => {
        try {
            // Get current template and accounts
            const res = await fetch(`/api/clubs/${id}/settings/reports`)
            const data = await res.json()

            if (res.ok) {
                setAccounts(data.accounts || [])

                // Extract INCOME fields from template
                if (data.currentTemplate?.schema) {
                    const fields = data.currentTemplate.schema
                        .filter((f: any) => f.field_type === 'INCOME')
                        .map((f: any) => ({
                            metric_key: f.metric_key,
                            custom_label: f.custom_label || f.metric_key,
                            account_id: f.account_id
                        }))
                    setIncomeFields(fields)
                }
            }
        } catch (error) {
            console.error('Error fetching data:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleAccountChange = (fieldKey: string, accountId: string) => {
        setIncomeFields(fields =>
            fields.map(f =>
                f.metric_key === fieldKey
                    ? { ...f, account_id: parseInt(accountId) }
                    : f
            )
        )
    }

    const handleSave = async () => {
        setIsSaving(true)
        try {
            // Get full current template
            const res = await fetch(`/api/clubs/${clubId}/settings/reports`)
            const data = await res.json()

            if (!data.currentTemplate) {
                alert('Сначала настройте шаблон отчёта')
                return
            }

            // Update account_id in schema for income fields
            const updatedSchema = data.currentTemplate.schema.map((field: any) => {
                const incomeField = incomeFields.find(f => f.metric_key === field.metric_key)
                if (incomeField) {
                    return { ...field, account_id: incomeField.account_id }
                }
                return field
            })

            // Save back
            const saveRes = await fetch(`/api/clubs/${clubId}/settings/reports`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ schema: updatedSchema })
            })

            if (saveRes.ok) {
                alert('✅ Маппинг сохранён!')
                router.refresh()
            } else {
                alert('❌ Ошибка сохранения')
            }
        } catch (error) {
            console.error('Error saving:', error)
            alert('❌ Ошибка сохранения')
        } finally {
            setIsSaving(false)
        }
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <Link
                        href={`/clubs/${clubId}/finance`}
                        className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Назад к финансам
                    </Link>
                    <h1 className="text-3xl font-bold">Настройки финансов</h1>
                </div>
            </div>

            <Tabs defaultValue="mapping" className="w-full">
                <TabsList>
                    <TabsTrigger value="mapping">Маппинг счетов</TabsTrigger>
                </TabsList>

                <TabsContent value="mapping" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Маппинг полей на счета</CardTitle>
                            <CardDescription>
                                Укажите, на какой счёт зачислять деньги по каждому полю дохода из отчётов
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {incomeFields.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <p>Нет полей дохода в шаблоне отчёта</p>
                                    <Link
                                        href={`/clubs/${clubId}/settings/reports`}
                                        className="text-primary underline mt-2 inline-block"
                                    >
                                        Настроить шаблон отчёта →
                                    </Link>
                                </div>
                            ) : (
                                <>
                                    <div className="grid gap-4">
                                        {incomeFields.map((field) => (
                                            <div
                                                key={field.metric_key}
                                                className="flex items-center justify-between p-4 border rounded-lg"
                                            >
                                                <div className="flex-1">
                                                    <div className="font-medium">{field.custom_label}</div>
                                                    <div className="text-sm text-muted-foreground">
                                                        {field.metric_key}
                                                    </div>
                                                </div>

                                                <div className="w-64">
                                                    <Select
                                                        value={field.account_id?.toString() || ''}
                                                        onValueChange={(value) =>
                                                            handleAccountChange(field.metric_key, value)
                                                        }
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Выберите счёт" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {accounts.map((account) => (
                                                                <SelectItem
                                                                    key={account.id}
                                                                    value={account.id.toString()}
                                                                >
                                                                    {account.icon} {account.name}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex justify-end pt-4 border-t">
                                        <Button onClick={handleSave} disabled={isSaving}>
                                            {isSaving ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    Сохранение...
                                                </>
                                            ) : (
                                                <>
                                                    <Save className="mr-2 h-4 w-4" />
                                                    Сохранить маппинг
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
