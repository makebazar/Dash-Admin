"use client"

import Link from "next/link"
import { useParams, useSearchParams } from "next/navigation"
import { ArrowLeft, FileText, MapPin, Settings2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { PageHeader, PageShell } from "@/components/layout/PageShell"
import { InstructionsTab } from "../inventory/InstructionsTab"
import { EquipmentTypesTab } from "./EquipmentTypesTab"
import { ZonesSettingsTab } from "./ZonesSettingsTab"

export default function EquipmentSettingsPage() {
    const { clubId } = useParams()
    const searchParams = useSearchParams()
    const initialTab = searchParams.get("tab") === "zones"
        ? "zones"
        : searchParams.get("tab") === "types"
            ? "types"
            : searchParams.get("tab") === "other"
                ? "other"
                : "standards"

    return (
        <PageShell maxWidth="7xl">
            <div className="space-y-6">
                <PageHeader
                    title="Настройки оборудования"
                    description="Стандарты обслуживания и другие параметры модуля оборудования."
                >
                    <Button asChild variant="outline" className="h-10">
                        <Link href={`/clubs/${clubId}/equipment`}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Назад
                        </Link>
                    </Button>
                </PageHeader>

                <Tabs defaultValue={initialTab} className="space-y-6">
                    <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-xl border bg-white p-1">
                        <TabsTrigger value="standards" className="gap-2 rounded-lg px-4 py-2 text-sm">
                            <FileText className="h-4 w-4" />
                            Стандарты
                        </TabsTrigger>
                        <TabsTrigger value="zones" className="gap-2 rounded-lg px-4 py-2 text-sm">
                            <MapPin className="h-4 w-4" />
                            Зоны
                        </TabsTrigger>
                        <TabsTrigger value="types" className="gap-2 rounded-lg px-4 py-2 text-sm">
                            <Settings2 className="h-4 w-4" />
                            Типы оборудования
                        </TabsTrigger>
                        <TabsTrigger value="other" className="gap-2 rounded-lg px-4 py-2 text-sm">
                            <Settings2 className="h-4 w-4" />
                            Другие настройки
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="standards" className="mt-0 space-y-6">
                        <InstructionsTab />
                    </TabsContent>

                    <TabsContent value="zones" className="mt-0 space-y-6">
                        <ZonesSettingsTab clubId={clubId as string} />
                    </TabsContent>

                    <TabsContent value="types" className="mt-0 space-y-6">
                        <EquipmentTypesTab />
                    </TabsContent>

                    <TabsContent value="other" className="mt-0">
                        <Card className="border-dashed shadow-sm">
                            <CardHeader>
                                <CardTitle>Другие настройки оборудования</CardTitle>
                                <CardDescription>
                                    Здесь будет место для следующих параметров модуля.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm text-muted-foreground">
                                <p>Пока дополнительных настроек нет.</p>
                                <p>Следующие логичные кандидаты: правила списания, гарантия, уведомления и автоматизация обслуживания.</p>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </PageShell>
    )
}
