"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { ChevronLeft, FileText, Settings2, Wrench } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageShell } from "@/components/layout/PageShell"
import { InstructionsTab } from "../inventory/InstructionsTab"

export default function EquipmentSettingsPage() {
    const { clubId } = useParams()

    return (
        <PageShell maxWidth="7xl">
            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <Link href={`/clubs/${clubId}/equipment`} className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors">
                        <div className="rounded-full p-2 hover:bg-slate-100">
                            <ChevronLeft className="h-5 w-5" />
                        </div>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Настройки оборудования</h1>
                        <p className="text-sm text-muted-foreground">Инструкции, регламенты и будущие параметры модуля оборудования</p>
                    </div>
                </div>

                <Tabs defaultValue="instructions" className="space-y-6">
                    <TabsList>
                        <TabsTrigger value="instructions">Инструкции</TabsTrigger>
                        <TabsTrigger value="other">Другие настройки</TabsTrigger>
                    </TabsList>

                    <TabsContent value="instructions" className="space-y-6">
                        <Card className="border-none shadow-sm bg-gradient-to-br from-white to-slate-50">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <FileText className="h-5 w-5 text-violet-500" />
                                    Инструкции для персонала
                                </CardTitle>
                                <CardDescription>
                                    Настрой регламенты обслуживания и базовые интервалы по типам оборудования.
                                </CardDescription>
                            </CardHeader>
                        </Card>
                        <InstructionsTab />
                    </TabsContent>

                    <TabsContent value="other" className="space-y-6">
                        <div className="grid gap-6 lg:grid-cols-2">
                            <Card className="border-none shadow-sm">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-lg">
                                        <Settings2 className="h-5 w-5 text-slate-600" />
                                        Общие настройки
                                    </CardTitle>
                                    <CardDescription>
                                        Здесь будут жить дополнительные параметры оборудования.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3 text-sm text-muted-foreground">
                                    <p>Подходит для будущих настроек статусов, правил списания, гарантий и поведения модулей.</p>
                                    <p>Сейчас раздел подготовлен как логичное место для дальнейшего расширения.</p>
                                </CardContent>
                            </Card>

                            <Card className="border-none shadow-sm">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-lg">
                                        <Wrench className="h-5 w-5 text-indigo-500" />
                                        Что можно добавить дальше
                                    </CardTitle>
                                    <CardDescription>
                                        Заготовка под следующие настройки модуля.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-2 text-sm text-muted-foreground">
                                    <p>• Правила обслуживания по зонам</p>
                                    <p>• Глобальные интервалы чистки</p>
                                    <p>• Настройки гарантий и уведомлений</p>
                                    <p>• Категории и шаблоны действий</p>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </PageShell>
    )
}
