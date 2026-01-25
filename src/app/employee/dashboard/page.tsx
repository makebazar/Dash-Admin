"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Building2, Loader2, ChevronRight, Briefcase } from "lucide-react"

interface Club {
    id: number
    name: string
    role: string
}

export default function EmployeeDashboard() {
    const router = useRouter()
    const [clubs, setClubs] = useState<Club[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        try {
            const res = await fetch('/api/auth/me')
            const data = await res.json()

            if (res.ok) {
                setClubs(data.employeeClubs)
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

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="p-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight">Рабочее пространство</h1>
                <p className="text-muted-foreground">
                    Выберите клуб для начала работы
                </p>
            </div>

            {clubs.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-purple-500/10">
                            <Building2 className="h-8 w-8 text-purple-600" />
                        </div>
                        <h3 className="mb-2 text-xl font-semibold">Нет клубов</h3>
                        <p className="text-center text-sm text-muted-foreground">
                            Вы пока не добавлены ни в один клуб.<br />
                            Обратитесь к администратору для получения доступа.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {clubs.map((club) => (
                        <Link key={club.id} href={`/employee/clubs/${club.id}`}>
                            <Card className="group relative overflow-hidden transition-all hover:shadow-lg hover:shadow-purple-500/20">
                                <div className="absolute right-0 top-0 h-32 w-32 -translate-y-8 translate-x-8 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 blur-2xl transition-transform group-hover:scale-150" />
                                <CardHeader className="relative">
                                    <div className="mb-4 flex items-center justify-between">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr from-purple-500 to-blue-500">
                                            <Building2 className="h-6 w-6 text-white" />
                                        </div>
                                        <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
                                    </div>
                                    <CardTitle className="text-xl">{club.name}</CardTitle>
                                    <CardDescription className="flex items-center gap-2">
                                        <Briefcase className="h-3 w-3" />
                                        {club.role}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="relative">
                                    <div className="flex items-center gap-2 text-sm text-purple-600">
                                        <span>Открыть рабочее пространство</span>
                                        <ChevronRight className="h-4 w-4" />
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    )
}
