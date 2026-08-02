"use client"

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PhoneInput } from '@/components/ui/phone-input'
import { validatePhone } from '@/lib/phone-utils'
import { Zap, Loader2, ArrowRight, AlertCircle, Eye, EyeOff, UserCheck } from 'lucide-react'

type InviteInfo = {
    valid: boolean
    role: string
    club_name: string
    club_address?: string
    email?: string
    currentUser?: {
        id: string
        full_name: string
        email?: string
        phone_number?: string
    } | null
}

export default function AcceptInvitePage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = use(params)
    const router = useRouter()

    const [invite, setInvite] = useState<InviteInfo | null>(null)
    const [status, setStatus] = useState<'loading' | 'valid' | 'error'>('loading')
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    // Steps: 'phone-check' -> 'existing-login' OR 'new-user-form' -> 'otp' OR 'reset-confirm'
    const [step, setStep] = useState<'phone-check' | 'existing-login' | 'new-user-form' | 'otp' | 'reset-confirm'>('phone-check')

    // Existing User data
    const [existingFullName, setExistingFullName] = useState('')
    const [maskedEmail, setMaskedEmail] = useState('')

    // Form fields
    const [phone, setPhone] = useState('')
    const [fullName, setFullName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [code, setCode] = useState('')

    const [showPassword, setShowPassword] = useState(false)
    const [showNewPassword, setShowNewPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [debugCode, setDebugCode] = useState<string | null>(null)

    const redirectAfterAuth = async () => {
        try {
            const res = await fetch('/api/auth/me')
            const data = await res.json()

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
        } catch {
            router.push('/employee/dashboard')
        }
    }

    useEffect(() => {
        const fetchInvite = async () => {
            try {
                const res = await fetch(`/api/invitations/${token}`)
                const data = await res.json()

                if (res.ok && data.valid) {
                    setInvite(data)
                    if (data.email) setEmail(data.email)
                    setStatus('valid')
                } else {
                    setErrorMessage(data.error || 'Ссылка недействительна')
                    setStatus('error')
                }
            } catch (err) {
                console.error(err)
                setErrorMessage('Ошибка подключения')
                setStatus('error')
            }
        }

        fetchInvite()
    }, [token])

    // STEP 1: Check phone number
    const handleCheckPhone = async (e: React.FormEvent) => {
        e.preventDefault()
        setErrorMessage(null)

        if (!validatePhone(phone)) {
            setErrorMessage('Введите ваш номер телефона полностью')
            return
        }

        setIsLoading(true)
        try {
            const res = await fetch(`/api/invitations/${token}/check-phone`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phoneNumber: phone })
            })
            const data = await res.json()

            if (res.ok && data.userExists) {
                setExistingFullName(data.fullName || 'Сотрудник')
                if (data.email) setEmail(data.email)
                if (data.maskedEmail) setMaskedEmail(data.maskedEmail)
                setStep('existing-login')
            } else {
                setStep('new-user-form')
            }
        } catch (err) {
            console.error(err)
            setErrorMessage('Ошибка проверки телефона')
        } finally {
            setIsLoading(false)
        }
    }

    // STEP 2A: Existing User Password Login & Accept Invite
    const handleExistingUserLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setErrorMessage(null)

        if (!password) {
            setErrorMessage('Введите ваш пароль')
            return
        }

        setIsLoading(true)
        try {
            const res = await fetch('/api/auth/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phoneNumber: phone,
                    password,
                    inviteToken: token
                })
            })
            const data = await res.json()

            if (res.ok && data.success) {
                await redirectAfterAuth()
            } else {
                setErrorMessage(data.error || 'Неверный пароль')
            }
        } catch (err) {
            console.error(err)
            setErrorMessage('Ошибка входа')
        } finally {
            setIsLoading(false)
        }
    }

    // STEP 2A-RESET: Request Password Reset by Phone
    const handleRequestReset = async () => {
        setErrorMessage(null)
        setIsLoading(true)
        try {
            const res = await fetch('/api/auth/request-password-reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phoneNumber: phone }),
            })
            const data = await res.json()

            if (res.ok && data.success) {
                setEmail(data.email)
                setMaskedEmail(data.maskedEmail)
                setStep('reset-confirm')
                setDebugCode(data.debugCode || null)
            } else {
                setErrorMessage(data.error || 'Не удалось отправить код сброса')
            }
        } catch (err) {
            console.error(err)
            setErrorMessage('Ошибка подключения')
        } finally {
            setIsLoading(false)
        }
    }

    // STEP 2A-CONFIRM: Submit Reset Code & New Password
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
            const resetRes = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code, newPassword }),
            })
            const resetData = await resetRes.json()

            if (!resetRes.ok || !resetData.success) {
                setErrorMessage(resetData.error || 'Ошибка сброса пароля')
                return
            }

            // Accept invitation for user with invite token
            await fetch(`/api/invitations/${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            })

            await redirectAfterAuth()
        } catch (err) {
            console.error(err)
            setErrorMessage('Ошибка сервера')
        } finally {
            setIsLoading(false)
        }
    }

    // STEP 2B: New User Request OTP
    const handleNewUserSendCode = async (e: React.FormEvent) => {
        e.preventDefault()
        setErrorMessage(null)

        const trimmedEmail = email.trim().toLowerCase()
        if (!trimmedEmail || !trimmedEmail.includes('@')) {
            setErrorMessage('Введите ваш рабочий Email')
            return
        }

        if (!fullName.trim()) {
            setErrorMessage('Введите ваше Имя и Фамилию')
            return
        }

        if (!password || password.length < 4) {
            setErrorMessage('Придумайте пароль (минимум 4 символа)')
            return
        }

        if (/[а-яА-ЯёЁ]/.test(password)) {
            setErrorMessage('Пароль не должен содержать русские буквы (кириллицу). Используйте только латиницу.')
            return
        }

        setIsLoading(true)
        try {
            const res = await fetch('/api/auth/otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: trimmedEmail, inviteToken: token }),
            })
            const data = await res.json()

            if (data.success) {
                setStep('otp')
                setDebugCode(data.debugCode || null)
            } else {
                setErrorMessage(data.error || 'Не удалось отправить код')
            }
        } catch (err) {
            console.error(err)
            setErrorMessage('Ошибка отправки кода')
        } finally {
            setIsLoading(false)
        }
    }

    // STEP 2B-OTP: Verify OTP Code & Register
    const handleVerifyAndAccept = async (e: React.FormEvent) => {
        e.preventDefault()
        setErrorMessage(null)

        if (code.length < 6) {
            setErrorMessage('Введите 6-значный код полностью')
            return
        }

        setIsLoading(true)
        try {
            const res = await fetch('/api/auth/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: email.trim().toLowerCase(),
                    phoneNumber: phone,
                    password,
                    code,
                    inviteToken: token,
                    fullName: fullName.trim()
                }),
            })
            const data = await res.json()

            if (data.success) {
                await redirectAfterAuth()
            } else {
                setErrorMessage(data.error || 'Ошибка активации приглашения')
            }
        } catch (err) {
            console.error(err)
            setErrorMessage('Ошибка сервера')
        } finally {
            setIsLoading(false)
        }
    }

    // 1-Click Accept for already logged in user
    const handleAcceptForLoggedInUser = async () => {
        setIsLoading(true)
        setErrorMessage(null)
        try {
            const res = await fetch(`/api/invitations/${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            })
            const data = await res.json()

            if (res.ok && data.success) {
                await redirectAfterAuth()
            } else {
                setErrorMessage(data.error || 'Не удалось принять приглашение')
            }
        } catch (err) {
            console.error(err)
            setErrorMessage('Ошибка подключения к серверу')
        } finally {
            setIsLoading(false)
        }
    }

    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center font-sans">
                <Loader2 className="w-8 h-8 animate-spin text-white mb-4" />
                <p className="text-gray-400 text-sm font-medium tracking-wide">Проверка приглашения...</p>
            </div>
        )
    }

    if (status === 'error') {
        return (
            <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center font-sans">
                <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center text-red-400 mb-6">
                    <AlertCircle className="w-8 h-8" />
                </div>
                <h1 className="text-2xl font-bold mb-2">Недействительное приглашение</h1>
                <p className="text-gray-400 text-sm max-w-xs mb-8 leading-relaxed">{errorMessage}</p>
                <Link href="/login">
                    <Button className="rounded-full bg-white text-black hover:bg-gray-200 px-8 h-12 font-medium">
                        Перейти ко входу
                    </Button>
                </Link>
            </div>
        )
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
                        Приглашение<br />в команду<br />клуба.
                    </h2>
                    <p className="text-xl text-gray-400 max-w-md leading-relaxed">
                        Получите доступ к рабочей смене, задачам и системе управления клубом.
                    </p>
                </div>
            </div>

            {/* Form Container (Right Side) */}
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
                            className="space-y-6"
                        >
                            <div className="mb-6">
                                <h1 className="text-3xl font-bold tracking-tight mb-3">Приглашение сотрудника</h1>
                                <p className="text-gray-400 text-sm leading-snug">
                                    Вступайте в команду клуба <span className="text-white font-medium">{invite?.club_name}</span>
                                </p>
                            </div>

                            {/* IF USER IS ALREADY LOGGED IN CURRENT BROWSER SESSION */}
                            {invite?.currentUser ? (
                                <div className="space-y-6">
                                    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                                                <UserCheck className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <div className="text-xs text-gray-400">Вы вошли как</div>
                                                <div className="font-bold text-white text-base">{invite.currentUser.full_name || 'Сотрудник'}</div>
                                                <div className="text-xs text-gray-400">{invite.currentUser.email || invite.currentUser.phone_number}</div>
                                            </div>
                                        </div>

                                        <div className="border-t border-white/10 pt-3 flex justify-between text-xs text-gray-300">
                                            <span>Назначаемая роль:</span>
                                            <span className="font-semibold text-white bg-white/10 px-2 py-0.5 rounded-md">{invite.role}</span>
                                        </div>
                                    </div>

                                    {errorMessage && (
                                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                                            {errorMessage}
                                        </div>
                                    )}

                                    <Button
                                        onClick={handleAcceptForLoggedInUser}
                                        className="w-full bg-white text-black hover:bg-gray-200 h-12 rounded-full font-medium text-base transition-all flex items-center justify-center gap-2"
                                        disabled={isLoading}
                                    >
                                        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                                        <span>Принять приглашение</span>
                                        <ArrowRight className="w-5 h-5" />
                                    </Button>
                                </div>
                            ) : (
                                <>
                                    {/* STEP 1: INPUT PHONE NUMBER TO CHECK */}
                                    {step === 'phone-check' && (
                                        <form onSubmit={handleCheckPhone} className="space-y-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="phone" className="text-sm font-medium text-gray-200">
                                                    Введите ваш номер телефона
                                                </Label>
                                                <PhoneInput
                                                    id="phone"
                                                    value={phone}
                                                    onChange={setPhone}
                                                    placeholder="+7 (999) 000-00-00"
                                                />
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
                                                <span>Продолжить</span>
                                                <ArrowRight className="w-5 h-5" />
                                            </Button>

                                            <div className="pt-2 text-center">
                                                <Link href="/login" className="text-xs text-gray-400 hover:text-white transition-colors underline underline-offset-4">
                                                    Уже есть аккаунт? Перейти ко входу
                                                </Link>
                                            </div>
                                        </form>
                                    )}

                                    {/* STEP 2A: EXISTING USER FOUND - ENTER PASSWORD */}
                                    {step === 'existing-login' && (
                                        <form onSubmit={handleExistingUserLogin} className="space-y-4">
                                            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl text-sm space-y-1">
                                                <div className="text-xs text-blue-400 font-semibold uppercase">Найден профиль в системе</div>
                                                <div className="font-bold text-white text-base">{existingFullName}</div>
                                                <div className="text-xs text-gray-400">{phone}</div>
                                            </div>

                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <Label htmlFor="existing-password" className="text-sm font-medium text-gray-200">
                                                        Введите ваш пароль
                                                    </Label>
                                                    <button
                                                        type="button"
                                                        className="text-xs text-gray-400 hover:text-white transition-colors underline underline-offset-4"
                                                        onClick={handleRequestReset}
                                                    >
                                                        Забыли пароль?
                                                    </button>
                                                </div>
                                                <div className="relative">
                                                    <Input
                                                        id="existing-password"
                                                        type={showPassword ? "text" : "password"}
                                                        placeholder="••••••••"
                                                        value={password}
                                                        onChange={(e) => setPassword(e.target.value)}
                                                        className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus-visible:ring-1 focus-visible:ring-blue-500/50 h-12 rounded-xl pr-10 transition-all"
                                                        required
                                                        autoFocus
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
                                                className="w-full bg-white text-black hover:bg-gray-200 h-12 rounded-full font-medium text-base transition-all flex items-center justify-center gap-2 mt-2"
                                                disabled={isLoading}
                                            >
                                                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                                                <span>Войти и вступить в клуб</span>
                                                <ArrowRight className="w-5 h-5" />
                                            </Button>

                                            <div className="pt-2 text-center">
                                                <button
                                                    type="button"
                                                    className="text-xs text-gray-400 hover:text-white transition-colors"
                                                    onClick={() => setStep('phone-check')}
                                                >
                                                    Ввести другой номер
                                                </button>
                                            </div>
                                        </form>
                                    )}

                                    {/* STEP 2A-RESET: RESET PASSWORD VIA OTP CODE & SET NEW PASSWORD */}
                                    {step === 'reset-confirm' && (
                                        <form onSubmit={handleConfirmPasswordReset} className="space-y-4">
                                            <div className="mb-4">
                                                <h1 className="text-2xl font-bold tracking-tight mb-2">Новый пароль</h1>
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
                                                        className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus-visible:ring-1 focus-visible:ring-blue-500/50 h-12 text-base rounded-xl pr-10 transition-all"
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
                                                <span>Сохранить новый пароль и вступить</span>
                                                <ArrowRight className="w-5 h-5" />
                                            </Button>

                                            <div className="pt-2 text-center">
                                                <button
                                                    type="button"
                                                    className="text-xs text-gray-400 hover:text-white transition-colors"
                                                    onClick={() => setStep('existing-login')}
                                                >
                                                    Вернуться назад
                                                </button>
                                            </div>
                                        </form>
                                    )}

                                    {/* STEP 2B: NEW USER REGISTRATION FORM */}
                                    {step === 'new-user-form' && (
                                        <form onSubmit={handleNewUserSendCode} className="space-y-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="fullName" className="text-sm font-medium text-gray-200">Ваше Имя и Фамилия</Label>
                                                <Input
                                                    id="fullName"
                                                    placeholder="Иван Иванов"
                                                    value={fullName}
                                                    onChange={(e) => setFullName(e.target.value)}
                                                    className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus-visible:ring-1 focus-visible:ring-blue-500/50 h-12 rounded-xl transition-all"
                                                    required
                                                    autoFocus
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="phone-read" className="text-sm font-medium text-gray-200">Номер телефона</Label>
                                                <PhoneInput
                                                    id="phone-read"
                                                    value={phone}
                                                    onChange={setPhone}
                                                    placeholder="+7 (999) 000-00-00"
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="email" className="text-sm font-medium text-gray-200">Рабочий Email</Label>
                                                <Input
                                                    id="email"
                                                    type="email"
                                                    placeholder="name@company.com"
                                                    value={email}
                                                    onChange={(e) => setEmail(e.target.value)}
                                                    className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus-visible:ring-1 focus-visible:ring-blue-500/50 h-12 rounded-xl transition-all"
                                                    required
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="password" className="text-sm font-medium text-gray-200">Придумайте пароль</Label>
                                                <div className="relative">
                                                    <Input
                                                        id="password"
                                                        type={showPassword ? "text" : "password"}
                                                        placeholder="••••••••"
                                                        value={password}
                                                        onChange={(e) => setPassword(e.target.value)}
                                                        className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus-visible:ring-1 focus-visible:ring-blue-500/50 h-12 rounded-xl pr-10 transition-all"
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
                                                className="w-full bg-white text-black hover:bg-gray-200 h-12 rounded-full font-medium text-base transition-all flex items-center justify-center gap-2 mt-2"
                                                disabled={isLoading}
                                            >
                                                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                                                <span>Получить код на Email</span>
                                                <ArrowRight className="w-5 h-5" />
                                            </Button>

                                            <div className="pt-2 text-center">
                                                <button
                                                    type="button"
                                                    className="text-xs text-gray-400 hover:text-white transition-colors"
                                                    onClick={() => setStep('phone-check')}
                                                >
                                                    Изменить номер телефона
                                                </button>
                                            </div>
                                        </form>
                                    )}

                                    {/* STEP 2B-OTP: VERIFY OTP CODE FOR NEW USER */}
                                    {step === 'otp' && (
                                        <form onSubmit={handleVerifyAndAccept} className="space-y-4">
                                            <div className="mb-4">
                                                <h1 className="text-2xl font-bold tracking-tight mb-2">Подтверждение Email</h1>
                                                <p className="text-gray-400 text-sm">
                                                    Код подтверждения отправлен на <span className="text-white font-medium">{email}</span>
                                                </p>
                                            </div>

                                            <div className="space-y-2">
                                                <Input
                                                    id="code"
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
                                                <span>Подтвердить и вступить</span>
                                                <ArrowRight className="w-5 h-5" />
                                            </Button>

                                            <div className="pt-2 text-center">
                                                <button
                                                    type="button"
                                                    className="text-xs text-gray-400 hover:text-white transition-colors"
                                                    onClick={() => setStep('new-user-form')}
                                                >
                                                    Изменить данные
                                                </button>
                                            </div>
                                        </form>
                                    )}
                                </>
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
