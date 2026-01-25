"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Zap, Check, Building2, CreditCard, Loader2, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

const PLANS = [
    {
        id: 'starter',
        name: 'Стартовый',
        price: '2900₽',
        features: ['До 20 ПК', 'Базовая отчетность', '1 Админ']
    },
    {
        id: 'pro',
        name: 'Про',
        price: '7900₽',
        popular: true,
        features: ['До 50 ПК', 'Продвинутый расчет ЗП', 'Учет склада Lite', '3 Админа']
    },
    {
        id: 'enterprise',
        name: 'Энтерпрайз',
        price: '19900₽',
        features: ['Безлимит ПК', 'Выделенная поддержка', 'Кастомные интеграции', 'Безлимит Админов']
    }
]

export default function OnboardingPage() {
    const router = useRouter()
    const [step, setStep] = useState<'plan' | 'club'>('plan')
    const [selectedPlan, setSelectedPlan] = useState<string | null>('pro')
    const [clubName, setClubName] = useState('')
    const [address, setAddress] = useState('')
    const [isLoading, setIsLoading] = useState(false)

    const handleCreateClub = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        try {
            const res = await fetch('/api/clubs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: clubName,
                    address,
                    subscription: selectedPlan
                }),
            })
            const data = await res.json()


            if (data.success) {
                router.push(`/clubs/${data.clubId}`) // Redirect to newly created club
            } else {
                alert(data.error || 'Не удалось создать клуб')
            }
        } catch (err) {
            console.error(err)
            alert('Ошибка создания клуба')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-black text-white p-6">
            <header className="max-w-6xl mx-auto flex items-center justify-between py-6">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-tr from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
                        <Zap className="text-white w-5 h-5 fill-current" />
                    </div>
                    <span className="font-bold text-xl tracking-tight">DashAdmin Настройка</span>
                </div>
                <div className="text-sm text-gray-500">
                    Шаг {step === 'plan' ? '1' : '2'} из 2
                </div>
            </header>

            <main className="max-w-4xl mx-auto mt-10">
                {step === 'plan' ? (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="text-center">
                            <h1 className="text-3xl font-bold mb-2">Выберите тариф</h1>
                            <p className="text-gray-400">Масштабируйте бизнес с правильными инструментами.</p>
                        </div>

                        <div className="grid md:grid-cols-3 gap-6">
                            {PLANS.map((plan) => (
                                <div
                                    key={plan.id}
                                    onClick={() => setSelectedPlan(plan.id)}
                                    className={cn(
                                        "cursor-pointer rounded-2xl border p-6 transition-all relative",
                                        selectedPlan === plan.id
                                            ? "bg-white/10 border-purple-500 ring-1 ring-purple-500"
                                            : "bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/[0.07]"
                                    )}
                                >
                                    {plan.popular && (
                                        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                                            ПОПУЛЯРНЫЙ
                                        </span>
                                    )}
                                    <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                                    <div className="text-3xl font-bold mb-6">{plan.price}<span className="text-sm font-normal text-gray-400">/мес</span></div>
                                    <ul className="space-y-3 mb-8">
                                        {plan.features.map(f => (
                                            <li key={f} className="flex items-center text-sm text-gray-300">
                                                <Check className="w-4 h-4 mr-2 text-green-400" /> {f}
                                            </li>
                                        ))}
                                    </ul>
                                    <div className={cn(
                                        "w-full py-2 rounded-lg text-center text-sm font-medium transition-colors",
                                        selectedPlan === plan.id ? "bg-white text-black" : "bg-white/10 text-white"
                                    )}>
                                        {selectedPlan === plan.id ? "Выбрано" : "Выбрать"}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-end pt-4">
                            <Button
                                size="lg"
                                onClick={() => setStep('club')}
                                className="bg-white text-black hover:bg-gray-200"
                            >
                                Продолжить <ArrowRight className="ml-2 w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="max-w-md mx-auto animate-in fade-in slide-in-from-right-8 duration-500">
                        <Card className="bg-gray-900/50 border-white/10 backdrop-blur-md">
                            <CardHeader>
                                <CardTitle>Создайте ваш Клуб</CardTitle>
                                <CardDescription>Расскажите нам о вашем компьютерном клубе.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form id="club-form" onSubmit={handleCreateClub} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="name">Название клуба</Label>
                                        <Input
                                            id="name"
                                            placeholder="например, CyberZone Москва"
                                            value={clubName}
                                            onChange={(e) => setClubName(e.target.value)}
                                            className="bg-black/50 border-white/10 text-white"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="address">Адрес (опционально)</Label>
                                        <Input
                                            id="address"
                                            placeholder="например, ул. Пушкина, 10"
                                            value={address}
                                            onChange={(e) => setAddress(e.target.value)}
                                            className="bg-black/50 border-white/10 text-white"
                                        />
                                    </div>
                                </form>
                            </CardContent>
                            <div className="p-6 pt-0 flex gap-4">
                                <Button variant="ghost" onClick={() => setStep('plan')} className="w-full text-white hover:bg-white/10">
                                    Назад
                                </Button>
                                <Button type="submit" form="club-form" className="w-full bg-purple-600 hover:bg-purple-500 text-white" disabled={isLoading}>
                                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Building2 className="mr-2 h-4 w-4" />}
                                    Создать клуб
                                </Button>
                            </div>
                        </Card>
                    </div>
                )}
            </main>
        </div>
    )
}
