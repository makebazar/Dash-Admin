"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Package } from "lucide-react"

export default function InventoryPage() {
    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold mb-6">Склад</h1>
            <Card>
                <CardHeader>
                    <CardTitle>Раздел в разработке</CardTitle>
                    <CardDescription>Скоро здесь появится управление инвентарем и товарами</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center p-12">
                    <Package className="h-24 w-24 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground text-center max-w-sm">
                        Мы работаем над этим разделом. Здесь можно будет вести учет товаров, проводить инвентаризации и управлять поставками.
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
