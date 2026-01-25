"use client"

import { useEffect, useState } from "react"
import { Sidebar } from "@/components/layout/Sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Check, Moon, Sun } from "lucide-react"
import { cn } from "@/lib/utils"

const PLANS = [
    {
        id: 'starter',
        name: 'Стартовый',
        price: '2,900₽',
        features: ['До 3 клубов', 'До 20 ПК на клуб', 'Базовая отчетность']
    },
    {
        id: 'pro',
        name: 'Про',
        price: '7,900₽',
        popular: true,
        features: ['До 10 клубов', 'До 50 ПК на клуб', 'Расширенная аналитика', 'Приоритетная поддержка']
    },
    {
        id: 'enterprise',
        name: 'Энтерпрайз',
        price: '19,900₽',
        features: ['Безлимит клубов', 'Безлимит ПК', 'Выделенная поддержка', 'Кастомные интеграции']
    }
]

export default function SettingsPage() {
    const [currentPlan, setCurrentPlan] = useState('starter')
    const [theme, setTheme] = useState<'dark' | 'light'>('dark')
    const [fullName, setFullName] = useState('')
    const [phoneNumber, setPhoneNumber] = useState('')
    const [isSaving, setIsSaving] = useState(false)
    const [hasPassword, setHasPassword] = useState(false)
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [isSettingPassword, setIsSettingPassword] = useState(false)

    useEffect(() => {
        fetchProfile()
    }, [])

    const fetchProfile = async () => {
        try {
            const res = await fetch('/api/profile')
            const data = await res.json()

            if (res.ok) {
                setFullName(data.user.full_name || '')
                setPhoneNumber(data.user.phone_number || '')
                setCurrentPlan(data.user.subscription_plan || 'starter')
                setHasPassword(data.user.hasPassword || false)
            }
        } catch (error) {
            console.error('Error fetching profile:', error)
        }
    }

    const handleSaveProfile = async () => {
        setIsSaving(true)
        try {
            const res = await fetch('/api/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ full_name: fullName }),
            })

            if (res.ok) {
                alert('Профиль успешно обновлен!')
            } else {
                alert('Ошибка обновления профиля')
            }
        } catch (error) {
            console.error('Error saving profile:', error)
            alert('Ошибка сохранения')
        } finally {
            setIsSaving(false)
        }
    }

    const handleSetPassword = async () => {
        if (newPassword !== confirmPassword) {
            alert('Пароли не совпадают')
            return
        }

        if (newPassword.length < 6) {
            alert('Пароль должен быть не менее 6 символов')
            return
        }

        setIsSettingPassword(true)
        try {
            const res = await fetch('/api/auth/set-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    password: newPassword,
                    confirm_password: confirmPassword
                }),
            })

            if (res.ok) {
                alert('Пароль успешно установлен!')
                setHasPassword(true)
                setNewPassword('')
                setConfirmPassword('')
            } else {
                const data = await res.json()
                alert(data.error || 'Ошибка установки пароля')
            }
        } catch (error) {
            console.error('Error setting password:', error)
            alert('Ошибка сохранения')
        } finally {
            setIsSettingPassword(false)
        }
    }

    const toggleTheme = () => {
        const newTheme = theme === 'dark' ? 'light' : 'dark'
        setTheme(newTheme)
        document.documentElement.classList.toggle('dark')
    }

    return (
        <div className="flex min-h-screen bg-background">
            <Sidebar clubs={[]} />

            <main className="ml-64 flex-1 p-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold tracking-tight">Настройки</h1>
                    <p className="text-muted-foreground">
                        Управление аккаунтом и подпиской
                    </p>
                </div>

                <div className="space-y-6">
                    {/* Profile Section */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Профиль</CardTitle>
                            <CardDescription>
                                Информация о вашем аккаунте
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Имя</Label>
                                    <Input
                                        id="name"
                                        placeholder="Введите ваше имя"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="phone">Телефон</Label>
                                    <Input
                                        id="phone"
                                        value={phoneNumber}
                                        disabled
                                    />
                                </div>
                            </div>
                            <Button onClick={handleSaveProfile} disabled={isSaving}>
                                {isSaving ? 'Сохранение...' : 'Сохранить изменения'}
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Subscription Section */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Подписка</CardTitle>
                            <CardDescription>
                                Управление тарифным планом для всех ваших клубов
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="mb-6 rounded-lg border border-border bg-muted p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-semibold">Текущий тариф</p>
                                        <p className="text-2xl font-bold">
                                            {PLANS.find(p => p.id === currentPlan)?.name}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm text-muted-foreground">Стоимость</p>
                                        <p className="text-2xl font-bold">
                                            {PLANS.find(p => p.id === currentPlan)?.price}
                                            <span className="text-sm font-normal text-muted-foreground">/мес</span>
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold">Доступные тарифы</h3>
                                <div className="grid gap-4 md:grid-cols-3">
                                    {PLANS.map((plan) => (
                                        <div
                                            key={plan.id}
                                            className={cn(
                                                "relative rounded-lg border p-6 transition-all cursor-pointer",
                                                currentPlan === plan.id
                                                    ? "border-primary bg-accent"
                                                    : "border-border hover:border-primary/50"
                                            )}
                                            onClick={() => setCurrentPlan(plan.id)}
                                        >
                                            {plan.popular && (
                                                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">
                                                    ПОПУЛЯРНЫЙ
                                                </span>
                                            )}
                                            {currentPlan === plan.id && (
                                                <div className="absolute right-4 top-4">
                                                    <Check className="h-5 w-5 text-primary" />
                                                </div>
                                            )}
                                            <h4 className="mb-2 text-xl font-bold">{plan.name}</h4>
                                            <p className="mb-4 text-3xl font-bold">
                                                {plan.price}
                                                <span className="text-sm font-normal text-muted-foreground">/мес</span>
                                            </p>
                                            <ul className="space-y-2">
                                                {plan.features.map((feature, i) => (
                                                    <li key={i} className="flex items-center text-sm">
                                                        <Check className="mr-2 h-4 w-4 text-green-500" />
                                                        {feature}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    ))}
                                </div>
                                <Button className="w-full md:w-auto">Изменить тариф</Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Security Section */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Безопасность</CardTitle>
                            <CardDescription>
                                Управление паролем для быстpого входа
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {!hasPassword ? (
                                <div className="space-y-4">
                                    <p className="text-sm text-muted-foreground">
                                        Установите пароль для быстрого входа без ожидания SMS
                                    </p>
                                    <div className="space-y-3">
                                        <div className="space-y-2">
                                            <Label htmlFor="newPassword">Новый пароль</Label>
                                            <Input
                                                id="newPassword"
                                                type="password"
                                                placeholder="Минимум 6 символов"
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="confirmPassword">Повторите пароль</Label>
                                            <Input
                                                id="confirmPassword"
                                                type="password"
                                                placeholder="Повторите пароль"
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <Button onClick={handleSetPassword} disabled={isSettingPassword}>
                                        {isSettingPassword ? 'Установка...' : 'Установить пароль'}
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2">
                                        <Check className="h-5 w-5 text-green-500" />
                                        <p className="text-sm font-medium">Пароль установлен</p>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        Вы можете войти используя номер телефона и пароль
                                    </p>
                                    <Button variant="outline" onClick={() => setHasPassword(false)}>
                                        Изменить пароль
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Appearance Section */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Внешний вид</CardTitle>
                            <CardDescription>
                                Настройка темы оформления
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium">Тема</p>
                                    <p className="text-sm text-muted-foreground">
                                        {theme === 'dark' ? 'Темная' : 'Светлая'}
                                    </p>
                                </div>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={toggleTheme}
                                >
                                    {theme === 'dark' ? (
                                        <Sun className="h-5 w-5" />
                                    ) : (
                                        <Moon className="h-5 w-5" />
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    )
}
