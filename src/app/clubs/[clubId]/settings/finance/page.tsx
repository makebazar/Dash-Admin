'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Trash2, Plus, Check, X } from 'lucide-react'

interface PaymentMethod {
    id: number
    code: string
    label: string
    icon: string
    color: string
    is_system: boolean
}

interface Account {
    id: number
    name: string
    icon: string
    color: string
}

interface Mapping {
    id: number
    payment_method_id: number
    payment_method_label: string
    payment_method_icon: string
    is_system: boolean
    account_id: number
    account_name: string
}

export default function FinanceSettingsPage() {
    const params = useParams()
    const clubId = params.clubId as string

    const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
    const [accounts, setAccounts] = useState<Account[]>([])
    const [mappings, setMappings] = useState<Mapping[]>([])
    const [loading, setLoading] = useState(true)

    // Add payment method form
    const [showAddForm, setShowAddForm] = useState(false)
    const [newMethod, setNewMethod] = useState({ code: '', label: '', icon: '💰', color: '#3b82f6' })

    useEffect(() => {
        fetchData()
    }, [clubId])

    const fetchData = async () => {
        setLoading(true)
        try {
            const [methodsRes, accountsRes, mappingsRes] = await Promise.all([
                fetch(`/api/clubs/${clubId}/settings/finance/payment-methods`),
                fetch(`/api/clubs/${clubId}/finance/accounts`),
                fetch(`/api/clubs/${clubId}/settings/finance/mappings`)
            ])

            const methodsData = await methodsRes.json()
            const accountsData = await accountsRes.json()
            const mappingsData = await mappingsRes.json()

            setPaymentMethods(methodsData.payment_methods || [])
            setAccounts(accountsData.accounts || [])
            setMappings(mappingsData.mappings || [])
        } catch (error) {
            console.error('Failed to fetch data:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleAddPaymentMethod = async () => {
        if (!newMethod.code || !newMethod.label) {
            alert('Код и название обязательны')
            return
        }

        try {
            const res = await fetch(`/api/clubs/${clubId}/settings/finance/payment-methods`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newMethod)
            })

            if (res.ok) {
                setShowAddForm(false)
                setNewMethod({ code: '', label: '', icon: '💰', color: '#3b82f6' })
                fetchData()
            } else {
                const error = await res.json()
                alert(error.error || 'Ошибка создания')
            }
        } catch (error) {
            console.error('Failed to add payment method:', error)
        }
    }

    const handleDeletePaymentMethod = async (id: number, isSystem: boolean) => {
        if (isSystem) {
            alert('Системные способы оплаты нельзя удалить')
            return
        }

        if (!confirm('Удалить способ оплаты?')) return

        try {
            const res = await fetch(`/api/clubs/${clubId}/settings/finance/payment-methods?id=${id}`, {
                method: 'DELETE'
            })

            if (res.ok) {
                fetchData()
            }
        } catch (error) {
            console.error('Failed to delete payment method:', error)
        }
    }

    const handleUpdateMapping = async (paymentMethodId: number, accountId: number) => {
        const updatedMappings = mappings.map(m =>
            m.payment_method_id === paymentMethodId
                ? { ...m, account_id: accountId }
                : m
        )
        setMappings(updatedMappings)
    }

    const handleSaveMappings = async () => {
        try {
            const payload = mappings.map(m => ({
                payment_method_id: m.payment_method_id,
                account_id: m.account_id
            }))

            const res = await fetch(`/api/clubs/${clubId}/settings/finance/mappings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mappings: payload })
            })

            if (res.ok) {
                alert('✅ Маппинги сохранены')
                fetchData()
            }
        } catch (error) {
            console.error('Failed to save mappings:', error)
        }
    }

    if (loading) {
        return <div className="p-8">Загрузка...</div>
    }

    return (
        <div className="p-8">
            <h1 className="text-3xl font-bold mb-6">Настройки финансов</h1>

            <Tabs defaultValue="methods">
                <TabsList>
                    <TabsTrigger value="methods">Способы оплаты</TabsTrigger>
                    <TabsTrigger value="mappings">Маппинг счетов</TabsTrigger>
                </TabsList>

                {/* TAB 1: Payment Methods */}
                <TabsContent value="methods">
                    <Card>
                        <CardHeader>
                            <CardTitle>Управление способами оплаты</CardTitle>
                            <CardDescription>
                                Системные методы (Наличные, Карта) нельзя удалить. Вы можете создать кастомные методы (СБП, Криптовалюта, и т.д.)
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* System methods */}
                            <div>
                                <h3 className="text-sm font-semibold text-muted-foreground mb-2">Системные</h3>
                                {paymentMethods.filter(m => m.is_system).map(method => (
                                    <div key={method.id} className="flex items-center gap-4 p-3 border rounded-lg mb-2">
                                        <span className="text-2xl">{method.icon}</span>
                                        <div className="flex-1">
                                            <div className="font-medium">{method.label}</div>
                                            <div className="text-xs text-muted-foreground">{method.code}</div>
                                        </div>
                                        <span className="text-xs bg-gray-100 px-2 py-1 rounded">Системный</span>
                                    </div>
                                ))}
                            </div>

                            {/* Custom methods */}
                            <div>
                                <h3 className="text-sm font-semibold text-muted-foreground mb-2">Кастомные</h3>
                                {paymentMethods.filter(m => !m.is_system).map(method => (
                                    <div key={method.id} className="flex items-center gap-4 p-3 border rounded-lg mb-2">
                                        <span className="text-2xl">{method.icon}</span>
                                        <div className="flex-1">
                                            <div className="font-medium">{method.label}</div>
                                            <div className="text-xs text-muted-foreground">{method.code}</div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDeletePaymentMethod(method.id, method.is_system)}
                                        >
                                            <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                    </div>
                                ))}

                                {paymentMethods.filter(m => !m.is_system).length === 0 && (
                                    <div className="text-sm text-muted-foreground italic">Нет кастомных методов</div>
                                )}
                            </div>

                            {/* Add new method */}
                            {!showAddForm ? (
                                <Button onClick={() => setShowAddForm(true)} variant="outline" className="w-full">
                                    <Plus className="h-4 w-4 mr-2" />
                                    Добавить способ оплаты
                                </Button>
                            ) : (
                                <div className="border rounded-lg p-4 space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <Label>Код (англ.)</Label>
                                            <Input
                                                value={newMethod.code}
                                                onChange={(e) => setNewMethod({ ...newMethod, code: e.target.value.toLowerCase().replace(/\s/g, '_') })}
                                                placeholder="sbp"
                                            />
                                        </div>
                                        <div>
                                            <Label>Название</Label>
                                            <Input
                                                value={newMethod.label}
                                                onChange={(e) => setNewMethod({ ...newMethod, label: e.target.value })}
                                                placeholder="СБП"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <Label>Иконка</Label>
                                            <Input
                                                value={newMethod.icon}
                                                onChange={(e) => setNewMethod({ ...newMethod, icon: e.target.value })}
                                                placeholder="📱"
                                            />
                                        </div>
                                        <div>
                                            <Label>Цвет</Label>
                                            <Input
                                                type="color"
                                                value={newMethod.color}
                                                onChange={(e) => setNewMethod({ ...newMethod, color: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button onClick={handleAddPaymentMethod} size="sm">
                                            <Check className="h-4 w-4 mr-2" />
                                            Создать
                                        </Button>
                                        <Button onClick={() => setShowAddForm(false)} variant="ghost" size="sm">
                                            <X className="h-4 w-4 mr-2" />
                                            Отмена
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* TAB 2: Mappings */}
                <TabsContent value="mappings">
                    <Card>
                        <CardHeader>
                            <CardTitle>Маппинг: Способ оплаты → Счёт</CardTitle>
                            <CardDescription>
                                Настройте на какой счёт должны зачисляться деньги для каждого способа оплаты
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {mappings.map(mapping => (
                                <div key={mapping.payment_method_id} className="flex items-center gap-4 p-3 border rounded-lg">
                                    <span className="text-2xl">{mapping.payment_method_icon}</span>
                                    <div className="flex-1">
                                        <div className="font-medium">{mapping.payment_method_label}</div>
                                    </div>
                                    <div className="w-48">
                                        <Select
                                            value={mapping.account_id?.toString()}
                                            onValueChange={(value) =>
                                                handleUpdateMapping(mapping.payment_method_id, parseInt(value))
                                            }
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {accounts.map(account => (
                                                    <SelectItem key={account.id} value={account.id.toString()}>
                                                        {account.icon} {account.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            ))}

                            <Button onClick={handleSaveMappings} className="w-full">
                                Сохранить маппинг
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
