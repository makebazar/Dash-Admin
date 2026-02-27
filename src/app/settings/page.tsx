"use client"

import { Sidebar, useSidebarLogic } from "@/components/layout/Sidebar"
import { MobileNav } from "@/components/layout/MobileNav"
import { SidebarContent } from "@/components/layout/Sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { User, Bell, Shield, Key, Moon, Sun, Smartphone } from "lucide-react"
import { useState, useEffect } from "react"
import { useTheme } from "next-themes"

export default function SettingsPage() {
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = useState(false)
    const [profile, setProfile] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(true)

    // Sidebar Logic
    const sidebarLogic = useSidebarLogic()

    useEffect(() => {
        setMounted(true)
        fetchProfile()
    }, [])

    const fetchProfile = async () => {
        try {
            const res = await fetch('/api/auth/me')
            if (res.ok) {
                const data = await res.json()
                setProfile(data)
            }
        } catch (error) {
            console.error('Error fetching profile:', error)
        } finally {
            setIsLoading(false)
        }
    }

    if (!mounted) return null

    return (
        <div className="flex min-h-screen bg-background flex-col md:flex-row">
            <Sidebar 
                clubs={[]} 
                hasEmployeeClubs={sidebarLogic.hasEmployeeClubs}
                handleLogout={sidebarLogic.handleLogout}
            />

            <div className="md:hidden">
                <MobileNav>
                    <SidebarContent 
                        clubs={[]}
                        hasEmployeeClubs={sidebarLogic.hasEmployeeClubs}
                        handleLogout={sidebarLogic.handleLogout}
                    />
                </MobileNav>
            </div>

            <main className="flex-1 p-4 md:p-8 md:ml-64 w-full max-w-full overflow-hidden">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold tracking-tight">Настройки</h1>
                    <p className="text-muted-foreground">
                        Управление вашим профилем и предпочтениями
                    </p>
                </div>

                <Tabs defaultValue="profile" className="space-y-4">
                    <TabsList>
                        <TabsTrigger value="profile">Профиль</TabsTrigger>
                        <TabsTrigger value="appearance">Внешний вид</TabsTrigger>
                        <TabsTrigger value="notifications">Уведомления</TabsTrigger>
                        <TabsTrigger value="security">Безопасность</TabsTrigger>
                    </TabsList>

                    <TabsContent value="profile">
                        <Card>
                            <CardHeader>
                                <CardTitle>Профиль пользователя</CardTitle>
                                <CardDescription>
                                    Личная информация и контакты
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="phone">Номер телефона</Label>
                                    <Input id="phone" value={profile?.phone || ''} disabled />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="name">Имя</Label>
                                    <Input id="name" defaultValue="Николай" />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input id="email" type="email" placeholder="email@example.com" />
                                </div>
                                <Button>Сохранить изменения</Button>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="appearance">
                        <Card>
                            <CardHeader>
                                <CardTitle>Внешний вид</CardTitle>
                                <CardDescription>
                                    Настройте тему оформления приложения
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-3 gap-4">
                                    <button
                                        onClick={() => setTheme("light")}
                                        className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all hover:bg-accent ${
                                            theme === "light" ? "border-primary" : "border-transparent"
                                        }`}
                                    >
                                        <Sun className="h-6 w-6" />
                                        <span className="text-sm font-medium">Светлая</span>
                                    </button>
                                    <button
                                        onClick={() => setTheme("dark")}
                                        className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all hover:bg-accent ${
                                            theme === "dark" ? "border-primary" : "border-transparent"
                                        }`}
                                    >
                                        <Moon className="h-6 w-6" />
                                        <span className="text-sm font-medium">Темная</span>
                                    </button>
                                    <button
                                        onClick={() => setTheme("system")}
                                        className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all hover:bg-accent ${
                                            theme === "system" ? "border-primary" : "border-transparent"
                                        }`}
                                    >
                                        <Smartphone className="h-6 w-6" />
                                        <span className="text-sm font-medium">Системная</span>
                                    </button>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="notifications">
                        <Card>
                            <CardHeader>
                                <CardTitle>Уведомления</CardTitle>
                                <CardDescription>
                                    Выберите, какие уведомления вы хотите получать
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground">
                                    Настройки уведомлений будут доступны в ближайшее время.
                                </p>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="security">
                        <Card>
                            <CardHeader>
                                <CardTitle>Безопасность</CardTitle>
                                <CardDescription>
                                    Управление паролем и сессиями
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="current-password">Текущий пароль</Label>
                                    <Input id="current-password" type="password" />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="new-password">Новый пароль</Label>
                                    <Input id="new-password" type="password" />
                                </div>
                                <Button>Обновить пароль</Button>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    )
}
