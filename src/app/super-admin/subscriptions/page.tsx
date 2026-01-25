"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { CreditCard } from "lucide-react"

export default function SuperAdminSubscriptionsPage() {
    return (
        <div className="p-8">
            <h1 className="text-3xl font-bold mb-6">Подписки</h1>
            <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                    <CardTitle className="text-zinc-100">Управление тарифами</CardTitle>
                    <CardDescription className="text-zinc-400">Мониторинг активных подписок и платежей</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center p-12">
                    <CreditCard className="h-16 w-16 text-zinc-700 mb-4" />
                    <p className="text-zinc-500 text-center max-w-sm">
                        Раздел биллинга находится в разработке. Здесь можно будет управлять тарифами и статусами подписок клубов.
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
