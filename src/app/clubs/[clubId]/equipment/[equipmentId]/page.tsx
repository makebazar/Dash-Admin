"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation"
import {
    AlertCircle,
    ArrowLeft,
    ArrowRightLeft,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Info,
    Loader2,
    RefreshCw,
    Save,
    Wrench,
    X,
} from "lucide-react"
import { PageHeader, PageShell } from "@/components/layout/PageShell"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { EQUIPMENT_STATUS_LABELS, type EquipmentStatus } from "@/lib/equipment-status"

type HistoryActionType = "MAINTENANCE" | "REWORK" | "MOVE" | "ISSUE"
type HistoryFilter = "all" | "maintenance" | "move" | "issue"
type EquipmentTab = "details" | "maintenance" | "history"

interface Equipment {
    id: string
    name: string
    type: string
    type_name: string
    type_icon: string
    identifier: string | null
    brand: string | null
    model: string | null
    workstation_id: string | null
    workstation_name: string | null
    workstation_zone: string | null
    warranty_expires: string | null
    last_cleaned_at: string | null
    cleaning_interval_days?: number
    is_active: boolean
    notes: string | null
    maintenance_enabled?: boolean
    assigned_user_id?: string | null
    open_issues_count?: number
    status: EquipmentStatus
    purchase_date?: string | null
    price?: number | null
}

interface EquipmentType {
    code: string
    name_ru: string
    icon: string
}

interface Workstation {
    id: string
    name: string
    zone: string
}

interface Employee {
    id: string
    full_name: string
    role?: string
    is_active?: boolean
    dismissed_at?: string | null
}

interface HistoryLog {
    id: string
    action_type: HistoryActionType
    action: string
    date: string
    user_name: string | null
    details: string | null
    photos?: string[]
}

export default function EquipmentDetailsPage() {
    const { clubId, equipmentId } = useParams()
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const getInitialTab = (): EquipmentTab => {
        const tab = searchParams.get("tab")
        return tab === "maintenance" || tab === "history" ? tab : "details"
    }

    const [activeTab, setActiveTab] = useState<EquipmentTab>(getInitialTab())
    const [equipment, setEquipment] = useState<Equipment | null>(null)
    const [types, setTypes] = useState<EquipmentType[]>([])
    const [workstations, setWorkstations] = useState<Workstation[]>([])
    const [employees, setEmployees] = useState<Employee[]>([])
    const [history, setHistory] = useState<HistoryLog[]>([])
    const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all")
    const [historyPhotoViewer, setHistoryPhotoViewer] = useState<{ images: string[]; index: number } | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [isHistoryLoading, setIsHistoryLoading] = useState(false)

    useEffect(() => {
        setActiveTab(getInitialTab())
    }, [searchParams])

    const maintenanceResponsibleEmployees = useMemo(
        () => employees.filter(emp =>
            (emp.role === "Админ" || emp.role === "Управляющий") &&
            emp.is_active !== false &&
            !emp.dismissed_at
        ),
        [employees]
    )

    const filteredHistory = useMemo(() => {
        if (historyFilter === "all") return history
        return history.filter(log => {
            if (historyFilter === "maintenance") {
                return log.action_type === "MAINTENANCE" || log.action_type === "REWORK"
            }
            if (historyFilter === "move") {
                return log.action_type === "MOVE"
            }
            return log.action_type === "ISSUE"
        })
    }, [history, historyFilter])

    const groupedHistory = useMemo(() => {
        return filteredHistory.reduce<Array<{ label: string; items: HistoryLog[] }>>((groups, log) => {
            const itemDate = new Date(log.date)
            const today = new Date()
            const yesterday = new Date()
            yesterday.setDate(today.getDate() - 1)

            const isSameDay = (a: Date, b: Date) =>
                a.getFullYear() === b.getFullYear() &&
                a.getMonth() === b.getMonth() &&
                a.getDate() === b.getDate()

            const label = isSameDay(itemDate, today)
                ? "Сегодня"
                : isSameDay(itemDate, yesterday)
                    ? "Вчера"
                    : itemDate.toLocaleDateString("ru-RU", {
                        day: "numeric",
                        month: "long",
                        year: today.getFullYear() === itemDate.getFullYear() ? undefined : "numeric",
                    })

            const existingGroup = groups.find(group => group.label === label)
            if (existingGroup) {
                existingGroup.items.push(log)
            } else {
                groups.push({ label, items: [log] })
            }

            return groups
        }, [])
    }, [filteredHistory])

    const fetchPageData = async () => {
        setIsLoading(true)
        try {
            const [equipmentRes, typesRes, workstationsRes, employeesRes] = await Promise.all([
                fetch(`/api/clubs/${clubId}/equipment/${equipmentId}`, { cache: "no-store" }),
                fetch(`/api/equipment-types?clubId=${clubId}`, { cache: "no-store" }),
                fetch(`/api/clubs/${clubId}/workstations`, { cache: "no-store" }),
                fetch(`/api/clubs/${clubId}/employees`, { cache: "no-store" }),
            ])

            if (!equipmentRes.ok) {
                setEquipment(null)
                return
            }

            const [equipmentData, typesData, workstationsData, employeesData] = await Promise.all([
                equipmentRes.json(),
                typesRes.json(),
                workstationsRes.json(),
                employeesRes.json(),
            ])

            setEquipment(equipmentData)
            setTypes(Array.isArray(typesData) ? typesData : [])
            setWorkstations(Array.isArray(workstationsData) ? workstationsData : [])
            setEmployees(Array.isArray(employeesData?.employees) ? employeesData.employees : [])
        } catch (error) {
            console.error("Error loading equipment page:", error)
            setEquipment(null)
        } finally {
            setIsLoading(false)
        }
    }

    const fetchHistory = async () => {
        setIsHistoryLoading(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/equipment/${equipmentId}/history`, { cache: "no-store" })
            const data = await res.json()
            if (res.ok) {
                setHistory(Array.isArray(data) ? data : [])
            }
        } catch (error) {
            console.error("Error fetching equipment history:", error)
        } finally {
            setIsHistoryLoading(false)
        }
    }

    useEffect(() => {
        fetchPageData()
    }, [clubId, equipmentId])

    useEffect(() => {
        const query = activeTab === "details" ? pathname : `${pathname}?tab=${activeTab}`
        router.replace(query, { scroll: false })
    }, [activeTab, pathname, router])

    useEffect(() => {
        if (activeTab === "history" && equipment?.id) {
            fetchHistory()
        }
    }, [activeTab, equipment?.id])

    const getMaintenanceActionLabel = (action: string) => {
        switch (action) {
            case "CLEANING":
                return "Плановое обслуживание"
            case "REPAIR":
                return "Ремонт"
            case "INSPECTION":
                return "Проверка"
            case "REPLACEMENT":
                return "Замена"
            default:
                return action
        }
    }

    const getHistoryPresentation = (log: HistoryLog) => {
        if (log.action_type === "MAINTENANCE") {
            return {
                icon: <Wrench className="h-4 w-4" />,
                badgeLabel: "Обслуживание",
                badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
                title: getMaintenanceActionLabel(log.action),
                description: log.details?.trim() || "Задача обслуживания выполнена без дополнительного комментария.",
            }
        }

        if (log.action_type === "MOVE") {
            return {
                icon: <ArrowRightLeft className="h-4 w-4" />,
                badgeLabel: "Перемещение",
                badgeClassName: "border-blue-200 bg-blue-50 text-blue-700",
                title: "Перемещение оборудования",
                description: log.details?.trim() || "Оборудование было перемещено без указанной причины.",
            }
        }

        if (log.action_type === "REWORK") {
            return {
                icon: <RefreshCw className="h-4 w-4" />,
                badgeLabel: "Доработка",
                badgeClassName: "border-amber-200 bg-amber-50 text-amber-700",
                title: `Отправлено на доработку: ${getMaintenanceActionLabel(log.action)}`,
                description: log.details?.trim() || "Задача возвращена на доработку без указанного комментария.",
            }
        }

        return {
            icon: <AlertCircle className="h-4 w-4" />,
            badgeLabel: "Инцидент",
            badgeClassName: "border-rose-200 bg-rose-50 text-rose-700",
            title: log.action,
            description: log.details?.trim() || "Инцидент зафиксирован без подробного описания.",
        }
    }

    const formatHistoryTime = (date: string) =>
        new Date(date).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })

    const handleSave = async (e?: React.FormEvent) => {
        e?.preventDefault()
        if (!equipment?.name || !equipment?.type) return

        setIsSaving(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/equipment/${equipment.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(equipment),
            })

            if (res.ok) {
                const updated = await res.json()
                setEquipment(prev => ({ ...prev, ...updated }))
                if (activeTab === "history") {
                    fetchHistory()
                }
            }
        } catch (error) {
            console.error("Error saving equipment:", error)
        } finally {
            setIsSaving(false)
        }
    }

    const openHistoryPhotoViewer = (images: string[], index: number) => {
        setHistoryPhotoViewer({ images, index })
    }

    const closeHistoryPhotoViewer = () => {
        setHistoryPhotoViewer(null)
    }

    const showNextHistoryPhoto = () => {
        setHistoryPhotoViewer(prev => {
            if (!prev || prev.index >= prev.images.length - 1) return prev
            return { ...prev, index: prev.index + 1 }
        })
    }

    const showPrevHistoryPhoto = () => {
        setHistoryPhotoViewer(prev => {
            if (!prev || prev.index <= 0) return prev
            return { ...prev, index: prev.index - 1 }
        })
    }

    if (isLoading) {
        return (
            <PageShell maxWidth="7xl">
                <div className="flex min-h-[50vh] items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                </div>
            </PageShell>
        )
    }

    if (!equipment) {
        return (
            <PageShell maxWidth="4xl">
                <PageHeader title="Карточка оборудования" description="Оборудование не найдено или недоступно." />
                <Card>
                    <CardContent className="p-6">
                        <Button asChild variant="outline">
                            <Link href={`/clubs/${clubId}/equipment/inventory`}>
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Вернуться в инвентарь
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            </PageShell>
        )
    }

    return (
        <PageShell maxWidth="7xl">
            <div className="space-y-6">
                <PageHeader
                    title={equipment.name || "Карточка оборудования"}
                    description={equipment.type_name || equipment.type}
                >
                    <div className="hidden md:flex items-center gap-2">
                        <Button asChild variant="outline" className="h-10">
                            <Link href={`/clubs/${clubId}/equipment/inventory`}>
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                В инвентарь
                            </Link>
                        </Button>
                        <Button
                            form="equipment-page-form"
                            type="submit"
                            disabled={isSaving || activeTab === "history"}
                            className="h-10"
                        >
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            <Save className="mr-2 h-4 w-4" />
                            Сохранить
                        </Button>
                    </div>
                </PageHeader>

                <Card className="overflow-hidden border-none shadow-sm">
                    <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as EquipmentTab)} className="flex flex-col">
                        <div className="border-b bg-slate-50 px-4 sm:px-6">
                            <TabsList className="h-auto w-full justify-start gap-4 overflow-x-auto bg-transparent p-0">
                                <TabsTrigger value="details" className="shrink-0 rounded-none border-b-2 border-transparent bg-transparent px-0 py-3 data-[state=active]:border-primary data-[state=active]:shadow-none">
                                    <span className="sm:hidden">Основное</span>
                                    <span className="hidden sm:inline">Основные данные</span>
                                </TabsTrigger>
                                <TabsTrigger value="maintenance" className="shrink-0 rounded-none border-b-2 border-transparent bg-transparent px-0 py-3 data-[state=active]:border-primary data-[state=active]:shadow-none">
                                    <span className="sm:hidden">Сервис</span>
                                    <span className="hidden sm:inline">Обслуживание</span>
                                </TabsTrigger>
                                <TabsTrigger value="history" className="shrink-0 rounded-none border-b-2 border-transparent bg-transparent px-0 py-3 data-[state=active]:border-primary data-[state=active]:shadow-none">
                                    История
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <div className="bg-white">
                            <form id="equipment-page-form" onSubmit={handleSave} className="p-4 sm:p-6">
                                <TabsContent value="details" className="mt-0 space-y-6">
                                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                        <div className="md:col-span-2 space-y-2">
                                            <Label>Название <span className="text-rose-500">*</span></Label>
                                            <Input
                                                placeholder="Название модели"
                                                value={equipment.name || ""}
                                                onChange={(e) => setEquipment(prev => prev ? { ...prev, name: e.target.value } : prev)}
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Тип</Label>
                                            <Select
                                                value={equipment.type}
                                                onValueChange={(val) => setEquipment(prev => prev ? { ...prev, type: val } : prev)}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Выберите тип" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {types.map(t => (
                                                        <SelectItem key={t.code} value={t.code}>{t.name_ru}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Серийный номер / ID</Label>
                                            <Input
                                                placeholder="SN12345678"
                                                value={equipment.identifier || ""}
                                                onChange={(e) => setEquipment(prev => prev ? { ...prev, identifier: e.target.value } : prev)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Бренд</Label>
                                            <Input
                                                placeholder="Напр: ASUS, Logitech"
                                                value={equipment.brand || ""}
                                                onChange={(e) => setEquipment(prev => prev ? { ...prev, brand: e.target.value } : prev)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Модель</Label>
                                            <Input
                                                placeholder="Напр: G502 Hero"
                                                value={equipment.model || ""}
                                                onChange={(e) => setEquipment(prev => prev ? { ...prev, model: e.target.value } : prev)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Локация (Рабочее место)</Label>
                                            <Select
                                                value={equipment.workstation_id || "unassigned"}
                                                onValueChange={(val) => setEquipment(prev => prev ? { ...prev, workstation_id: val === "unassigned" ? null : val } : prev)}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Склад" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="unassigned">Склад (Не назначено)</SelectItem>
                                                    {workstations.map(w => (
                                                        <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Статус оборудования</Label>
                                            <Select
                                                value={equipment.status}
                                                onValueChange={(val: EquipmentStatus) => setEquipment(prev => prev ? {
                                                    ...prev,
                                                    status: val,
                                                    is_active: val !== "WRITTEN_OFF",
                                                } : prev)}
                                            >
                                                <SelectTrigger className="bg-slate-50">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="ACTIVE">{EQUIPMENT_STATUS_LABELS.ACTIVE}</SelectItem>
                                                    <SelectItem value="STORAGE">{EQUIPMENT_STATUS_LABELS.STORAGE}</SelectItem>
                                                    <SelectItem value="REPAIR">{EQUIPMENT_STATUS_LABELS.REPAIR}</SelectItem>
                                                    <SelectItem value="WRITTEN_OFF">{EQUIPMENT_STATUS_LABELS.WRITTEN_OFF}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <Separator />

                                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label>Дата покупки</Label>
                                            <Input
                                                type="date"
                                                value={equipment.purchase_date || ""}
                                                onChange={(e) => setEquipment(prev => prev ? { ...prev, purchase_date: e.target.value } : prev)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Срок гарантии до</Label>
                                            <Input
                                                type="date"
                                                value={equipment.warranty_expires || ""}
                                                onChange={(e) => setEquipment(prev => prev ? { ...prev, warranty_expires: e.target.value } : prev)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Цена (₽)</Label>
                                            <Input
                                                type="number"
                                                placeholder="0"
                                                value={equipment.price || ""}
                                                onChange={(e) => setEquipment(prev => prev ? { ...prev, price: Number(e.target.value) } : prev)}
                                            />
                                        </div>
                                        <div className="md:col-span-2 space-y-2">
                                            <Label>Заметки / Примечания</Label>
                                            <Textarea
                                                placeholder="Любая дополнительная информация..."
                                                className="resize-none"
                                                value={equipment.notes || ""}
                                                onChange={(e) => setEquipment(prev => prev ? { ...prev, notes: e.target.value } : prev)}
                                            />
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="maintenance" className="mt-0 space-y-6">
                                    <div className="flex gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
                                        <Info className="h-5 w-5 shrink-0 text-blue-500" />
                                        <div className="text-sm text-blue-700">
                                            <p className="font-semibold">Настройка обслуживания</p>
                                            <ul className="mt-1 ml-4 list-disc space-y-1 opacity-80">
                                                <li>Если ответственный не назначен, задачи на чистку создаваться не будут.</li>
                                                <li>Назначьте конкретного сотрудника или выберите свободный пул.</li>
                                            </ul>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between rounded-xl border p-4">
                                            <div className="space-y-0.5">
                                                <Label className="text-base font-bold">Обслуживание</Label>
                                                <p className="text-xs text-muted-foreground">Включает напоминания о необходимости чистки</p>
                                            </div>
                                            <Switch
                                                checked={equipment.maintenance_enabled}
                                                onCheckedChange={(val) => setEquipment(prev => prev ? {
                                                    ...prev,
                                                    maintenance_enabled: val,
                                                    assigned_user_id: val ? prev.assigned_user_id : null,
                                                } : prev)}
                                            />
                                        </div>

                                        {equipment.maintenance_enabled && (
                                            <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                                                <div className="space-y-2">
                                                    <Label>Ответственный за обслуживание</Label>
                                                    <Select
                                                        value={equipment.assigned_user_id ? equipment.assigned_user_id : (equipment.maintenance_enabled ? "free_pool" : "none")}
                                                        onValueChange={(val) => {
                                                            if (val === "free_pool") {
                                                                setEquipment(prev => prev ? {
                                                                    ...prev,
                                                                    assigned_user_id: null,
                                                                    maintenance_enabled: true,
                                                                } : prev)
                                                                return
                                                            }
                                                            const userId = val === "none" ? null : val
                                                            setEquipment(prev => prev ? {
                                                                ...prev,
                                                                assigned_user_id: userId,
                                                                maintenance_enabled: !!userId,
                                                            } : prev)
                                                        }}
                                                    >
                                                        <SelectTrigger className="bg-white">
                                                            <SelectValue placeholder="Не назначено" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="none">Не назначено</SelectItem>
                                                            <SelectItem value="free_pool">🤝 Свободный пул</SelectItem>
                                                            {maintenanceResponsibleEmployees.map(emp => (
                                                                <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <p className="text-[10px] italic text-muted-foreground">
                                                        При выборе сотрудника обслуживание включается автоматически.
                                                    </p>
                                                </div>

                                                <div className="space-y-2 border-t border-slate-200/50 pt-2">
                                                    <Label>Интервал обслуживания</Label>
                                                    <div className="rounded-xl border bg-white px-4 py-3">
                                                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                                            <div>
                                                                <p className="text-sm font-medium text-slate-900">
                                                                    {`${equipment.cleaning_interval_days ?? 30} дн.`}
                                                                </p>
                                                                <p className="text-[10px] text-muted-foreground">
                                                                    Интервал задаётся в стандартах обслуживания по типу оборудования.
                                                                </p>
                                                            </div>
                                                            <Link
                                                                href={`/clubs/${clubId}/equipment/settings`}
                                                                className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                                                            >
                                                                Открыть настройки
                                                            </Link>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {equipment.last_cleaned_at && (
                                            <div className="flex items-center justify-between rounded-xl border bg-slate-50 p-4">
                                                <div className="flex items-center gap-2">
                                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                                    <span className="text-sm font-medium">Последнее обслуживание</span>
                                                </div>
                                                <span className="text-sm text-muted-foreground">
                                                    {new Date(equipment.last_cleaned_at).toLocaleDateString("ru-RU")}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </TabsContent>

                                <TabsContent value="history" className="mt-0">
                                    <div className="space-y-5">
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                            <div>
                                                <h3 className="text-base font-semibold text-slate-950">История событий</h3>
                                                <p className="text-sm text-muted-foreground">
                                                    Перемещения, обслуживание и инциденты по этому оборудованию.
                                                </p>
                                            </div>

                                            <div className="flex flex-wrap gap-2">
                                                {[
                                                    { value: "all", label: "Все" },
                                                    { value: "maintenance", label: "Обслуживание" },
                                                    { value: "move", label: "Перемещения" },
                                                    { value: "issue", label: "Инциденты" },
                                                ].map((filterOption) => (
                                                    <Button
                                                        key={filterOption.value}
                                                        type="button"
                                                        variant={historyFilter === filterOption.value ? "default" : "outline"}
                                                        size="sm"
                                                        className={cn(
                                                            "h-8 rounded-full px-3 text-xs",
                                                            historyFilter === filterOption.value && "bg-slate-900 hover:bg-slate-800"
                                                        )}
                                                        onClick={() => setHistoryFilter(filterOption.value as HistoryFilter)}
                                                    >
                                                        {filterOption.label}
                                                    </Button>
                                                ))}
                                            </div>
                                        </div>

                                        {isHistoryLoading ? (
                                            <div className="flex justify-center py-8">
                                                <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
                                            </div>
                                        ) : history.length === 0 ? (
                                            <div className="rounded-2xl border border-dashed bg-slate-50 px-4 py-10 text-center text-sm italic text-muted-foreground">
                                                История изменений пуста
                                            </div>
                                        ) : filteredHistory.length === 0 ? (
                                            <div className="rounded-2xl border border-dashed bg-slate-50 px-4 py-10 text-center text-sm italic text-muted-foreground">
                                                Для выбранного фильтра событий пока нет
                                            </div>
                                        ) : (
                                            groupedHistory.map((group) => (
                                                <div key={group.label} className="space-y-3">
                                                    <div className="px-1 py-1">
                                                        <div className="inline-flex items-center rounded-full border bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                                                            {group.label}
                                                        </div>
                                                    </div>

                                                    <div className="space-y-3">
                                                        {group.items.map((log) => {
                                                            const presentation = getHistoryPresentation(log)

                                                            return (
                                                                <div key={`${group.label}-${log.id}`} className="relative pl-12">
                                                                    <div className="absolute top-0 bottom-0 left-[18px] w-px bg-slate-200" />
                                                                    <div className={cn(
                                                                        "absolute left-0 top-5 flex h-9 w-9 items-center justify-center rounded-xl border bg-white",
                                                                        presentation.badgeClassName
                                                                    )}>
                                                                        {presentation.icon}
                                                                    </div>

                                                                    <div className="rounded-2xl border bg-white p-4">
                                                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                                            <div className="min-w-0 space-y-2">
                                                                                <div className="flex flex-wrap items-center gap-2">
                                                                                    <Badge variant="outline" className={cn("rounded-full border text-[10px] font-semibold", presentation.badgeClassName)}>
                                                                                        {presentation.badgeLabel}
                                                                                    </Badge>
                                                                                    <span className="text-xs text-slate-400">
                                                                                        {formatHistoryTime(log.date)}
                                                                                    </span>
                                                                                </div>
                                                                                <div>
                                                                                    <p className="text-sm font-semibold text-slate-950">{presentation.title}</p>
                                                                                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{presentation.description}</p>
                                                                                </div>

                                                                                {Array.isArray(log.photos) && log.photos.length > 0 && (
                                                                                    <div className="space-y-2 pt-1">
                                                                                        <div className="flex items-center justify-between gap-3">
                                                                                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                                                                                                Прикреплённые фото
                                                                                            </p>
                                                                                            <span className="text-[11px] text-slate-400">
                                                                                                {log.photos.length} шт.
                                                                                            </span>
                                                                                        </div>

                                                                                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                                                                                            {log.photos.map((photo, photoIndex) => (
                                                                                                <button
                                                                                                    key={`${log.id}-photo-${photoIndex}`}
                                                                                                    type="button"
                                                                                                    onClick={() => openHistoryPhotoViewer(log.photos || [], photoIndex)}
                                                                                                    className="relative aspect-[4/3] overflow-hidden rounded-xl border bg-slate-100"
                                                                                                >
                                                                                                    <img
                                                                                                        src={photo}
                                                                                                        alt={`Фото события ${presentation.title} ${photoIndex + 1}`}
                                                                                                        className="h-full w-full object-cover"
                                                                                                    />
                                                                                                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-2 py-1 text-left text-[10px] font-medium text-white">
                                                                                                        Открыть
                                                                                                    </div>
                                                                                                </button>
                                                                                            ))}
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                            </div>

                                                                            <div className="shrink-0 rounded-xl bg-slate-50 px-3 py-2 text-right">
                                                                                <p className="text-[11px] font-semibold text-slate-700">
                                                                                    {log.user_name || "Система"}
                                                                                </p>
                                                                                <p className="mt-0.5 text-[10px] text-slate-400">
                                                                                    {new Date(log.date).toLocaleDateString("ru-RU")}
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </TabsContent>
                            </form>
                        </div>
                    </Tabs>
                </Card>
            </div>

            <Dialog open={Boolean(historyPhotoViewer)} onOpenChange={(open) => { if (!open) closeHistoryPhotoViewer() }}>
                <DialogContent className="left-0 top-0 h-screen w-screen max-w-none translate-x-0 translate-y-0 rounded-none border-0 bg-black p-0 text-white shadow-none [&>button]:hidden">
                    <DialogHeader className="sr-only">
                        <DialogTitle>Просмотр фото из истории оборудования</DialogTitle>
                        <DialogDescription>
                            Полноэкранный просмотр прикреплённых фотографий с возможностью переключения между изображениями.
                        </DialogDescription>
                    </DialogHeader>
                    {historyPhotoViewer && (
                        <div className="relative flex h-screen flex-col">
                            <div className="pointer-events-none absolute inset-x-0 top-4 z-20 flex justify-center px-4">
                                <div className="pointer-events-auto flex max-w-[90vw] items-center gap-2 overflow-x-auto rounded-full border border-white/10 bg-black/80 p-2">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={showPrevHistoryPhoto}
                                        disabled={historyPhotoViewer.index === 0}
                                        className="h-8 w-8 shrink-0 text-white hover:bg-white/20 disabled:opacity-30"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <span className="w-24 shrink-0 text-center text-xs text-white/70">
                                        {historyPhotoViewer.index + 1} / {historyPhotoViewer.images.length}
                                    </span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={showNextHistoryPhoto}
                                        disabled={historyPhotoViewer.index >= historyPhotoViewer.images.length - 1}
                                        className="h-8 w-8 shrink-0 text-white hover:bg-white/20 disabled:opacity-30"
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                    <div className="mx-1 h-4 w-px shrink-0 bg-white/20" />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={closeHistoryPhotoViewer}
                                        className="h-8 w-8 shrink-0 text-white hover:bg-white/20"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            {historyPhotoViewer.images.length > 1 && (
                                <>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={showPrevHistoryPhoto}
                                        disabled={historyPhotoViewer.index === 0}
                                        className="absolute bottom-8 left-6 z-20 h-12 w-12 rounded-full border border-white/10 bg-black/80 text-white hover:bg-white/20 disabled:opacity-30 md:top-1/2 md:bottom-auto md:-translate-y-1/2"
                                    >
                                        <ChevronLeft className="h-6 w-6" />
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={showNextHistoryPhoto}
                                        disabled={historyPhotoViewer.index >= historyPhotoViewer.images.length - 1}
                                        className="absolute bottom-8 right-6 z-20 h-12 w-12 rounded-full border border-white/10 bg-black/80 text-white hover:bg-white/20 disabled:opacity-30 md:top-1/2 md:bottom-auto md:-translate-y-1/2"
                                    >
                                        <ChevronRight className="h-6 w-6" />
                                    </Button>
                                </>
                            )}

                            <div className="flex min-h-0 flex-1 items-center justify-center p-4 md:p-8">
                                <img
                                    src={historyPhotoViewer.images[historyPhotoViewer.index]}
                                    alt="Фото из истории оборудования"
                                    className="max-h-full max-w-full object-contain"
                                />
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
                <div className="mx-auto flex max-w-7xl gap-2">
                    <Button asChild variant="outline" className="h-11 flex-1">
                        <Link href={`/clubs/${clubId}/equipment/inventory`}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Назад
                        </Link>
                    </Button>
                    <Button
                        form="equipment-page-form"
                        type="submit"
                        disabled={isSaving || activeTab === "history"}
                        className="h-11 flex-1"
                    >
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Сохранить
                    </Button>
                </div>
            </div>
        </PageShell>
    )
}
