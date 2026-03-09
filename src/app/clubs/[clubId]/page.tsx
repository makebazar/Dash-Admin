import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function ClubDashboardPage() {
    return (
        <div className="min-h-full p-4 md:p-8 bg-slate-50/60">
            <Card className="max-w-3xl border-dashed">
                <CardHeader>
                    <CardTitle>Дашборд временно отключен</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        Раздел находится в переработке. Скоро здесь будет новый дашборд.
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
