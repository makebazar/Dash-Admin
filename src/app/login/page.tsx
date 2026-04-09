"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Zap, Loader2, ArrowRight } from "lucide-react"
import { PhoneInput } from "@/components/ui/phone-input"
import { validatePhone } from "@/lib/phone-utils"

type MeResponse = {
    user?: {
        is_super_admin?: boolean
        legal_acceptance_required?: boolean
    }
    ownedClubs?: Array<any>
    employeeClubs?: Array<any>
}

export default function LoginPage() {
    const router = useRouter()
    const [step, setStep] = useState<'phone' | 'otp' | 'password-setup' | 'password' | 'name' | 'reset-otp' | 'reset-password'>('phone')
    const [phone, setPhone] = useState('')
    const [code, setCode] = useState('')
    const [password, setPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [fullName, setFullName] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [debugCode, setDebugCode] = useState<string | null>(null)
    const [requiresPassword, setRequiresPassword] = useState(false)
    const [isNewUser, setIsNewUser] = useState(false)
    const [isCheckingSession, setIsCheckingSession] = useState(true)
    const [hasAcceptedLegal, setHasAcceptedLegal] = useState(false)

    const resetTransientFields = useCallback(() => {
        setCode('')
        setPassword('')
        setNewPassword('')
        setConfirmPassword('')
        setDebugCode(null)
    }, [])

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

        if (!validatePhone(phone)) {
            alert('Введите номер телефона в формате +7 и 10 цифр номера')
            return
        }

        setIsLoading(true)
        try {
            const res = await fetch('/api/auth/otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phoneNumber: phone }),
            })
            const data = await res.json()

            if (data.success) {
                setRequiresPassword(data.requiresPassword || false)
                setIsNewUser(!data.userExists)
                const hasPassword = data.userExists && !data.requiresPassword

                if (hasPassword) {
                    setStep('password')
                } else {
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

    const handleStartPasswordReset = async () => {
        if (!validatePhone(phone)) {
            alert('Введите номер телефона в формате +7 и 10 цифр номера')
            return
        }

        setIsLoading(true)
        try {
            const res = await fetch('/api/auth/password-reset/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phoneNumber: phone }),
            })
            const data = await res.json()

            if (data.success) {
                resetTransientFields()
                setStep('reset-otp')
                setDebugCode(data.debugCode || null)
            } else {
                alert(data.error || 'Не удалось отправить код для сброса')
            }
        } catch (err) {
            console.error(err)
            alert('Ошибка отправки кода для сброса')
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
                    setIsNewUser(false)
                    setStep('password-setup')
                } else if (data.isNewUser) {
                    setIsNewUser(true)
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

    const handleVerifyResetOtp = async (e: React.FormEvent) => {
        e.preventDefault()

        if (code.length < 4) {
            alert('Введите код полностью')
            return
        }

        setStep('reset-password')
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
            if (isNewUser && !hasAcceptedLegal) {
                alert('Нужно принять пользовательское соглашение и политику конфиденциальности')
                setIsLoading(false)
                return
            }

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
                if (isNewUser) {
                    const legalRes = await fetch('/api/legal-consent', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ accepted: true, source: 'registration' }),
                    })

                    const legalData = await legalRes.json()
                    if (!legalRes.ok) {
                        alert(legalData.error || 'Не удалось сохранить согласие')
                        setIsLoading(false)
                        return
                    }
                }
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

    const handleResetPassword = async (e: React.FormEvent) => {
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

            const res = await fetch('/api/auth/password-reset/confirm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phoneNumber: phone,
                    code,
                    password: newPassword,
                    confirm_password: confirmPassword,
                }),
            })

            const data = await res.json()

            if (data.success) {
                alert('Пароль успешно изменён. Теперь войдите с новым паролем.')
                resetTransientFields()
                setStep('password')
            } else {
                alert(data.error || 'Ошибка сброса пароля')
            }
        } catch (err) {
            console.error(err)
            alert('Ошибка сброса пароля')
        } finally {
            setIsLoading(false)
        }
    }

    // Map steps to clear headings and descriptions
    const stepContent = {
        'phone': {
            title: 'Вход в систему',
            description: 'Введите номер телефона для авторизации'
        },
        'otp': {
            title: 'Код подтверждения',
            description: `Отправили код на номер ${phone}`
        },
        'reset-otp': {
            title: 'Сброс пароля',
            description: `Отправили код для сброса на ${phone}`
        },
        'reset-password': {
            title: 'Новый пароль',
            description: 'Введите новый пароль и подтвердите его'
        },
        'password-setup': {
            title: isNewUser ? 'Придумайте пароль' : 'Установите пароль',
            description: 'Пароль нужен для быстрого входа в будущем'
        },
        'password': {
            title: 'Вход по паролю',
            description: `Введите пароль для ${phone}`
        },
        'name': {
            title: 'Как к вам обращаться?',
            description: 'Введите ваше имя и фамилию'
        }
    }

    const currentContent = stepContent[step]

    return (
        <div className="min-h-screen bg-black text-white flex flex-col md:flex-row font-sans selection:bg-purple-500/30">
            {/* Visual Anchor (Left Side) */}
            <div className="hidden md:flex md:w-1/2 relative flex-col justify-between p-12 overflow-hidden border-r border-white/10">
                <div className="absolute inset-0 z-0">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 2, ease: "easeOut" }}
                        className="absolute -top-1/4 -left-1/4 w-[80vw] h-[80vw] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" 
                    />
                </div>
                
                <Link href="/" className="relative z-10 flex items-center gap-2 group w-fit">
                    <Zap className="text-white w-6 h-6 fill-current group-hover:text-blue-400 transition-colors" />
                    <span className="font-bold text-2xl tracking-tight">DashAdmin</span>
                </Link>

                <div className="relative z-10">
                    <h2 className="text-5xl font-bold tracking-tight mb-6 leading-tight">
                        Единая система<br/>управления<br/>клубом.
                    </h2>
                    <p className="text-xl text-gray-400 max-w-md leading-relaxed">
                        Смены, деньги, склад, техника и чеклисты в одном месте.
                    </p>
                </div>
            </div>

            {/* Auth Form (Right Side) */}
            <div className="flex-1 flex flex-col justify-center items-center p-6 md:p-12 relative z-10 bg-black">
                <div className="w-full max-w-sm">
                    {/* Mobile Header */}
                    <div className="md:hidden flex items-center gap-2 mb-12">
                        <Zap className="text-white w-6 h-6 fill-current" />
                        <span className="font-bold text-xl tracking-tight">DashAdmin</span>
                    </div>

                    <AnimatePresence mode="wait">
                        <motion.div
                            key={step}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3 }}
                        >
                            <div className="mb-10">
                                <h1 className="text-3xl font-bold tracking-tight mb-3">{currentContent.title}</h1>
                                <p className="text-gray-400 text-lg leading-snug">{currentContent.description}</p>
                            </div>

                            {isCheckingSession ? (
                                <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-4">
                                    <Loader2 className="h-6 w-6 animate-spin text-white" />
                                    <span className="text-sm font-medium tracking-wide">Проверка сессии</span>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {step === 'phone' && (
                                        <form onSubmit={handleSendOtp} className="space-y-6" noValidate>
                                            <div className="space-y-3">
                                                <Label htmlFor="phone" className="text-sm font-medium text-gray-300">Номер телефона</Label>
                                                <PhoneInput
                                                    id="phone"
                                                    placeholder="Введите номер"
                                                    value={phone}
                                                    onChange={setPhone}
                                                    className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-1 focus-visible:ring-white/30 focus-visible:border-white/30 h-12 text-lg rounded-xl transition-all"
                                                    aria-label="Номер телефона"
                                                />
                                            </div>

                                            <Button
                                                type="submit"
                                                className="w-full bg-white text-black hover:bg-gray-200 h-12 rounded-full font-medium text-base transition-all"
                                                disabled={isLoading}
                                            >
                                                {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                                                Продолжить <ArrowRight className="ml-2 w-5 h-5" />
                                            </Button>
                                        </form>
                                    )}

                                    {step === 'password' && (
                                        <form onSubmit={handlePasswordLogin} className="space-y-6">
                                            <div className="space-y-3">
                                                <Label htmlFor="password" className="text-sm font-medium text-gray-300">Пароль</Label>
                                                <Input
                                                    id="password"
                                                    type="password"
                                                    placeholder="Введите пароль"
                                                    value={password}
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-1 focus-visible:ring-white/30 focus-visible:border-white/30 h-12 text-lg rounded-xl transition-all"
                                                    required
                                                />
                                            </div>
                                            
                                            <Button type="submit" className="w-full bg-white text-black hover:bg-gray-200 h-12 rounded-full font-medium text-base transition-all" disabled={isLoading}>
                                                {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                                                Войти
                                            </Button>

                                            <div className="flex flex-col gap-2 pt-2">
                                                <button
                                                    type="button"
                                                    className="text-sm text-gray-500 hover:text-white transition-colors text-left"
                                                    onClick={handleStartPasswordReset}
                                                    disabled={isLoading}
                                                >
                                                    Забыли пароль?
                                                </button>
                                                <button
                                                    type="button"
                                                    className="text-sm text-gray-500 hover:text-white transition-colors text-left"
                                                    onClick={() => setStep('phone')}
                                                >
                                                    Изменить номер телефона
                                                </button>
                                            </div>
                                        </form>
                                    )}

                                    {step === 'otp' && (
                                        <form onSubmit={handleVerifyOtp} className="space-y-6">
                                            {debugCode && (
                                                <div className="p-4 bg-white/5 border border-white/10 rounded-xl text-gray-300 text-sm font-mono">
                                                    Код для теста: <span className="text-white font-bold tracking-widest ml-2">{debugCode}</span>
                                                </div>
                                            )}
                                            {requiresPassword && (
                                                <div className="p-4 bg-white/5 border border-white/10 rounded-xl text-gray-400 text-sm">
                                                    Далее потребуется установить пароль
                                                </div>
                                            )}
                                            
                                            <div className="space-y-3">
                                                <Label htmlFor="code" className="text-sm font-medium text-gray-300">Код из СМС</Label>
                                                <Input
                                                    id="code"
                                                    placeholder="0000"
                                                    value={code}
                                                    onChange={(e) => setCode(e.target.value)}
                                                    className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-1 focus-visible:ring-white/30 focus-visible:border-white/30 h-14 text-2xl tracking-[0.5em] text-center rounded-xl font-mono transition-all"
                                                    maxLength={4}
                                                    required
                                                />
                                            </div>

                                            <Button type="submit" className="w-full bg-white text-black hover:bg-gray-200 h-12 rounded-full font-medium text-base transition-all" disabled={isLoading}>
                                                {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                                                Подтвердить <ArrowRight className="ml-2 w-5 h-5" />
                                            </Button>

                                            <div className="pt-2">
                                                <button
                                                    type="button"
                                                    className="text-sm text-gray-500 hover:text-white transition-colors"
                                                    onClick={() => setStep('phone')}
                                                >
                                                    Изменить номер
                                                </button>
                                            </div>
                                        </form>
                                    )}

                                    {step === 'reset-otp' && (
                                        <form onSubmit={handleVerifyResetOtp} className="space-y-6">
                                            {debugCode && (
                                                <div className="p-4 bg-white/5 border border-white/10 rounded-xl text-gray-300 text-sm font-mono">
                                                    Код для теста: <span className="text-white font-bold tracking-widest ml-2">{debugCode}</span>
                                                </div>
                                            )}
                                            
                                            <div className="space-y-3">
                                                <Label htmlFor="reset-code" className="text-sm font-medium text-gray-300">Код из СМС</Label>
                                                <Input
                                                    id="reset-code"
                                                    placeholder="0000"
                                                    value={code}
                                                    onChange={(e) => setCode(e.target.value)}
                                                    className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-1 focus-visible:ring-white/30 focus-visible:border-white/30 h-14 text-2xl tracking-[0.5em] text-center rounded-xl font-mono transition-all"
                                                    maxLength={4}
                                                    required
                                                />
                                            </div>

                                            <Button type="submit" className="w-full bg-white text-black hover:bg-gray-200 h-12 rounded-full font-medium text-base transition-all" disabled={isLoading}>
                                                Продолжить <ArrowRight className="ml-2 w-5 h-5" />
                                            </Button>

                                            <div className="pt-2">
                                                <button
                                                    type="button"
                                                    className="text-sm text-gray-500 hover:text-white transition-colors"
                                                    onClick={() => {
                                                        resetTransientFields()
                                                        setStep('password')
                                                    }}
                                                >
                                                    Отменить сброс
                                                </button>
                                            </div>
                                        </form>
                                    )}

                                    {step === 'reset-password' && (
                                        <form onSubmit={handleResetPassword} className="space-y-6">
                                            <div className="space-y-3">
                                                <Label htmlFor="reset-new-password" className="text-sm font-medium text-gray-300">Новый пароль</Label>
                                                <Input
                                                    id="reset-new-password"
                                                    type="password"
                                                    placeholder="Минимум 6 символов"
                                                    value={newPassword}
                                                    onChange={(e) => setNewPassword(e.target.value)}
                                                    className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-1 focus-visible:ring-white/30 focus-visible:border-white/30 h-12 text-lg rounded-xl transition-all"
                                                    required
                                                />
                                            </div>

                                            <div className="space-y-3">
                                                <Label htmlFor="reset-confirm-password" className="text-sm font-medium text-gray-300">Повторите пароль</Label>
                                                <Input
                                                    id="reset-confirm-password"
                                                    type="password"
                                                    placeholder="Ещё раз"
                                                    value={confirmPassword}
                                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                                    className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-1 focus-visible:ring-white/30 focus-visible:border-white/30 h-12 text-lg rounded-xl transition-all"
                                                    required
                                                />
                                            </div>

                                            <Button type="submit" className="w-full bg-white text-black hover:bg-gray-200 h-12 rounded-full font-medium text-base transition-all" disabled={isLoading}>
                                                {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                                                Сохранить пароль <ArrowRight className="ml-2 w-5 h-5" />
                                            </Button>

                                            <div className="pt-2">
                                                <button
                                                    type="button"
                                                    className="text-sm text-gray-500 hover:text-white transition-colors"
                                                    onClick={() => setStep('reset-otp')}
                                                >
                                                    Назад к коду
                                                </button>
                                            </div>
                                        </form>
                                    )}

                                    {step === 'password-setup' && (
                                        <form onSubmit={handleSetPassword} className="space-y-6">
                                            <div className="space-y-3">
                                                <Label htmlFor="newPassword" className="text-sm font-medium text-gray-300">Пароль</Label>
                                                <Input
                                                    id="newPassword"
                                                    type="password"
                                                    placeholder="Минимум 6 символов"
                                                    value={newPassword}
                                                    onChange={(e) => setNewPassword(e.target.value)}
                                                    className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-1 focus-visible:ring-white/30 focus-visible:border-white/30 h-12 text-lg rounded-xl transition-all"
                                                    required
                                                />
                                            </div>

                                            <div className="space-y-3">
                                                <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-300">Повторите пароль</Label>
                                                <Input
                                                    id="confirmPassword"
                                                    type="password"
                                                    placeholder="Ещё раз"
                                                    value={confirmPassword}
                                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                                    className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-1 focus-visible:ring-white/30 focus-visible:border-white/30 h-12 text-lg rounded-xl transition-all"
                                                    required
                                                />
                                            </div>

                                            {isNewUser && (
                                                <div className="rounded-xl border border-white/10 bg-white/5 p-4 mt-2">
                                                    <div className="flex items-start gap-3">
                                                        <Checkbox
                                                            id="legal-consent"
                                                            checked={hasAcceptedLegal}
                                                            onCheckedChange={(checked) => setHasAcceptedLegal(checked === true)}
                                                            className="mt-1 border-white/20 data-[state=checked]:border-white data-[state=checked]:bg-white data-[state=checked]:text-black"
                                                        />
                                                        <Label htmlFor="legal-consent" className="text-sm leading-relaxed text-gray-400">
                                                            Я принимаю{" "}
                                                            <Link href="/terms" className="text-gray-200 hover:text-white underline underline-offset-4 decoration-white/20 hover:decoration-white/50 transition-all">
                                                                Пользовательское соглашение
                                                            </Link>
                                                            {" "}и{" "}
                                                            <Link href="/privacy" className="text-gray-200 hover:text-white underline underline-offset-4 decoration-white/20 hover:decoration-white/50 transition-all">
                                                                Политику конфиденциальности
                                                            </Link>
                                                        </Label>
                                                    </div>
                                                </div>
                                            )}

                                            <Button type="submit" className="w-full bg-white text-black hover:bg-gray-200 h-12 rounded-full font-medium text-base transition-all" disabled={isLoading}>
                                                {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                                                Установить пароль <ArrowRight className="ml-2 w-5 h-5" />
                                            </Button>
                                        </form>
                                    )}

                                    {step === 'name' && (
                                        <form onSubmit={handleSaveName} className="space-y-6">
                                            <div className="space-y-3">
                                                <Label htmlFor="fullName" className="text-sm font-medium text-gray-300">Имя и фамилия</Label>
                                                <Input
                                                    id="fullName"
                                                    placeholder="Например, Иван Иванов"
                                                    value={fullName}
                                                    onChange={(e) => setFullName(e.target.value)}
                                                    className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-1 focus-visible:ring-white/30 focus-visible:border-white/30 h-12 text-lg rounded-xl transition-all"
                                                    required
                                                />
                                            </div>

                                            <Button type="submit" className="w-full bg-white text-black hover:bg-gray-200 h-12 rounded-full font-medium text-base transition-all" disabled={isLoading}>
                                                {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                                                Продолжить <ArrowRight className="ml-2 w-5 h-5" />
                                            </Button>
                                        </form>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Footer text */}
                <div className="absolute bottom-6 left-0 right-0 text-center text-xs text-gray-600 px-6">
                    Авторизуясь, вы соглашаетесь с нашими{" "}
                    <Link href="/terms" className="text-gray-500 hover:text-white transition-colors">правилами</Link>
                    {" "}и{" "}
                    <Link href="/privacy" className="text-gray-500 hover:text-white transition-colors">политикой конфиденциальности</Link>.
                </div>
            </div>
        </div>
    )
}
