import Link from "next/link"
import { Activity, ArrowRight, CheckCircle2, ClipboardList, AlertTriangle, Refrigerator } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import type { ShiftZoneOverview } from "../actions"

type ShiftZonesOverviewTabProps = {
    clubId: string
    overview: ShiftZoneOverview
}

const statusMeta: Record<ShiftZoneOverview["recent_shifts"][number]["status"], { label: string; className: string }> = {
    COMPLETE: {
        label: "Полный цикл",
        className: "border-green-200 bg-green-50 text-green-700",
    },
    OPEN_ONLY: {
        label: "Только приемка",
        className: "border-blue-200 bg-blue-50 text-blue-700",
    },
    CLOSE_ONLY: {
        label: "Только сдача",
        className: "border-amber-200 bg-amber-50 text-amber-700",
    },
    PARTIAL: {
        label: "Частично",
        className: "border-border bg-muted text-foreground",
    },
}

function formatDateTime(value: string | null) {
    if (!value) return "—"
    return new Date(value).toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    })
}

export function ShiftZonesOverviewTab({ clubId, overview }: ShiftZonesOverviewTabProps) {
    const cards = [
        {
            label: "Смен в обзоре",
            value: overview.summary.recent_shifts_count,
            hint: "Последние смены с приемкой или сдачей остатков",
            icon: ClipboardList,
            tone: "text-foreground bg-muted border-border",
        },
        {
            label: "Точек учета",
            value: overview.summary.configured_zones_count,
            hint: "Склады, участвующие в передаче остатков",
            icon: Refrigerator,
            tone: "text-blue-700 bg-blue-50 border-blue-200",
        },
        {
            label: "Полный цикл",
            value: overview.summary.complete_shifts_count,
            hint: "И приемка, и сдача остатков за смену",
            icon: CheckCircle2,
            tone: "text-green-700 bg-green-50 border-green-200",
        },
        {
            label: "С расхождениями",
            value: overview.summary.discrepancy_shifts_count,
            hint: "Смены, где есть отклонения по передаче",
            icon: AlertTriangle,
            tone: "text-amber-700 bg-amber-50 border-amber-200",
        },
        {
            label: "Сумма отклонений",
            value: overview.summary.discrepancy_total_abs,
            hint: "Абсолютная сумма расхождений по позициям",
            icon: Activity,
            tone: "text-red-700 bg-red-50 border-red-200",
            suffix: "шт.",
        },
    ]

    return (
        <div className="space-y-5">
            <div className="rounded-2xl border bg-gradient-to-br from-white via-slate-50 to-slate-100 p-4 md:p-6 shadow-sm">
                <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                        <Refrigerator className="h-3.5 w-3.5 text-blue-500" />
                        Передача Остатков
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-foreground md:text-2xl">Общая картина по передаче остатков</h3>
                        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                            Здесь видно, как по сменам проходили приемка и сдача остатков, где цикл завершен полностью и на каких складах накапливаются расхождения.
                        </p>
                    </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    {cards.map((card) => {
                        const Icon = card.icon
                        return (
                            <Card key={card.label} className="border-border/80 shadow-none">
                                <CardContent className="flex items-start justify-between p-4">
                                    <div className="space-y-1">
                                        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{card.label}</p>
                                        <p className="text-2xl font-black text-foreground">
                                            {Number(card.value).toLocaleString("ru-RU")}
                                            {card.suffix ? ` ${card.suffix}` : ""}
                                        </p>
                                        <p className="text-xs text-muted-foreground">{card.hint}</p>
                                    </div>
                                    <div className={cn("rounded-xl border p-2.5", card.tone)}>
                                        <Icon className="h-4 w-4" />
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            </div>

            <Card className="shadow-sm">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Последние передачи остатков</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {overview.recent_shifts.length === 0 ? (
                        <div className="px-6 py-14 text-center text-sm text-muted-foreground">
                            По передаче остатков еще нет ни одной приемки или сдачи.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Смена</TableHead>
                                    <TableHead>Сотрудник</TableHead>
                                    <TableHead className="text-right">Приемка</TableHead>
                                    <TableHead className="text-right">Сдача</TableHead>
                                    <TableHead className="text-right">Расхождения</TableHead>
                                    <TableHead>Статус</TableHead>
                                    <TableHead className="w-[120px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {overview.recent_shifts.map((shift) => {
                                    const status = statusMeta[shift.status]
                                    return (
                                        <TableRow key={shift.shift_id}>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{formatDateTime(shift.check_in)}</span>
                                                    <span className="text-xs text-muted-foreground">
                                                        Последний снимок: {formatDateTime(shift.last_snapshot_at)}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-medium">{shift.employee_name}</TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {shift.open_zones_count}/{shift.total_zones}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {shift.close_zones_count}/{shift.total_zones}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className={cn(
                                                        "font-semibold tabular-nums",
                                                        shift.discrepancy_items_count > 0 ? "text-red-600" : "text-green-600"
                                                    )}>
                                                        {shift.discrepancy_items_count}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {shift.discrepancy_total_abs.toLocaleString("ru-RU")} шт.
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={status.className}>
                                                    {status.label}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button asChild variant="ghost" size="sm" className="h-8 px-2">
                                                        <Link href={`/clubs/${clubId}/inventory/handovers/${shift.shift_id}`}>
                                                        Детали
                                                        <ArrowRight className="ml-1 h-4 w-4" />
                                                    </Link>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <Card className="shadow-sm">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Сводка по складам ответственности</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {overview.zones.length === 0 ? (
                        <div className="px-6 py-14 text-center text-sm text-muted-foreground">
                            Не настроены склады для передачи остатков.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Склад</TableHead>
                                    <TableHead className="text-right">Приемок</TableHead>
                                    <TableHead className="text-right">Сдач</TableHead>
                                    <TableHead className="text-right">Смен с расхожд.</TableHead>
                                    <TableHead className="text-right">Позиций</TableHead>
                                    <TableHead className="text-right">Сумма</TableHead>
                                    <TableHead>Последняя активность</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {overview.zones.map((zone) => (
                                    <TableRow key={zone.warehouse_id}>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium">{zone.warehouse_name}</span>
                                                <span className="text-xs text-muted-foreground">{zone.shift_zone_label}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">{zone.open_snapshots_count}</TableCell>
                                        <TableCell className="text-right tabular-nums">{zone.close_snapshots_count}</TableCell>
                                        <TableCell className="text-right tabular-nums">{zone.discrepancy_shifts_count}</TableCell>
                                        <TableCell className="text-right tabular-nums">{zone.discrepancy_items_count}</TableCell>
                                        <TableCell className="text-right">
                                            <span className={cn(
                                                "font-semibold tabular-nums",
                                                zone.discrepancy_total_abs > 0 ? "text-red-600" : "text-green-600"
                                            )}>
                                                {zone.discrepancy_total_abs.toLocaleString("ru-RU")} шт.
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col text-sm">
                                                <span>Приемка: {formatDateTime(zone.latest_open_at)}</span>
                                                <span className="text-muted-foreground">Сдача: {formatDateTime(zone.latest_close_at)}</span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <div className="rounded-2xl border border-dashed bg-muted/70 px-4 py-3 text-xs text-muted-foreground">
                            Сейчас обзор считает последние {overview.summary.recent_shifts_count} смен с событиями по передаче остатков и показывает их отдельно от обычных складских инвентаризаций.
            </div>
        </div>
    )
}
