"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Loader2, ShieldCheck, Zap } from "lucide-react"

type MeResponse = {
    user?: {
        full_name?: string
        is_super_admin?: boolean
        legal_acceptance_required?: boolean
    }
    ownedClubs?: Array<any>
    employeeClubs?: Array<any>
}

export default function LegalConsentPage() {
    const router = useRouter()
    const [isChecking, setIsChecking] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [hasAccepted, setHasAccepted] = useState(false)
    const [fullName, setFullName] = useState("")

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

        const load = async () => {
            try {
                const res = await fetch('/api/auth/me')
                if (!res.ok) {
                    router.push('/login')
                    return
                }

                const data = await res.json() as MeResponse
                if (cancelled) return

                setFullName(data.user?.full_name || "")

                if (!data.user?.legal_acceptance_required) {
                    routeFromMe(data)
                    return
                }
            } catch {
                if (!cancelled) router.push('/login')
            } finally {
                if (!cancelled) setIsChecking(false)
            }
        }

        load()

        return () => {
            cancelled = true
        }
    }, [routeFromMe, router])

    const handleAccept = async (event: React.FormEvent) => {
        event.preventDefault()
        if (!hasAccepted) return

        setIsSubmitting(true)
        try {
            const res = await fetch('/api/legal-consent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accepted: true, source: 'existing-user' })
            })
            const data = await res.json()

            if (!res.ok) {
                alert(data.error || 'Не удалось сохранить согласие')
                return
            }

            const meRes = await fetch('/api/auth/me')
            const meData = await meRes.json() as MeResponse
            routeFromMe(meData)
        } catch (error) {
            console.error(error)
            alert('Ошибка сохранения согласия')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="min-h-screen bg-black text-white flex flex-col md:flex-row font-sans selection:bg-blue-500/30">
            {/* Visual Anchor (Left Side) - Same as /login */}
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
                        Подтверждение<br />юридических<br />условий.
                    </h2>
                    <p className="text-xl text-gray-400 max-w-md leading-relaxed">
                        Пользовательское соглашение и политика конфиденциальности DashAdmin.
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

                    <div className="mb-6">
                        <h1 className="text-3xl font-bold tracking-tight mb-3">Подтвердите согласие</h1>
                        <p className="text-gray-400 text-sm leading-snug">
                            {fullName ? `${fullName}, ` : ''}для продолжения работы примите актуальные юридические документы
                        </p>
                    </div>

                    {isChecking ? (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-3">
                            <Loader2 className="h-6 w-6 animate-spin text-white" />
                            <span className="text-sm font-medium">Проверка статуса...</span>
                        </div>
                    ) : (
                        <form onSubmit={handleAccept} className="space-y-6">
                            <div className="flex items-start gap-3 p-4 bg-white/5 border border-white/10 rounded-2xl">
                                <Checkbox
                                    id="consent-checkbox"
                                    checked={hasAccepted}
                                    onCheckedChange={(checked) => setHasAccepted(checked === true)}
                                    className="mt-1 border-white/30 data-[state=checked]:border-white data-[state=checked]:bg-white data-[state=checked]:text-black"
                                />
                                <Label htmlFor="consent-checkbox" className="text-sm leading-relaxed text-gray-300">
                                    Я принимаю{" "}
                                    <Link href="/terms" target="_blank" className="text-white underline underline-offset-4 hover:text-gray-300">
                                        Пользовательское соглашение
                                    </Link>
                                    {" "}и{" "}
                                    <Link href="/privacy" target="_blank" className="text-white underline underline-offset-4 hover:text-gray-300">
                                        Политику конфиденциальности
                                    </Link>
                                </Label>
                            </div>

                            <Button
                                type="submit"
                                className="w-full bg-white text-black hover:bg-gray-200 h-12 rounded-full font-medium text-base transition-all flex items-center justify-center gap-2"
                                disabled={isSubmitting || !hasAccepted}
                            >
                                {isSubmitting ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                    <>
                                        <ShieldCheck className="w-5 h-5" />
                                        <span>Принять и продолжить</span>
                                    </>
                                )}
                            </Button>
                        </form>
                    )}

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
