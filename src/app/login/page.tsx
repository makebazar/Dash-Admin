"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Zap, Loader2, ArrowRight } from "lucide-react"
import { PhoneInput } from "@/components/ui/phone-input"

export default function LoginPage() {
    const router = useRouter()
    const [loginMethod, setLoginMethod] = useState<'otp' | 'password'>('otp')
    const [step, setStep] = useState<'phone' | 'otp' | 'name'>('phone')
    const [phone, setPhone] = useState('')
    const [code, setCode] = useState('')
    const [password, setPassword] = useState('')
    const [fullName, setFullName] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [debugCode, setDebugCode] = useState<string | null>(null)

    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        try {
            const res = await fetch('/api/auth/otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phoneNumber: phone }),
            })
            const data = await res.json()

            if (data.success) {
                setStep('otp')
                setDebugCode(data.debugCode)
            } else {
                alert(data.error || 'Не удалось отправить код')
            }
        } catch (err) {
            console.error(err)
            alert('Ошибка отправки кода')
        } finally {
            setIsLoading(false)
        }
    }

    const redirectBasedOnRole = async () => {
        try {
            const res = await fetch('/api/auth/me')
            const data = await res.json()

            if (res.ok) {
                const { ownedClubs, employeeClubs } = data

                if (ownedClubs.length > 0 && employeeClubs.length === 0) {
                    router.push('/dashboard')
                } else if (ownedClubs.length === 0 && employeeClubs.length > 0) {
                    router.push('/employee/dashboard')
                } else if (ownedClubs.length > 0 && employeeClubs.length > 0) {
                    router.push('/dashboard')
                } else {
                    router.push('/dashboard')
                }
            } else {
                router.push('/dashboard')
            }
        } catch (error) {
            console.error('Error checking role:', error)
            router.push('/dashboard')
        }
    }

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        try {
            const res = await fetch('/api/auth/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phoneNumber: phone, code }),
            })
            const data = await res.json()

            if (data.success) {
                if (data.isNewUser) {
                    setStep('name')
                } else {
                    await redirectBasedOnRole()
                }
            } else {
                alert(data.error || 'Неверный код')
            }
        } catch (err) {
            console.error(err)
            alert('Ошибка проверки кода')
        } finally {
            setIsLoading(false)
        }
    }

    const handlePasswordLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        try {
            const res = await fetch('/api/auth/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phoneNumber: phone, password }),
            })
            const data = await res.json()

            if (data.success) {
                await redirectBasedOnRole()
            } else {
                alert(data.error || 'Ошибка входа')
            }
        } catch (err) {
            console.error(err)
            alert('Ошибка входа')
        } finally {
            setIsLoading(false)
        }
    }

    const handleSaveName = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        try {
            const res = await fetch('/api/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ full_name: fullName }),
            })

            if (res.ok) {
                router.push('/dashboard')
            } else {
                alert('Ошибка сохранения имени')
            }
        } catch (err) {
            console.error(err)
            alert('Ошибка сохранения')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
            <Link href="/" className="mb-8 flex items-center gap-2">
                <div className="w-10 h-10 bg-gradient-to-tr from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
                    <Zap className="text-white w-6 h-6 fill-current" />
                </div>
                <span className="font-bold text-2xl tracking-tight">DashAdmin</span>
            </Link>

            <Card className="w-full max-w-md bg-gray-900/50 border-white/10 backdrop-blur-md">
                <CardHeader>
                    <CardTitle className="text-2xl text-white">
                        {step === 'phone' ? 'С возвращением' : step === 'otp' ? 'Введите код' : 'Как вас зовут?'}
                    </CardTitle>
                    <CardDescription className="text-gray-400">
                        {step === 'phone'
                            ? 'Войдите по номеру телефона'
                            : step === 'otp'
                                ? `Мы отправили код на ${phone}`
                                : 'Расскажите нам, как к вам обращаться'
                        }
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {step === 'phone' ? (
                        <>
                            {/* Tabs */}
                            <div className="flex gap-2 mb-6 p-1 bg-black/50 rounded-lg">
                                <button
                                    type="button"
                                    onClick={() => setLoginMethod('otp')}
                                    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${loginMethod === 'otp'
                                        ? 'bg-white text-black'
                                        : 'text-gray-400 hover:text-white'
                                        }`}
                                >
                                    OTP
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setLoginMethod('password')}
                                    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${loginMethod === 'password'
                                        ? 'bg-white text-black'
                                        : 'text-gray-400 hover:text-white'
                                        }`}
                                >
                                    Пароль
                                </button>
                            </div>

                            <form onSubmit={loginMethod === 'otp' ? handleSendOtp : handlePasswordLogin} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="phone" className="text-gray-300">Номер телефона</Label>
                                    <PhoneInput
                                        id="phone"
                                        placeholder="+7 (999) 000-00-00"
                                        value={phone}
                                        onChange={setPhone}
                                        required
                                        className="bg-black/50 border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-purple-500"
                                    />
                                </div>

                                {loginMethod === 'password' && (
                                    <div className="space-y-2">
                                        <Label htmlFor="password" className="text-gray-300">Пароль</Label>
                                        <Input
                                            id="password"
                                            type="password"
                                            placeholder="Введите пароль"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="bg-black/50 border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-purple-500"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setLoginMethod('otp')}
                                            className="text-xs text-gray-400 hover:text-purple-400 transition-colors"
                                        >
                                            Забыли пароль? Войти по OTP
                                        </button>
                                    </div>
                                )}

                                <Button type="submit" className="w-full bg-white text-black hover:bg-gray-200" disabled={isLoading}>
                                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    {loginMethod === 'otp' ? 'Отправить код' : 'Войти'}
                                </Button>
                            </form>
                        </>
                    ) : step === 'otp' ? (
                        <form onSubmit={handleVerifyOtp} className="space-y-4">
                            {debugCode && (
                                <div className="p-3 bg-purple-500/20 border border-purple-500/30 rounded text-purple-200 text-sm text-center">
                                    DEV CODE: <span className="font-bold tracking-widest">{debugCode}</span>
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label htmlFor="code" className="text-gray-300">Код подтверждения</Label>
                                <Input
                                    id="code"
                                    placeholder="0000"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
                                    className="bg-black/50 border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-purple-500 text-center text-lg tracking-widest"
                                    maxLength={4}
                                    required
                                />
                            </div>
                            <Button type="submit" className="w-full bg-white text-black hover:bg-gray-200" disabled={isLoading}>
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Подтвердить и Войти <ArrowRight className="ml-2 w-4 h-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                type="button"
                                className="w-full text-gray-500 hover:text-white"
                                onClick={() => setStep('phone')}
                            >
                                Изменить номер
                            </Button>
                        </form>
                    ) : (
                        <form onSubmit={handleSaveName} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="fullName" className="text-gray-300">Ваше имя</Label>
                                <Input
                                    id="fullName"
                                    placeholder="Например, Иван Иванов"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    className="bg-black/50 border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-purple-500"
                                    required
                                />
                            </div>
                            <Button type="submit" className="w-full bg-white text-black hover:bg-gray-200" disabled={isLoading}>
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Продолжить <ArrowRight className="ml-2 w-4 h-4" />
                            </Button>
                        </form>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
