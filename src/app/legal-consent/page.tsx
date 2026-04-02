"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
        <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
            <div className="w-full max-w-lg">
                <div className="mb-8 flex items-center justify-center gap-2">
                    <div className="w-10 h-10 bg-gradient-to-tr from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
                        <Zap className="text-white w-6 h-6 fill-current" />
                    </div>
                    <span className="font-bold text-2xl tracking-tight">DashAdmin</span>
                </div>

                <Card className="bg-gray-900/50 border-white/10 backdrop-blur-md">
                    <CardHeader>
                        <CardTitle className="text-2xl text-white">Подтвердите согласие</CardTitle>
                        <CardDescription className="text-gray-400">
                            {fullName ? `${fullName}, ` : ''}нужно принять актуальные юридические документы, чтобы продолжить работу
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isChecking ? (
                            <div className="flex items-center justify-center py-10 text-gray-400">
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Проверяем статус…
                            </div>
                        ) : (
                            <form onSubmit={handleAccept} className="space-y-5">
                                <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-gray-400">
                                    После подтверждения в профиле будет зафиксирована текущая версия соглашения и политики.
                                </div>

                                <div className="rounded-lg border border-white/10 bg-black/30 p-4">
                                    <div className="flex items-start gap-3">
                                        <Checkbox
                                            id="consent-checkbox"
                                            checked={hasAccepted}
                                            onCheckedChange={(checked) => setHasAccepted(checked === true)}
                                            className="mt-0.5 border-white/20 data-[state=checked]:border-white data-[state=checked]:bg-white data-[state=checked]:text-black"
                                        />
                                        <Label htmlFor="consent-checkbox" className="text-sm leading-6 text-gray-300">
                                            Я принимаю{" "}
                                            <Link href="/terms" className="text-white transition-colors hover:text-gray-300">
                                                Пользовательское соглашение
                                            </Link>
                                            {" "}и{" "}
                                            <Link href="/privacy" className="text-white transition-colors hover:text-gray-300">
                                                Политику конфиденциальности
                                            </Link>
                                        </Label>
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    className="w-full bg-white text-black hover:bg-gray-200"
                                    disabled={isSubmitting || !hasAccepted}
                                >
                                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                                    Принять и продолжить
                                </Button>
                            </form>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
