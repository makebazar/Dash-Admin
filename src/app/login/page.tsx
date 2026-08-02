"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Zap, Loader2, ArrowRight, Eye, EyeOff } from "lucide-react"
import { PhoneInput } from "@/components/ui/phone-input"
import { validatePhone } from "@/lib/phone-utils"

type MeResponse = {
    user?: {
        is_super_admin?: boolean
        legal_acceptance_required?: boolean
        requires_email_setup?: boolean
        email?: string
    }
    ownedClubs?: Array<any>
    employeeClubs?: Array<any>
}

export default function LoginPage() {
    const router = useRouter()
    const [step, setStep] = useState<'login' | 'reset-phone' | 'reset-confirm' | 'email-bind' | 'email-bind-otp'>('login')
    const [phone, setPhone] = useState('')
    const [password, setPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [email, setEmail] = useState('')
    const [maskedEmail, setMaskedEmail] = useState('')
    const [code, setCode] = useState('')

    const [showPassword, setShowPassword] = useState(false)
    const [showNewPassword, setShowNewPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [debugCode, setDebugCode] = useState<string | null>(null)
    const [isCheckingSession, setIsCheckingSession] = useState(true)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    const routeFromMe = useCallback((data: MeResponse) => {
        if (data.user && data.user.requires_email_setup) {
            setStep('email-bind')
            return
        }

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

                if (data.user && data.user.requires_email_setup) {
                    setStep('email-bind')
                    setIsCheckingSession(false)
                    return
                }

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

    // Main Login via Phone + Password
    const handlePhonePasswordLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setErrorMessage(null)

        if (!validatePhone(phone)) {
            setErrorMessage('Введите номер телефона полностью')
            return
        }

        if (!password) {
            setErrorMessage('Введите ваш пароль')
            return
        }

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
                setErrorMessage(data.error || 'Неверный номер телефона или пароль')
            }
        } catch (err) {
            console.error(err)
            setErrorMessage('Ошибка входа')
        } finally {
            setIsLoading(false)
        }
    }

    // Step 1 of Password Reset: Find Email by Phone & Request OTP Code
    const handleRequestResetByPhone = async (e?: React.FormEvent, customPhone?: string) => {
        if (e) e.preventDefault()
        setErrorMessage(null)

        const targetPhone = customPhone || phone
        if (!validatePhone(targetPhone)) {
            setErrorMessage('Введите ваш номер телефона полностью')
            setStep('reset-phone')
            return
        }

        setIsLoading(true)
        try {
            const res = await fetch('/api/auth/request-password-reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phoneNumber: targetPhone }),
            })
            const data = await res.json()

            if (res.ok && data.success) {
                setEmail(data.email)
                setMaskedEmail(data.maskedEmail)
                setStep('reset-confirm')
                setDebugCode(data.debugCode || null)
            } else {
                setErrorMessage(data.error || 'Не удалось запросить сброс пароля')
                setStep('reset-phone')
            }
        } catch (err) {
            console.error(err)
            setErrorMessage('Ошибка подключения к серверу')
        } finally {
            setIsLoading(false)
        }
    }

    // Step 2 of Password Reset: Submit OTP Code & New Password
    const handleConfirmPasswordReset = async (e: React.FormEvent) => {
        e.preventDefault()
        setErrorMessage(null)

        if (code.length < 6) {
            setErrorMessage('Введите 6-значный код полностью')
            return
        }

        if (!newPassword || newPassword.length < 4) {
            setErrorMessage('Новый пароль должен содержать не менее 4 символов')
            return
        }

        if (/[а-яА-ЯёЁ]/.test(newPassword)) {
            setErrorMessage('Пароль не должен содержать русские буквы (кириллицу). Используйте только латиницу.')
            return
        }

        setIsLoading(true)
        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    code,
                    newPassword
                }),
            })
            const data = await res.json()

            if (res.ok && data.success) {
                await redirectBasedOnRole()
            } else {
                setErrorMessage(data.error || 'Ошибка сброса пароля')
            }
        } catch (err) {
            console.error(err)
            setErrorMessage('Ошибка сервера')
        } finally {
            setIsLoading(false)
        }
    }

    // Email Bind process for existing accounts
    const handleSendBindOtp = async (e: React.FormEvent) => {
        e.preventDefault()
        setErrorMessage(null)

        const trimmed = email.trim().toLowerCase()
        if (!trimmed || !trimmed.includes('@')) {
            setErrorMessage('Введите ваш рабочий Email')
            return
        }

        setIsLoading(true)
        try {
            const res = await fetch('/api/auth/otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: trimmed, bindOnly: true }),
            })
            const data = await res.json()

            if (data.success) {
                setStep('email-bind-otp')
                setDebugCode(data.debugCode || null)
            } else {
                setErrorMessage(data.error || 'Не удалось отправить код')
            }
        } catch (err) {
            console.error(err)
            setErrorMessage('Ошибка сервера')
        } finally {
            setIsLoading(false)
        }
    }

    const handleConfirmEmailBind = async (e: React.FormEvent) => {
        e.preventDefault()
        setErrorMessage(null)

        setIsLoading(true)
        try {
            const res = await fetch('/api/auth/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: email.trim().toLowerCase(),
                    code,
                    bindToCurrentSession: true
                }),
            })
            const data = await res.json()

            if (data.success) {
                await redirectBasedOnRole()
            } else {
                setErrorMessage(data.error || 'Ошибка подтверждения Email')
            }
        } catch (err) {
            console.error(err)
            setErrorMessage('Ошибка сервера')
        } finally {
            setIsLoading(false)
        }
    }

    const redirectBasedOnRole = async () => {
        try {
            const res = await fetch('/api/auth/me')
            const data = (await res.json()) as MeResponse

            if (data.user && data.user.requires_email_setup) {
                setStep('email-bind')
                return
            }

            if (res.ok) routeFromMe(data)
            else router.push('/dashboard')
        } catch (error) {
            console.error('Error checking role:', error)
            router.push('/dashboard')
        }
    }

    return (
        <div className="min-h-screen bg-black text-white flex flex-col md:flex-row font-sans selection:bg-blue-500/30">
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
                            {isCheckingSession ? (
                                <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-4">
                                    <Loader2 className="h-6 w-6 animate-spin text-white" />
                                    <span className="text-sm font-medium tracking-wide">Проверка сессии</span>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* MAIN LOGIN FORM (PHONE + PASSWORD) */}
                                    {step === 'login' && (
                                        <>
                                            <div className="mb-6">
                                                <h1 className="text-3xl font-bold tracking-tight mb-3">Вход в систему</h1>
                                                <p className="text-gray-400 text-sm leading-snug">
                                                    Введите номер телефона и пароль для входа в ваш аккаунт
                                                </p>
                                            </div>

                                            <form onSubmit={handlePhonePasswordLogin} className="space-y-4" noValidate>
                                                <div className="space-y-2">
                                                    <Label htmlFor="phone" className="text-sm font-medium text-gray-200">
                                                        Номер телефона
                                                    </Label>
                                                    <PhoneInput
                                                        id="phone"
                                                        placeholder="Введите номер"
                                                        value={phone}
                                                        onChange={setPhone}
                                                        className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-1 focus-visible:ring-blue-500/50 h-12 text-base rounded-xl transition-all"
                                                    />
                                                </div>

                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <Label htmlFor="password" className="text-sm font-medium text-gray-200">
                                                            Пароль
                                                        </Label>
                                                        <button
                                                            type="button"
                                                            className="text-xs text-gray-400 hover:text-white transition-colors underline underline-offset-4"
                                                            onClick={() => handleRequestResetByPhone()}
                                                        >
                                                            Забыли пароль?
                                                        </button>
                                                    </div>
                                                    <div className="relative">
                                                        <Input
                                                            id="password"
                                                            type={showPassword ? "text" : "password"}
                                                            placeholder="••••••••"
                                                            value={password}
                                                            onChange={(e) => setPassword(e.target.value)}
                                                            className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-1 focus-visible:ring-blue-500/50 h-12 text-base rounded-xl pr-10 transition-all"
                                                            required
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowPassword(!showPassword)}
                                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                                                        >
                                                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                                        </button>
                                                    </div>
                                                </div>

                                                {errorMessage && (
                                                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                                                        {errorMessage}
                                                    </div>
                                                )}

                                                <Button
                                                    type="submit"
                                                    className="w-full bg-white text-black hover:bg-gray-200 h-12 rounded-full font-medium text-base transition-all flex items-center justify-center gap-2 mt-4"
                                                    disabled={isLoading}
                                                >
                                                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                                                    <span>Войти в систему</span>
                                                    <ArrowRight className="w-5 h-5" />
                                                </Button>
                                            </form>
                                        </>
                                    )}

                                    {/* RESET STEP 1: ENTER PHONE NUMBER */}
                                    {step === 'reset-phone' && (
                                        <>
                                            <div className="mb-6">
                                                <h1 className="text-3xl font-bold tracking-tight mb-3">Сброс пароля</h1>
                                                <p className="text-gray-400 text-sm leading-snug">
                                                    Введите ваш номер телефона для отправки кода сброса на ваш Email
                                                </p>
                                            </div>

                                            <form onSubmit={(e) => handleRequestResetByPhone(e)} className="space-y-4" noValidate>
                                                <div className="space-y-2">
                                                    <Label htmlFor="reset-phone-input" className="text-sm font-medium text-gray-200">
                                                        Номер телефона
                                                    </Label>
                                                    <PhoneInput
                                                        id="reset-phone-input"
                                                        placeholder="Введите номер"
                                                        value={phone}
                                                        onChange={setPhone}
                                                        className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-1 focus-visible:ring-blue-500/50 h-12 text-base rounded-xl transition-all"
                                                    />
                                                </div>

                                                {errorMessage && (
                                                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                                                        {errorMessage}
                                                    </div>
                                                )}

                                                <Button
                                                    type="submit"
                                                    className="w-full bg-white text-black hover:bg-gray-200 h-12 rounded-full font-medium text-base transition-all flex items-center justify-center gap-2 mt-2"
                                                    disabled={isLoading}
                                                >
                                                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                                                    <span>Отправить код на Email</span>
                                                    <ArrowRight className="w-5 h-5" />
                                                </Button>

                                                <div className="pt-2 text-center">
                                                    <button
                                                        type="button"
                                                        className="text-xs text-gray-400 hover:text-white transition-colors"
                                                        onClick={() => {
                                                            setErrorMessage(null)
                                                            setStep('login')
                                                        }}
                                                    >
                                                        Вернуться ко входу
                                                    </button>
                                                </div>
                                            </form>
                                        </>
                                    )}

                                    {/* RESET STEP 2: ENTER OTP CODE & NEW PASSWORD */}
                                    {step === 'reset-confirm' && (
                                        <form onSubmit={handleConfirmPasswordReset} className="space-y-4">
                                            <div className="mb-4">
                                                <h1 className="text-3xl font-bold tracking-tight mb-2">Новый пароль</h1>
                                                <p className="text-gray-400 text-sm leading-relaxed">
                                                    Код восстановления отправлен на почту <span className="text-white font-semibold font-mono">{maskedEmail}</span>. Введите код и задайте новый пароль.
                                                </p>
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="reset-code" className="text-sm font-medium text-gray-200">Код из письма</Label>
                                                <Input
                                                    id="reset-code"
                                                    placeholder="000000"
                                                    value={code}
                                                    onChange={(e) => setCode(e.target.value)}
                                                    className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-1 focus-visible:ring-blue-500/50 h-14 text-2xl tracking-[0.4em] text-center rounded-xl font-mono transition-all"
                                                    maxLength={6}
                                                    required
                                                    autoFocus
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="new-password" className="text-sm font-medium text-gray-200">Придумайте новый пароль</Label>
                                                <div className="relative">
                                                    <Input
                                                        id="new-password"
                                                        type={showNewPassword ? "text" : "password"}
                                                        placeholder="••••••••"
                                                        value={newPassword}
                                                        onChange={(e) => setNewPassword(e.target.value)}
                                                        className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-1 focus-visible:ring-blue-500/50 h-12 text-base rounded-xl pr-10 transition-all"
                                                        required
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowNewPassword(!showNewPassword)}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                                                    >
                                                        {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                                    </button>
                                                </div>
                                            </div>

                                            {errorMessage && (
                                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                                                    {errorMessage}
                                                </div>
                                            )}

                                            <Button
                                                type="submit"
                                                className="w-full bg-white text-black hover:bg-gray-200 h-12 rounded-full font-medium text-base transition-all flex items-center justify-center gap-2 mt-2"
                                                disabled={isLoading}
                                            >
                                                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                                                <span>Сохранить новый пароль и войти</span>
                                                <ArrowRight className="w-5 h-5" />
                                            </Button>

                                            <div className="pt-2 text-center">
                                                <button
                                                    type="button"
                                                    className="text-xs text-gray-400 hover:text-white transition-colors"
                                                    onClick={() => setStep('reset-phone')}
                                                >
                                                    Изменить номер телефона
                                                </button>
                                            </div>
                                        </form>
                                    )}

                                    {/* STEP: EMAIL BINDING FOR OLD PHONE-ONLY ACCOUNTS */}
                                    {step === 'email-bind' && (
                                        <form onSubmit={handleSendBindOtp} className="space-y-4">
                                            <div className="mb-4">
                                                <h1 className="text-3xl font-bold tracking-tight mb-2">Привязка Email</h1>
                                                <p className="text-gray-400 text-sm leading-snug">
                                                    Для безопасности вашего аккаунта укажите и подтвердите ваш рабочий Email адрес.
                                                </p>
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="bind-email" className="text-sm font-medium text-gray-200">
                                                    Ваш Email адрес
                                                </Label>
                                                <Input
                                                    id="bind-email"
                                                    type="email"
                                                    placeholder="name@company.com"
                                                    value={email}
                                                    onChange={(e) => setEmail(e.target.value)}
                                                    className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-1 focus-visible:ring-blue-500/50 h-12 text-base rounded-xl transition-all"
                                                    required
                                                    autoFocus
                                                />
                                            </div>

                                            {errorMessage && (
                                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                                                    {errorMessage}
                                                </div>
                                            )}

                                            <Button
                                                type="submit"
                                                className="w-full bg-white text-black hover:bg-gray-200 h-12 rounded-full font-medium text-base transition-all flex items-center justify-center gap-2"
                                                disabled={isLoading}
                                            >
                                                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                                                <span>Получить код на Email</span>
                                                <ArrowRight className="w-5 h-5" />
                                            </Button>
                                        </form>
                                    )}

                                    {/* STEP: EMAIL BIND OTP VERIFICATION */}
                                    {step === 'email-bind-otp' && (
                                        <form onSubmit={handleConfirmEmailBind} className="space-y-4">
                                            <div className="mb-4">
                                                <h1 className="text-3xl font-bold tracking-tight mb-2">Подтверждение Email</h1>
                                                <p className="text-gray-400 text-sm">
                                                    Мы отправили код на <span className="text-white font-medium">{email}</span>
                                                </p>
                                            </div>

                                            <div className="space-y-2">
                                                <Input
                                                    id="bind-code"
                                                    placeholder="000000"
                                                    value={code}
                                                    onChange={(e) => setCode(e.target.value)}
                                                    className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-1 focus-visible:ring-blue-500/50 h-14 text-2xl tracking-[0.4em] text-center rounded-xl font-mono transition-all"
                                                    maxLength={6}
                                                    required
                                                    autoFocus
                                                />
                                            </div>

                                            {errorMessage && (
                                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                                                    {errorMessage}
                                                </div>
                                            )}

                                            <Button
                                                type="submit"
                                                className="w-full bg-white text-black hover:bg-gray-200 h-12 rounded-full font-medium text-base transition-all flex items-center justify-center gap-2"
                                                disabled={isLoading}
                                            >
                                                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                                                <span>Подтвердить и продолжить</span>
                                                <ArrowRight className="w-5 h-5" />
                                            </Button>

                                            <div className="pt-2 text-center">
                                                <button
                                                    type="button"
                                                    className="text-xs text-gray-400 hover:text-white transition-colors"
                                                    onClick={() => setStep('email-bind')}
                                                >
                                                    Изменить Email
                                                </button>
                                            </div>
                                        </form>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>

                    {/* Footer Links */}
                    <div className="mt-16 text-center text-xs text-gray-500 space-y-2">
                        <div className="flex justify-center gap-4">
                            <Link href="/terms" className="hover:text-gray-400 transition-colors">Условия использования</Link>
                            <span>•</span>
                            <Link href="/privacy" className="hover:text-gray-400 transition-colors">Политика конфиденциальности</Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
