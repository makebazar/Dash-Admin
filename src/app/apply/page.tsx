"use client"

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Zap, Loader2, ArrowLeft, CheckCircle2, ArrowRight } from 'lucide-react'

export default function ApplyPage() {
    const [fullName, setFullName] = useState('')
    const [email, setEmail] = useState('')
    const [phone, setPhone] = useState('')
    const [clubName, setClubName] = useState('')
    const [city, setCity] = useState('')
    const [comment, setComment] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [isSubmitted, setIsSubmitted] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        if (!fullName || !email) {
            setError('Пожалуйста, заполните Имя и Email')
            return
        }

        setIsLoading(true)
        try {
            const res = await fetch('/api/applications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    full_name: fullName,
                    email,
                    phone_number: phone,
                    club_name: clubName,
                    city,
                    comment
                })
            })
            const data = await res.json()

            if (res.ok && data.success) {
                setIsSubmitted(true)
            } else {
                setError(data.error || 'Не удалось отправить заявку')
            }
        } catch (err) {
            console.error(err)
            setError('Ошибка сети. Попробуйте еще раз.')
        } finally {
            setIsLoading(false)
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
                        Подключение<br />вашего клуба<br />к платформе.
                    </h2>
                    <p className="text-xl text-gray-400 max-w-md leading-relaxed">
                        Оставьте заявку, и мы настроим доступ и подготовим систему под вашу сеть.
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

                    <Link href="/login" className="inline-flex items-center gap-2 text-xs text-gray-400 hover:text-white mb-6 transition-colors">
                        <ArrowLeft className="w-4 h-4" /> Назад ко входу
                    </Link>

                    <div className="mb-6">
                        <h1 className="text-3xl font-bold tracking-tight mb-3">Заявка на подключение</h1>
                        <p className="text-gray-400 text-sm leading-snug">
                            Заполните форму, и мы свяжемся с вами для выдачи доступа
                        </p>
                    </div>

                    {isSubmitted ? (
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="py-8 text-center space-y-4">
                            <div className="w-16 h-16 bg-green-500/20 text-green-400 border border-green-500/30 rounded-full flex items-center justify-center mx-auto">
                                <CheckCircle2 className="w-8 h-8" />
                            </div>
                            <h2 className="text-xl font-bold">Заявка успешно отправлена!</h2>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                Мы получили ваши данные и свяжемся с вами по указанному Email в ближайшее время.
                            </p>
                            <div className="pt-4">
                                <Link href="/login">
                                    <Button className="w-full rounded-full bg-white text-black hover:bg-gray-200 h-12 font-medium">
                                        Вернуться на главную
                                    </Button>
                                </Link>
                            </div>
                        </motion.div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="fullName" className="text-sm font-medium text-gray-200">Ваше Имя и Фамилия *</Label>
                                <Input
                                    id="fullName"
                                    placeholder="Иван Иванов"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus-visible:ring-1 focus-visible:ring-blue-500/50 h-12 rounded-xl transition-all"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-sm font-medium text-gray-200">Email адрес *</Label>
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

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label htmlFor="clubName" className="text-sm font-medium text-gray-200">Название клуба</Label>
                                    <Input
                                        id="clubName"
                                        placeholder="Cyber Arena"
                                        value={clubName}
                                        onChange={(e) => setClubName(e.target.value)}
                                        className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus-visible:ring-1 focus-visible:ring-blue-500/50 h-12 rounded-xl transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="city" className="text-sm font-medium text-gray-200">Город</Label>
                                    <Input
                                        id="city"
                                        placeholder="Москва"
                                        value={city}
                                        onChange={(e) => setCity(e.target.value)}
                                        className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus-visible:ring-1 focus-visible:ring-blue-500/50 h-12 rounded-xl transition-all"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="comment" className="text-sm font-medium text-gray-200">Комментарий</Label>
                                <Textarea
                                    id="comment"
                                    placeholder="Детали или пожелания..."
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus-visible:ring-1 focus-visible:ring-blue-500/50 min-h-[70px] rounded-xl transition-all"
                                />
                            </div>

                            {error && (
                                <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-xl">
                                    {error}
                                </div>
                            )}

                            <Button type="submit" className="w-full bg-white text-black hover:bg-gray-200 h-12 rounded-full font-medium text-base transition-all flex items-center justify-center gap-2 mt-2" disabled={isLoading}>
                                {isLoading ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                    <>
                                        <span>Отправить заявку</span>
                                        <ArrowRight className="w-5 h-5" />
                                    </>
                                )}
                            </Button>
                        </form>
                    )}

                    {/* Footer Links */}
                    <div className="mt-12 text-center text-xs text-gray-500 space-y-2">
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
