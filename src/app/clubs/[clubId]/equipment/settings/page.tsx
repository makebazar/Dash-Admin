"use client"

import Link from "next/link"
import { useParams, useSearchParams } from "next/navigation"
import { ArrowLeft, ChevronLeft, FileText, MapPin, Settings2 } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { PageShell } from "@/components/layout/PageShell"
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
            : "standards"

    return (
        <PageShell maxWidth="5xl">
            <div className="space-y-8 pb-28 sm:pb-12">
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between mb-8">
                        <div className="min-w-0">
                            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 truncate">Настройки оборудования</h1>
                            <p className="text-slate-500 text-lg mt-2">Стандарты обслуживания и другие параметры модуля оборудования.</p>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:justify-end">
                            <Button asChild variant="outline" className="hidden md:inline-flex md:w-auto rounded-xl h-11 px-6 font-medium">
                                <Link href={`/clubs/${clubId}/equipment`}>
                                    <ChevronLeft className="mr-2 h-4 w-4" />
                                    Назад
                                </Link>
                            </Button>
                        </div>
                    </div>
                </div>

                <Tabs defaultValue={initialTab} className="w-full">
                    <div className="flex justify-between items-end mb-8 border-b border-slate-200">
                        <TabsList className="flex h-auto w-full justify-start gap-8 overflow-x-auto rounded-none bg-transparent p-0">
                            <TabsTrigger value="standards" className="relative shrink-0 rounded-none border-b-2 border-transparent px-0 pb-4 pt-2 font-medium text-slate-500 hover:text-slate-700 data-[state=active]:border-slate-900 data-[state=active]:text-slate-900 data-[state=active]:shadow-none data-[state=active]:bg-transparent transition-all gap-2">
                                <FileText className="h-4 w-4" />
                                Стандарты
                            </TabsTrigger>
                            <TabsTrigger value="zones" className="relative shrink-0 rounded-none border-b-2 border-transparent px-0 pb-4 pt-2 font-medium text-slate-500 hover:text-slate-700 data-[state=active]:border-slate-900 data-[state=active]:text-slate-900 data-[state=active]:shadow-none data-[state=active]:bg-transparent transition-all gap-2">
                                <MapPin className="h-4 w-4" />
                                Зоны
                            </TabsTrigger>
                            <TabsTrigger value="types" className="relative shrink-0 rounded-none border-b-2 border-transparent px-0 pb-4 pt-2 font-medium text-slate-500 hover:text-slate-700 data-[state=active]:border-slate-900 data-[state=active]:text-slate-900 data-[state=active]:shadow-none data-[state=active]:bg-transparent transition-all gap-2">
                                <Settings2 className="h-4 w-4" />
                                Типы оборудования
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="standards" className="mt-0 space-y-6">
                        <InstructionsTab />
                    </TabsContent>

                    <TabsContent value="zones" className="mt-0 space-y-6">
                        <ZonesSettingsTab clubId={clubId as string} />
                    </TabsContent>

                    <TabsContent value="types" className="mt-0 space-y-6">
                        <EquipmentTypesTab />
                    </TabsContent>
                </Tabs>

                {/* Mobile Bottom Back Button */}
                <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/80 p-4 backdrop-blur-xl md:hidden pb-[calc(1rem+env(safe-area-inset-bottom))]">
                    <div className="mx-auto flex max-w-[1600px] gap-2">
                        <Button asChild variant="outline" className="flex-1 h-12 rounded-xl border-slate-200 text-slate-700 bg-white font-medium">
                            <Link href={`/clubs/${clubId}/equipment`}>
                                <ChevronLeft className="mr-2 h-4 w-4" />
                                Назад
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>
        </PageShell>
    )
}
