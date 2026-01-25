"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Construction } from "lucide-react"

export default function FinancePage() {
    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold mb-6">Финансы</h1>
            <Card>
                <CardHeader>
                    <CardTitle>Раздел в разработке</CardTitle>
                    <CardDescription>Скоро здесь появится управление финансами клуба</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center p-12">
                    <Construction className="h-24 w-24 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground text-center max-w-sm">
                        Мы работаем над этим разделом. Здесь можно будет отслеживать доходы, расходы и финансовую аналитику.
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
