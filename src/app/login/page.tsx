"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Zap, Loader2, ArrowRight } from "lucide-react"
import { PhoneInput } from "@/components/ui/phone-input"

type MeResponse = {
    ownedClubs?: Array<any>
    employeeClubs?: Array<any>
}

export default function LoginPage() {
    const router = useRouter()
    const [step, setStep] = useState<'phone' | 'otp' | 'password-setup' | 'password' | 'name'>('phone')
    const [phone, setPhone] = useState('')
    const [code, setCode] = useState('')
    const [password, setPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [fullName, setFullName] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [debugCode, setDebugCode] = useState<string | null>(null)
    const [userExists, setUserExists] = useState(false)
    const [requiresPassword, setRequiresPassword] = useState(false)
    const [isNewUser, setIsNewUser] = useState(false)
    const [isCheckingSession, setIsCheckingSession] = useState(true)

    const routeFromMe = useCallback((data: MeResponse) => {
        const ownedClubs = Array.isArray(data.ownedClubs) ? data.ownedClubs : []
        const employeeClubs = Array.isArray(data.employeeClubs) ? data.employeeClubs : []

        const hasManagerClubs = employeeClubs.some(
            (club: any) => club.role === 'Управляющий' || club.role === 'Manager'
        )

        if (ownedClubs.length > 0 || hasManagerClubs) {
            router.push('/dashboard')
            return
        }

        if (employeeClubs.length > 0) {
            router.push('/employee/dashboard')
            return
        }

        router.push('/dashboard')
    }, [router])

    useEffect(() => {
        let cancelled = false

        const checkExistingSession = async () => {
            try {
                const res = await fetch('/api/auth/me')
                if (!res.ok) return
                const data = (await res.json()) as MeResponse
                if (cancelled) return
                routeFromMe(data)
            } catch {
                // ignore
            } finally {
                if (!cancelled) setIsCheckingSession(false)
            }
        }

        checkExistingSession()

        return () => {
            cancelled = true
        }
    }, [routeFromMe])

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
                setUserExists(data.userExists || false)
                setRequiresPassword(data.requiresPassword || false)
                setIsNewUser(!data.userExists)
                const hasPassword = data.userExists && !data.requiresPassword

                if (hasPassword) {
                    // У пользователя есть пароль — сразу показываем ввод пароля, OTP не нужно
                    setStep('password')
                } else {
                    // Нет пароля (существующий или новый) — сначала OTP, потом установка пароля или ввод имени
                    setStep('otp')
                }
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

    const redirectBasedOnRole = async () => {
        try {
            const res = await fetch('/api/auth/me')
            const data = (await res.json()) as MeResponse

            if (res.ok) routeFromMe(data)
            else router.push('/dashboard')
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
                if (data.requiresPasswordSetup) {
                    // Существующий пользователь без пароля — после OTP просим установить пароль
                    setIsNewUser(false)
                    setStep('password-setup')
                } else if (data.isNewUser) {
                    // Новый пользователь — после OTP просим ввести имя
                    setIsNewUser(true)
                    setStep('name')
                } else {
                    // Существующий пользователь с паролем — уже вошёл, редирект
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
                // После ввода имени предлагаем установить пароль
                setStep('password-setup')
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

    const handleSetPassword = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        try {
            if (newPassword !== confirmPassword) {
                alert('Пароли не совпадают')
                setIsLoading(false)
                return
            }

            if (newPassword.length < 6) {
                alert('Пароль должен быть не менее 6 символов')
                setIsLoading(false)
                return
            }

            const res = await fetch('/api/auth/set-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    password: newPassword, 
                    confirm_password: confirmPassword 
                }),
            })

            const data = await res.json()

            if (data.success) {
                // После установки пароля — сразу редирект
                await redirectBasedOnRole()
            } else {
                alert(data.error || 'Ошибка установки пароля')
            }
        } catch (err) {
            console.error(err)
            alert('Ошибка установки пароля')
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
                        {step === 'phone'
                            ? 'С возвращением'
                            : step === 'otp'
                                ? 'Введите код'
                                : step === 'password-setup'
                                    ? isNewUser
                                        ? 'Придумайте пароль'
                                        : 'Установите пароль'
                                    : step === 'password'
                                        ? 'Введите пароль'
                                        : 'Как вас зовут?'
                        }
                    </CardTitle>
                    <CardDescription className="text-gray-400">
                        {step === 'phone'
                            ? 'Введите номер телефона для входа'
                            : step === 'otp'
                                ? `Мы отправили код на ${phone}`
                            : step === 'password-setup'
                                    ? isNewUser
                                        ? 'Создайте пароль для быстрого входа в будущем'
                                        : 'Придумайте пароль для быстрого входа в будущем'
                                    : step === 'password'
                                        ? `Введите пароль для ${phone}`
                                        : 'Расскажите нам, как к вам обращаться'
                        }
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isCheckingSession ? (
                        <div className="flex items-center justify-center py-10 text-gray-400">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Проверяем сессию…
                        </div>
                    ) : (
                    step === 'phone' ? (
                        <form onSubmit={handleSendOtp} className="space-y-4">
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

                            <Button type="submit" className="w-full bg-white text-black hover:bg-gray-200" disabled={isLoading}>
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Продолжить <ArrowRight className="ml-2 w-4 h-4" />
                            </Button>
                        </form>
                    ) : step === 'password' ? (
                        <form onSubmit={handlePasswordLogin} className="space-y-4">
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
                            </div>
                            <Button type="submit" className="w-full bg-white text-black hover:bg-gray-200" disabled={isLoading}>
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Войти
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
                    ) : step === 'otp' ? (
                        <form onSubmit={handleVerifyOtp} className="space-y-4">
                            {debugCode && (
                                <div className="p-3 bg-purple-500/20 border border-purple-500/30 rounded text-purple-200 text-sm text-center">
                                    DEV CODE: <span className="font-bold tracking-widest">{debugCode}</span>
                                </div>
                            )}
                            {requiresPassword && (
                                <div className="p-3 bg-yellow-500/20 border border-yellow-500/30 rounded text-yellow-200 text-sm text-center">
                                    После ввода кода вам нужно будет установить пароль
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
                    ) : step === 'password-setup' ? (
                        <form onSubmit={handleSetPassword} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="newPassword" className="text-gray-300">Новый пароль</Label>
                                <Input
                                    id="newPassword"
                                    type="password"
                                    placeholder="Минимум 6 символов"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="bg-black/50 border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-purple-500"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword" className="text-gray-300">Подтверждение пароля</Label>
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    placeholder="Повторите пароль"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="bg-black/50 border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-purple-500"
                                    required
                                />
                            </div>
                            <Button type="submit" className="w-full bg-white text-black hover:bg-gray-200" disabled={isLoading}>
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Установить пароль <ArrowRight className="ml-2 w-4 h-4" />
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
                    )
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
