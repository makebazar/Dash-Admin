import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Save, ArrowLeft, Plus, Trash2, Edit2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface Account {
    id: number
    name: string
    icon: string
    color: string
    account_type: string
    balance?: number
}

interface IncomeField {
    metric_key: string
    custom_label: string
    account_id?: number
}

const ACCOUNT_TYPES = [
    { value: 'cash', label: 'Наличные' },
    { value: 'bank', label: 'Банк' },
    { value: 'terminal', label: 'Терминал' },
    { value: 'other', label: 'Другое' }
]

const ACCOUNT_ICONS = ['💰', '🏦', '💳', '📱', '🏪', '💵', '💴', '🪙']
const ACCOUNT_COLORS = ['bg-green-500', 'bg-blue-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500', 'bg-cyan-500']

export default function FinanceSettingsPage({ params }: { params: Promise<{ clubId: string }> }) {
    const router = useRouter()
    const [clubId, setClubId] = useState('')
    const [accounts, setAccounts] = useState<Account[]>([])
    const [incomeFields, setIncomeFields] = useState<IncomeField[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)

    // New account form
    const [showNewAccountForm, setShowNewAccountForm] = useState(false)
    const [newAccount, setNewAccount] = useState({
        name: '',
        icon: '💰',
        color: 'bg-green-500',
        account_type: 'cash'
    })

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

    const handleCreateAccount = async () => {
        if (!newAccount.name.trim()) {
            alert('Введите название счёта')
            return
        }

        setIsSaving(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/finance/accounts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newAccount)
            })

            if (res.ok) {
                await fetchData(clubId)
                setShowNewAccountForm(false)
                setNewAccount({ name: '', icon: '💰', color: 'bg-green-500', account_type: 'cash' })
            } else {
                alert('❌ Ошибка создания счёта')
            }
        } catch (error) {
            console.error('Error creating account:', error)
            alert('❌ Ошибка создания счёта')
        } finally {
            setIsSaving(false)
        }
    }

    const handleDeleteAccount = async (accountId: number) => {
        if (!confirm('Удалить этот счёт?')) return

        setIsSaving(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/finance/accounts`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ account_id: accountId })
            })

            if (res.ok) {
                await fetchData(clubId)
            } else {
                const data = await res.json()
                alert(data.error || '❌ Ошибка удаления')
            }
        } catch (error) {
            console.error('Error deleting account:', error)
            alert('❌ Ошибка удаления счёта')
        } finally {
            setIsSaving(false)
        }
    }

    const handleSaveMapping = async () => {
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

            <Tabs defaultValue="accounts" className="w-full">
                <TabsList>
                    <TabsTrigger value="accounts">Счета</TabsTrigger>
                    <TabsTrigger value="mapping">Маппинг счетов</TabsTrigger>
                </TabsList>

                {/* Accounts Tab */}
                <TabsContent value="accounts" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Управление счетами</CardTitle>
                                    <CardDescription>
                                        Создавайте и управляйте счетами для учёта денег
                                    </CardDescription>
                                </div>
                                <Button onClick={() => setShowNewAccountForm(!showNewAccountForm)}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Новый счёт
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* New Account Form */}
                            {showNewAccountForm && (
                                <Card className="border-2 border-primary">
                                    <CardHeader>
                                        <CardTitle className="text-lg">Создать новый счёт</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div>
                                            <Label>Название счёта</Label>
                                            <Input
                                                value={newAccount.name}
                                                onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                                                placeholder="Например: Сбербанк"
                                            />
                                        </div>

                                        <div>
                                            <Label>Тип счёта</Label>
                                            <Select
                                                value={newAccount.account_type}
                                                onValueChange={(value) => setNewAccount({ ...newAccount, account_type: value })}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {ACCOUNT_TYPES.map(type => (
                                                        <SelectItem key={type.value} value={type.value}>
                                                            {type.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div>
                                            <Label>Иконка</Label>
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {ACCOUNT_ICONS.map(icon => (
                                                    <button
                                                        key={icon}
                                                        onClick={() => setNewAccount({ ...newAccount, icon })}
                                                        className={`text-2xl p-2 rounded border-2 ${newAccount.icon === icon ? 'border-primary' : 'border-transparent'
                                                            }`}
                                                    >
                                                        {icon}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <Label>Цвет</Label>
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {ACCOUNT_COLORS.map(color => (
                                                    <button
                                                        key={color}
                                                        onClick={() => setNewAccount({ ...newAccount, color })}
                                                        className={`w-8 h-8 rounded border-2 ${color} ${newAccount.color === color ? 'border-foreground' : 'border-transparent'
                                                            }`}
                                                    />
                                                ))}
                                            </div>
                                        </div>

                                        <div className="flex gap-2 pt-2">
                                            <Button onClick={handleCreateAccount} disabled={isSaving}>
                                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Создать'}
                                            </Button>
                                            <Button variant="outline" onClick={() => setShowNewAccountForm(false)}>
                                                Отмена
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Accounts List */}
                            <div className="grid gap-4">
                                {accounts.map((account) => (
                                    <div
                                        key={account.id}
                                        className="flex items-center justify-between p-4 border rounded-lg"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`text-3xl p-3 rounded ${account.color}`}>
                                                {account.icon}
                                            </div>
                                            <div>
                                                <div className="font-medium">{account.name}</div>
                                                <div className="text-sm text-muted-foreground">
                                                    {ACCOUNT_TYPES.find(t => t.value === account.account_type)?.label}
                                                </div>
                                            </div>
                                        </div>

                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDeleteAccount(account.id)}
                                        >
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

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
                                        <Button onClick={handleSaveMapping} disabled={isSaving}>
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
