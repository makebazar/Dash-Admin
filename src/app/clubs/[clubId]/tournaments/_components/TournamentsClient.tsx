"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { CalendarDays, Plus, RefreshCcw, Trophy } from "lucide-react"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import { motion } from "framer-motion"

type TournamentRow = {
    id: number
    name: string
    status: string
    venue: string | null
    starts_at: string | null
    local_mode: boolean
    entries_count?: number
    matches_count?: number
    created_at?: string
}

const statusTone: Record<string, { label: string; className: string }> = {
    DRAFT: { label: "Черновик", className: "bg-muted text-foreground" },
    REGISTRATION: { label: "Регистрация", className: "bg-amber-500/15 text-amber-200" },
    STARTED: { label: "Идёт", className: "bg-emerald-500/15 text-emerald-200" },
    FINISHED: { label: "Завершён", className: "bg-indigo-500/15 text-indigo-200" },
    CANCELLED: { label: "Отменён", className: "bg-rose-500/15 text-rose-200" },
}

function formatDt(value: string | null) {
    if (!value) return "—"
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return "—"
    return format(d, "d MMM, HH:mm", { locale: ru })
}

export function TournamentsClient({ clubId }: { clubId: string }) {
    const [items, setItems] = useState<TournamentRow[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [createOpen, setCreateOpen] = useState(false)
    const [creating, setCreating] = useState(false)

    const [name, setName] = useState("")
    const [venue, setVenue] = useState("")
    const [startsAt, setStartsAt] = useState("")
    const [note, setNote] = useState("")

    const canCreate = useMemo(() => name.trim().length >= 2, [name])

    const load = async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await fetch(`/api/clubs/${clubId}/tournaments`, { cache: "no-store" })
            const data = await res.json()
            if (!res.ok) throw new Error(data?.error || "Failed to load tournaments")
            setItems(Array.isArray(data?.tournaments) ? data.tournaments : [])
        } catch (e: any) {
            setError(e?.message || "Failed to load tournaments")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
    }, [clubId])

    const createTournament = async () => {
        if (!canCreate || creating) return
        setCreating(true)
        setError(null)
        try {
            const payload: any = {
                name: name.trim(),
                venue: venue.trim() || null,
                local_mode: true,
                starts_at: startsAt ? new Date(startsAt).toISOString() : null,
                config: note.trim() ? { note: note.trim() } : {},
            }
            const res = await fetch(`/api/clubs/${clubId}/tournaments`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data?.error || "Failed to create tournament")
            setCreateOpen(false)
            setName("")
            setVenue("")
            setStartsAt("")
            setNote("")
            await load()
        } catch (e: any) {
            setError(e?.message || "Failed to create tournament")
        } finally {
            setCreating(false)
        }
    }

    return (
        <div className="space-y-6">
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
                className="rounded-2xl border border-border bg-card p-5 sm:p-6"
            >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-4">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                            <Trophy className="h-5 w-5" />
                        </div>
                        <div>
                            <div className="text-sm font-semibold text-foreground">Быстрый старт</div>
                            <div className="text-sm text-muted-foreground max-w-xl">
                                Создай турнир, добавь участников, сгенерируй матчи и раздай коды: участникам, судье и организатору.
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <Button
                            variant="outline"
                            className="h-10 rounded-xl"
                            onClick={load}
                            disabled={loading}
                        >
                            <RefreshCcw className={cn("h-4 w-4 mr-2", loading ? "animate-spin" : "")} />
                            Обновить
                        </Button>

                        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                            <DialogTrigger asChild>
                                <Button className="h-10 rounded-xl">
                                    <Plus className="h-4 w-4 mr-2" />
                                    Новый турнир
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-xl">
                                <DialogHeader>
                                    <DialogTitle>Новый турнир</DialogTitle>
                                </DialogHeader>

                                <div className="grid gap-4 py-2">
                                    <div className="grid gap-2">
                                        <Label htmlFor="t-name">Название</Label>
                                        <Input
                                            id="t-name"
                                            value={name}
                                            onChange={e => setName(e.target.value)}
                                            placeholder="Например: FIFA Friday Cup"
                                            className="h-11 rounded-xl"
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="t-venue">Локация</Label>
                                        <Input
                                            id="t-venue"
                                            value={venue}
                                            onChange={e => setVenue(e.target.value)}
                                            placeholder="Зал, зона, клуб"
                                            className="h-11 rounded-xl"
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="t-starts">Старт</Label>
                                        <div className="relative">
                                            <CalendarDays className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                id="t-starts"
                                                value={startsAt}
                                                onChange={e => setStartsAt(e.target.value)}
                                                type="datetime-local"
                                                className="h-11 rounded-xl pl-10"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="t-note">Заметка</Label>
                                        <Textarea
                                            id="t-note"
                                            value={note}
                                            onChange={e => setNote(e.target.value)}
                                            placeholder="Правила, дисциплина, формат, важные детали"
                                            className="min-h-[90px] rounded-xl"
                                        />
                                    </div>
                                </div>

                                <DialogFooter className="gap-2 sm:gap-3">
                                    <Button
                                        variant="outline"
                                        className="rounded-xl"
                                        onClick={() => setCreateOpen(false)}
                                        disabled={creating}
                                    >
                                        Отмена
                                    </Button>
                                    <Button
                                        className="rounded-xl"
                                        onClick={createTournament}
                                        disabled={!canCreate || creating}
                                    >
                                        Создать
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

                {error && (
                    <div className="mt-4 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                        {error}
                    </div>
                )}
            </motion.div>

            <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-border/60">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <div className="text-sm font-semibold text-foreground">Все турниры</div>
                            <div className="text-sm text-muted-foreground">Список турниров клуба и быстрый доступ к управлению.</div>
                        </div>
                        <div className="text-xs font-semibold text-muted-foreground">
                            {loading ? "Загрузка…" : `${items.length} шт.`}
                        </div>
                    </div>
                </div>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[44%]">Турнир</TableHead>
                            <TableHead className="w-[18%]">Статус</TableHead>
                            <TableHead className="w-[20%]">Старт</TableHead>
                            <TableHead className="w-[18%] text-right">Участники</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={4} className="py-10 text-center text-sm text-slate-500">
                                    Загрузка списка…
                                </TableCell>
                            </TableRow>
                        ) : items.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="py-10 text-center text-sm text-slate-500">
                                    Пока нет турниров. Создай первый и запусти регистрацию.
                                </TableCell>
                            </TableRow>
                        ) : (
                            items.map(t => {
                                const tone = statusTone[t.status] || { label: t.status, className: "bg-muted text-foreground" }
                                return (
                                    <TableRow key={t.id} className="hover:bg-muted/40">
                                        <TableCell className="py-4">
                                            <Link
                                                href={`/clubs/${clubId}/tournaments/${t.id}`}
                                                className="group flex flex-col gap-1"
                                            >
                                                <span className="text-sm font-semibold text-foreground group-hover:underline underline-offset-4">
                                                    {t.name}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {t.venue ? t.venue : "Локация не указана"}
                                                </span>
                                            </Link>
                                        </TableCell>
                                        <TableCell className="py-4">
                                            <Badge className={cn("rounded-lg px-2.5 py-1 text-[11px] font-bold tracking-wide", tone.className)}>
                                                {tone.label}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="py-4 text-sm text-foreground/80">
                                            {formatDt(t.starts_at)}
                                        </TableCell>
                                        <TableCell className="py-4 text-right">
                                            <span className="inline-flex items-center justify-end gap-2 text-sm font-semibold text-foreground tabular-nums">
                                                {t.entries_count ?? 0}
                                                <span className="text-xs font-medium text-muted-foreground">в заявке</span>
                                            </span>
                                        </TableCell>
                                    </TableRow>
                                )
                            })
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
