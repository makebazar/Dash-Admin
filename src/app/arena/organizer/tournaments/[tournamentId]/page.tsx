"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { QRCode } from "@/components/qr/QRCode"
import { cn } from "@/lib/utils"
import { ArrowLeft, CalendarDays, Loader2, Plus, QrCode, RefreshCcw } from "lucide-react"
import { motion } from "framer-motion"

type Tournament = {
    id: number
    club_id: number
    name: string
    status: string
    venue: string | null
    starts_at: string | null
}

type Invite = {
    id: string
    kind: string
    code: string
    token: string
}

type CompetitorRow = {
    id: number
    type: string
    display_name: string
    entry_id: number
    entry_status: string
    access_code: string | null
}

type MatchRow = {
    id: number
    round: number
    order_in_round: number
    competitor_a_id: number | null
    competitor_b_id: number | null
    competitor_a_name: string | null
    competitor_b_name: string | null
    status: string
    scheduled_at: string | null
    winner_name: string | null
}

function formatDt(value: string | null) {
    if (!value) return "—"
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return "—"
    return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
}

export default function ArenaOrganizerTournamentPage({ params }: { params: { tournamentId: string } }) {
    const { tournamentId } = params
    const [tab, setTab] = useState("participants")
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const [tournament, setTournament] = useState<Tournament | null>(null)
    const [invites, setInvites] = useState<Invite[]>([])
    const [competitors, setCompetitors] = useState<CompetitorRow[]>([])
    const [matches, setMatches] = useState<MatchRow[]>([])

    const judgeInvite = useMemo(() => invites.find(i => i.kind === "JUDGE") || null, [invites])
    const base = typeof window === "undefined" ? "" : window.location.origin
    const judgeJoinUrl = judgeInvite ? `${base}/api/arena/join/${judgeInvite.token}` : null

    const loadAll = async () => {
        setLoading(true)
        setError(null)
        try {
            const [tRes, cRes, mRes] = await Promise.all([
                fetch(`/api/arena/organizer/tournaments/${tournamentId}`, { cache: "no-store" }),
                fetch(`/api/arena/organizer/tournaments/${tournamentId}/competitors`, { cache: "no-store" }),
                fetch(`/api/arena/organizer/tournaments/${tournamentId}/matches`, { cache: "no-store" }),
            ])
            const tData = await tRes.json()
            const cData = await cRes.json()
            const mData = await mRes.json()

            if (!tRes.ok) throw new Error(tData?.error || "Не удалось загрузить турнир")
            if (!cRes.ok) throw new Error(cData?.error || "Не удалось загрузить участников")
            if (!mRes.ok) throw new Error(mData?.error || "Не удалось загрузить матчи")

            setTournament(tData.tournament)
            setInvites(Array.isArray(tData.invites) ? tData.invites : [])
            setCompetitors(Array.isArray(cData.competitors) ? cData.competitors : [])
            setMatches(Array.isArray(mData.matches) ? mData.matches : [])
        } catch (e: any) {
            setError(e?.message || "Ошибка")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadAll()
    }, [tournamentId])

    return (
        <div className="dark min-h-dvh bg-[radial-gradient(1100px_400px_at_50%_-120px,rgba(255,255,255,0.06),transparent),radial-gradient(900px_350px_at_15%_0%,rgba(2,132,199,0.12),transparent),radial-gradient(900px_350px_at_85%_0%,rgba(168,85,247,0.10),transparent)]">
            <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
                <motion.div
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
                    className="relative overflow-hidden rounded-[28px] border border-border bg-card shadow-[0_24px_80px_-40px_rgba(0,0,0,0.55)]"
                >
                    <div className="absolute inset-0 opacity-[0.10] bg-[linear-gradient(to_right,rgba(255,255,255,0.22)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.22)_1px,transparent_1px)] bg-[size:36px_36px]" />
                    <div className="relative p-6 sm:p-10 space-y-6">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="space-y-3">
                                <Link href="/arena" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900">
                                    <ArrowLeft className="h-4 w-4" />
                                    Назад в Arena
                                </Link>
                                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                                    {tournament?.name || "Турнир"}
                                </h1>
                                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                                    <span className="inline-flex items-center gap-2">
                                        <CalendarDays className="h-4 w-4 text-slate-400" />
                                        {formatDt(tournament?.starts_at || null)}
                                    </span>
                                    <span className="text-slate-300">•</span>
                                    <span>{tournament?.venue ? tournament.venue : "Локация не указана"}</span>
                                </div>
                            </div>
                            <Button variant="outline" className="rounded-xl" onClick={loadAll} disabled={loading}>
                                <RefreshCcw className={cn("h-4 w-4 mr-2", loading ? "animate-spin" : "")} />
                                Обновить
                            </Button>
                        </div>

                        {error && (
                            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                                {error}
                            </div>
                        )}

                        <Tabs value={tab} onValueChange={setTab} className="space-y-6">
                            <div className="border-b border-border overflow-x-auto no-scrollbar">
                                <TabsList className="bg-transparent p-0 h-auto space-x-6 md:space-x-8 w-full justify-start min-w-max flex">
                                    <TabsTrigger
                                        value="participants"
                                        className="rounded-none border-b-2 border-transparent text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none px-1 py-3 bg-transparent font-medium transition-colors"
                                    >
                                        Участники
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="matches"
                                        className="rounded-none border-b-2 border-transparent text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none px-1 py-3 bg-transparent font-medium transition-colors"
                                    >
                                        Матчи
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="access"
                                        className="rounded-none border-b-2 border-transparent text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none px-1 py-3 bg-transparent font-medium transition-colors"
                                    >
                                        Судья и коды
                                    </TabsTrigger>
                                </TabsList>
                            </div>

                            <TabsContent value="participants" className="mt-0">
                                <OrganizerParticipants tournamentId={tournamentId} competitors={competitors} onChanged={loadAll} loading={loading} />
                            </TabsContent>
                            <TabsContent value="matches" className="mt-0">
                                <OrganizerMatches tournamentId={tournamentId} matches={matches} competitors={competitors} onChanged={loadAll} loading={loading} />
                            </TabsContent>
                            <TabsContent value="access" className="mt-0">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    <Card className="rounded-2xl border-slate-200">
                                        <div className="p-5 sm:p-6 space-y-4">
                                            <div>
                                                <div className="text-sm font-semibold text-slate-950">Судья</div>
                                                <div className="text-sm text-slate-600">Сканирует QR или вводит 4‑значный код на /arena.</div>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-3">
                                                <Badge className="rounded-lg bg-black text-white px-3 py-1.5 text-[12px] font-bold tracking-widest tabular-nums">
                                                    {judgeInvite?.code || "—"}
                                                </Badge>
                                                {judgeJoinUrl ? (
                                                    <Dialog>
                                                        <DialogTrigger asChild>
                                                            <Button variant="outline" className="rounded-xl">
                                                                <QrCode className="h-4 w-4 mr-2" />
                                                                QR
                                                            </Button>
                                                        </DialogTrigger>
                                                        <DialogContent className="max-w-sm">
                                                            <DialogHeader>
                                                                <DialogTitle>QR для судьи</DialogTitle>
                                                            </DialogHeader>
                                                            <div className="rounded-2xl bg-white p-3">
                                                                <QRCode value={judgeJoinUrl} downloadable filename={`judge-${tournament?.name || "tournament"}`} />
                                                            </div>
                                                        </DialogContent>
                                                    </Dialog>
                                                ) : null}
                                            </div>
                                        </div>
                                    </Card>

                                    <Card className="rounded-2xl border-slate-200 overflow-hidden">
                                        <div className="p-5 sm:p-6 border-b border-slate-100">
                                            <div className="text-sm font-semibold text-slate-950">Коды участников</div>
                                            <div className="text-sm text-slate-600">Раздай код — участник увидит свои матчи и чат.</div>
                                        </div>
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Участник</TableHead>
                                                    <TableHead className="text-right">Код</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {competitors.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={2} className="py-10 text-center text-sm text-slate-600">
                                                            Нет участников.
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    competitors.map(c => (
                                                        <TableRow key={c.id} className="hover:bg-slate-50/60">
                                                            <TableCell className="py-4">
                                                                <div className="text-sm font-semibold text-slate-950">{c.display_name}</div>
                                                                <div className="text-xs text-slate-500">{c.type === "TEAM" ? "Команда" : "Одиночка"}</div>
                                                            </TableCell>
                                                            <TableCell className="py-4 text-right">
                                                                <Badge className="rounded-lg bg-black text-white px-3 py-1.5 text-[12px] font-bold tracking-widest tabular-nums">
                                                                    {c.access_code || "—"}
                                                                </Badge>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                                )}
                                            </TableBody>
                                        </Table>
                                    </Card>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>
                </motion.div>
            </div>
        </div>
    )
}

function OrganizerParticipants({
    tournamentId,
    competitors,
    onChanged,
    loading,
}: {
    tournamentId: string
    competitors: CompetitorRow[]
    onChanged: () => void
    loading: boolean
}) {
    const [open, setOpen] = useState(false)
    const [type, setType] = useState<"SOLO" | "TEAM">("SOLO")
    const [name, setName] = useState("")
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const add = async () => {
        if (!name.trim() || submitting) return
        setSubmitting(true)
        setError(null)
        try {
            const res = await fetch(`/api/arena/organizer/tournaments/${tournamentId}/competitors`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type, display_name: name.trim() }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data?.error || "Не удалось добавить")
            setOpen(false)
            setName("")
            onChanged()
        } catch (e: any) {
            setError(e?.message || "Не удалось добавить")
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Card className="rounded-2xl border-slate-200">
            <div className="flex flex-col gap-3 p-5 sm:p-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div className="text-sm font-semibold text-slate-950">Участники</div>
                    <div className="text-sm text-slate-600">Добавляй одиночек или команды. Система выдаст код для входа.</div>
                </div>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button className="h-10 rounded-xl">
                            <Plus className="h-4 w-4 mr-2" />
                            Добавить
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                        <DialogHeader>
                            <DialogTitle>Новый участник</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-2">
                            <div className="grid gap-2">
                                <Label>Тип</Label>
                                <Select value={type} onValueChange={v => setType(v as any)}>
                                    <SelectTrigger className="h-11 rounded-xl">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="SOLO">Одиночка</SelectItem>
                                        <SelectItem value="TEAM">Команда</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label>Имя</Label>
                                <Input value={name} onChange={e => setName(e.target.value)} className="h-11 rounded-xl" placeholder="Ник или команда" />
                            </div>
                            {error ? (
                                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
                            ) : null}
                        </div>
                        <DialogFooter className="gap-2 sm:gap-3">
                            <Button variant="outline" className="rounded-xl" onClick={() => setOpen(false)} disabled={submitting}>
                                Отмена
                            </Button>
                            <Button className="rounded-xl" onClick={add} disabled={!name.trim() || submitting}>
                                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Добавить"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="border-t border-slate-100">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Участник</TableHead>
                            <TableHead>Тип</TableHead>
                            <TableHead className="text-right">Код</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={3} className="py-10 text-center text-sm text-slate-600">
                                    Загрузка…
                                </TableCell>
                            </TableRow>
                        ) : competitors.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={3} className="py-10 text-center text-sm text-slate-600">
                                    Участников пока нет.
                                </TableCell>
                            </TableRow>
                        ) : (
                            competitors.map(c => (
                                <TableRow key={c.id} className="hover:bg-slate-50/60">
                                    <TableCell className="py-4">
                                        <div className="text-sm font-semibold text-slate-950">{c.display_name}</div>
                                        <div className="text-xs text-slate-500 tabular-nums">ID {c.id}</div>
                                    </TableCell>
                                    <TableCell className="py-4 text-sm text-slate-700">{c.type === "TEAM" ? "Команда" : "Одиночка"}</TableCell>
                                    <TableCell className="py-4 text-right">
                                        <Badge className="rounded-lg bg-black text-white px-3 py-1.5 text-[12px] font-bold tracking-widest tabular-nums">
                                            {c.access_code || "—"}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </Card>
    )
}

function OrganizerMatches({
    tournamentId,
    matches,
    competitors,
    onChanged,
    loading,
}: {
    tournamentId: string
    matches: MatchRow[]
    competitors: CompetitorRow[]
    onChanged: () => void
    loading: boolean
}) {
    const [open, setOpen] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [aId, setAId] = useState<string>("")
    const [bId, setBId] = useState<string>("")
    const [round, setRound] = useState("1")
    const [order, setOrder] = useState("1")
    const [scheduledAt, setScheduledAt] = useState("")

    const add = async () => {
        setError(null)
        if (submitting) return
        setSubmitting(true)
        try {
            const payload = {
                competitor_a_id: aId ? Number(aId) : null,
                competitor_b_id: bId ? Number(bId) : null,
                round: Number(round || 1),
                order_in_round: Number(order || 1),
                scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
            }
            const res = await fetch(`/api/arena/organizer/tournaments/${tournamentId}/matches`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data?.error || "Не удалось создать матч")
            setOpen(false)
            setAId("")
            setBId("")
            setRound("1")
            setOrder("1")
            setScheduledAt("")
            onChanged()
        } catch (e: any) {
            setError(e?.message || "Не удалось создать матч")
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Card className="rounded-2xl border-slate-200">
            <div className="flex flex-col gap-3 p-5 sm:p-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div className="text-sm font-semibold text-slate-950">Матчи</div>
                    <div className="text-sm text-slate-600">Создавай пары вручную. Участники общаются в чате матча.</div>
                </div>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button className="h-10 rounded-xl">
                            <Plus className="h-4 w-4 mr-2" />
                            Новый матч
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-xl">
                        <DialogHeader>
                            <DialogTitle>Новый матч</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-2">
                            <div className="grid gap-2">
                                <Label>Участник A</Label>
                                <Select value={aId} onValueChange={setAId}>
                                    <SelectTrigger className="h-11 rounded-xl">
                                        <SelectValue placeholder="Выбери участника" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {competitors.map(c => (
                                            <SelectItem key={c.id} value={String(c.id)}>
                                                {c.display_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label>Участник B</Label>
                                <Select value={bId} onValueChange={setBId}>
                                    <SelectTrigger className="h-11 rounded-xl">
                                        <SelectValue placeholder="Выбери участника" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {competitors.map(c => (
                                            <SelectItem key={c.id} value={String(c.id)}>
                                                {c.display_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label>Раунд</Label>
                                    <Input value={round} onChange={e => setRound(e.target.value)} className="h-11 rounded-xl" />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Порядок</Label>
                                    <Input value={order} onChange={e => setOrder(e.target.value)} className="h-11 rounded-xl" />
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label>Время</Label>
                                <Input value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} type="datetime-local" className="h-11 rounded-xl" />
                            </div>
                            {error ? (
                                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
                            ) : null}
                        </div>
                        <DialogFooter className="gap-2 sm:gap-3">
                            <Button variant="outline" className="rounded-xl" onClick={() => setOpen(false)} disabled={submitting}>
                                Отмена
                            </Button>
                            <Button className="rounded-xl" onClick={add} disabled={!aId || !bId || submitting}>
                                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Создать"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="border-t border-slate-100">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[52%]">Пара</TableHead>
                            <TableHead>Раунд</TableHead>
                            <TableHead>Время</TableHead>
                            <TableHead className="text-right">Статус</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={4} className="py-10 text-center text-sm text-slate-600">
                                    Загрузка…
                                </TableCell>
                            </TableRow>
                        ) : matches.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="py-10 text-center text-sm text-slate-600">
                                    Матчей пока нет.
                                </TableCell>
                            </TableRow>
                        ) : (
                            matches.map(m => (
                                <TableRow key={m.id} className="hover:bg-slate-50/60">
                                    <TableCell className="py-4">
                                        <div className="text-sm font-semibold text-slate-950">
                                            {m.competitor_a_name || "—"} <span className="text-slate-300 mx-2">vs</span> {m.competitor_b_name || "—"}
                                        </div>
                                        <div className="text-xs text-slate-500 tabular-nums">Матч #{m.id}</div>
                                    </TableCell>
                                    <TableCell className="py-4 text-sm text-slate-700 tabular-nums">
                                        {m.round}.{m.order_in_round}
                                    </TableCell>
                                    <TableCell className="py-4 text-sm text-slate-700">
                                        {formatDt(m.scheduled_at)}
                                    </TableCell>
                                    <TableCell className="py-4 text-right">
                                        <Badge className="rounded-lg bg-slate-100 text-slate-800 px-2.5 py-1 text-[11px] font-bold tracking-wide">
                                            {m.status}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </Card>
    )
}
