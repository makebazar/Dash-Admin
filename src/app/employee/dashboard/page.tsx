"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Building2, Loader2, ChevronRight, Briefcase, Plus } from "lucide-react"

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
        <div className="container mx-auto p-4 sm:p-8">
            <div className="mb-10 flex flex-col gap-2">
                <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Рабочее пространство</h1>
                <p className="text-slate-500">
                    Выберите клуб для начала работы
                </p>
            </div>

            {clubs.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                            <Building2 className="h-8 w-8 text-slate-400" />
                        </div>
                        <h3 className="mb-2 text-xl font-semibold">Нет клубов</h3>
                        <p className="text-center text-sm text-slate-500">
                            Вы пока не добавлены ни в один клуб.<br />
                            Обратитесь к администратору для получения доступа.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {clubs.map((club) => (
                        <Link key={club.id} href={`/employee/clubs/${club.id}`}>
                            <div className="group relative flex h-full min-h-[180px] cursor-pointer flex-col justify-between rounded-2xl border border-black/5 bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-black/10">
                                <div className="flex items-start justify-between">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-900 transition-colors group-hover:bg-purple-600 group-hover:text-white">
                                        <Building2 className="h-6 w-6" />
                                    </div>
                                    <ChevronRight className="h-5 w-5 text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-purple-600" />
                                </div>

                                <div className="mt-4">
                                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-black">{club.name}</h3>
                                    <p className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                                        <Briefcase className="h-3.5 w-3.5" />
                                        {club.role}
                                    </p>
                                </div>

                                <div className="mt-6 flex items-center justify-between border-t border-slate-50 pt-4">
                                    <span className="text-[10px] font-medium uppercase tracking-wider text-purple-600">
                                        Открыть рабочее пространство
                                    </span>
                                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition-colors group-hover:bg-purple-600 group-hover:text-white">
                                        <Plus className="h-3 w-3" />
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    )
}
