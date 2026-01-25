"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Users } from "lucide-react"

export default function SuperAdminUsersPage() {
    return (
        <div className="p-8">
            <h1 className="text-3xl font-bold mb-6">Пользователи</h1>
            <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                    <CardTitle className="text-zinc-100">Список пользователей</CardTitle>
                    <CardDescription className="text-zinc-400">Управление учетными записями владельцев и сотрудников</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center p-12">
                    <Users className="h-16 w-16 text-zinc-700 mb-4" />
                    <p className="text-zinc-500 text-center max-w-sm">
                        Раздел управления пользователями находится в разработке. Здесь будет таблица всех зарегистрированных юзеров.
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
