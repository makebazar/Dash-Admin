"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Building2, Loader2, ChevronRight, User, Shield, CheckCircle2 } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

interface Club {
    id: number
    name: string
    address?: string
    role: string
}

export default function EmployeeDashboard() {
    const router = useRouter()
    const [clubs, setClubs] = useState<Club[]>([])
    const [isLoading, setIsLoading] = useState(true)
    
    // Profile settings states
    const [fullName, setFullName] = useState("")
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [isSavingName, setIsSavingName] = useState(false)
    const [isSavingPassword, setIsSavingPassword] = useState(false)
    const [nameSuccess, setNameSuccess] = useState(false)
    const [passwordSuccess, setPasswordSuccess] = useState(false)
    const [passwordError, setPasswordError] = useState("")

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        try {
            const res = await fetch('/api/auth/me')
            const data = await res.json()

            if (res.ok) {
                setClubs(data.employeeClubs || [])
                setFullName(data.user?.full_name || "")
            } else {
                router.push('/login')
            }
        } catch (error) {
            console.error('Error fetching data:', error)
            router.push('/login')
        } finally {
            setIsLoading(false)
        }
    }

    const handleSaveName = async () => {
        if (!fullName.trim()) return
        setIsSavingName(true)
        setNameSuccess(false)
        try {
            const res = await fetch('/api/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ full_name: fullName })
            })
            if (res.ok) {
                setNameSuccess(true)
                setTimeout(() => setNameSuccess(false), 3000)
            }
        } catch (error) {
            console.error(error)
        } finally {
            setIsSavingName(false)
        }
    }

    const handleSavePassword = async () => {
        if (!password || !confirmPassword) return
        setPasswordError("")
        if (password !== confirmPassword) {
            setPasswordError("Пароли не совпадают")
            return
        }
        if (password.length < 6) {
            setPasswordError("Пароль должен быть не менее 6 символов")
            return
        }
        setIsSavingPassword(true)
        setPasswordSuccess(false)
        try {
            const res = await fetch('/api/auth/set-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password, confirm_password: confirmPassword })
            })
            const data = await res.json()
            if (res.ok) {
                setPasswordSuccess(true)
                setPassword("")
                setConfirmPassword("")
                setTimeout(() => setPasswordSuccess(false), 3000)
            } else {
                setPasswordError(data.error || "Ошибка при сохранении пароля")
            }
        } catch (error) {
            console.error(error)
            setPasswordError("Внутренняя ошибка сервера")
        } finally {
            setIsSavingPassword(false)
        }
    }

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="w-full max-w-4xl mx-auto p-4 sm:p-8 py-12">
            <div className="mb-10 space-y-2">
                <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Рабочее пространство</h1>
                <p className="text-muted-foreground">
                    Управление клубами и профилем
                </p>
            </div>

            <Tabs defaultValue="clubs" className="space-y-6">
                <TabsList className="bg-card border border-border">
                    <TabsTrigger value="clubs" className="data-[state=active]:bg-accent data-[state=active]:text-foreground">Клубы</TabsTrigger>
                    <TabsTrigger value="profile" className="data-[state=active]:bg-accent data-[state=active]:text-foreground">Настройки профиля</TabsTrigger>
                </TabsList>

                <TabsContent value="clubs" className="space-y-6">
                    {clubs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 rounded-xl border border-dashed bg-accent/30">
                            <Building2 className="h-10 w-10 text-muted-foreground/30 mb-4" />
                            <h3 className="mb-1 text-lg font-medium text-foreground">Нет доступных клубов</h3>
                            <p className="text-center text-sm text-muted-foreground max-w-[250px]">
                                Вы пока не добавлены ни в один клуб. Обратитесь к администратору.
                            </p>
                        </div>
                    ) : (
                        <div className="grid gap-3 sm:grid-cols-2">
                            {clubs.map((club) => (
                                <Link key={club.id} href={`/employee/clubs/${club.id}`}>
                                    <div className="group flex items-center justify-between rounded-xl border bg-card p-5 transition-colors hover:bg-accent/50 hover:border-border">
                                        <div className="flex items-center gap-4">
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-foreground group-hover:bg-background">
                                                <Building2 className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <h3 className="text-base font-semibold text-foreground">{club.name}</h3>
                                                <div className="flex flex-col gap-0.5 mt-0.5">
                                                    <p className="text-sm text-muted-foreground">
                                                        Должность: {club.role}
                                                    </p>
                                                    {club.address && (
                                                        <p className="text-xs text-muted-foreground/70">
                                                            {club.address}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <ChevronRight className="h-5 w-5 text-muted-foreground/50 transition-transform group-hover:translate-x-1 group-hover:text-foreground" />
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="profile" className="space-y-6">
                    <div className="grid gap-6 md:grid-cols-2">
                        <Card className="bg-card border-border">
                            <CardHeader>
                                <div className="flex items-center gap-2 mb-1">
                                    <User className="h-5 w-5 text-muted-foreground" />
                                    <CardTitle>Личные данные</CardTitle>
                                </div>
                                <CardDescription>
                                    Как к вам обращаться
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="fullName">Имя и фамилия</Label>
                                    <Input 
                                        id="fullName" 
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        className="bg-background border-border"
                                        placeholder="Иван Иванов"
                                    />
                                </div>
                                <Button 
                                    onClick={handleSaveName} 
                                    disabled={isSavingName || !fullName.trim()}
                                    className="w-full sm:w-auto"
                                >
                                    {isSavingName && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Сохранить имя
                                </Button>
                                {nameSuccess && (
                                    <div className="flex items-center gap-2 text-sm text-emerald-500 mt-2">
                                        <CheckCircle2 className="h-4 w-4" />
                                        Имя успешно обновлено
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="bg-card border-border">
                            <CardHeader>
                                <div className="flex items-center gap-2 mb-1">
                                    <Shield className="h-5 w-5 text-muted-foreground" />
                                    <CardTitle>Безопасность</CardTitle>
                                </div>
                                <CardDescription>
                                    Смена пароля для входа
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="password">Новый пароль</Label>
                                    <Input 
                                        id="password" 
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="bg-background border-border"
                                        placeholder="••••••"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="confirmPassword">Подтвердите пароль</Label>
                                    <Input 
                                        id="confirmPassword" 
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="bg-background border-border"
                                        placeholder="••••••"
                                    />
                                </div>
                                {passwordError && (
                                    <p className="text-sm text-rose-500">{passwordError}</p>
                                )}
                                <Button 
                                    onClick={handleSavePassword} 
                                    disabled={isSavingPassword || !password || !confirmPassword}
                                    variant="secondary"
                                    className="w-full sm:w-auto"
                                >
                                    {isSavingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Обновить пароль
                                </Button>
                                {passwordSuccess && (
                                    <div className="flex items-center gap-2 text-sm text-emerald-500 mt-2">
                                        <CheckCircle2 className="h-4 w-4" />
                                        Пароль успешно изменен
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}
