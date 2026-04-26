"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
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
import { CalendarDays, ChevronLeft, Link2, Loader2, Plus, QrCode, RefreshCcw } from "lucide-react"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import { motion } from "framer-motion"

type Tournament = {
    id: number
    club_id: number
    name: string
    status: string
    venue: string | null
    starts_at: string | null
    config: any
    entries_count?: number
    matches_count?: number
}

type Invite = {
    id: string
    kind: string
    code: string
    token: string
    competitor_id: number | null
    label: string | null
    created_at: string
}

type CompetitorRow = {
    id: number
    type: string
    display_name: string
    entry_id: number
    entry_status: string
    seed: number | null
    access_code: string | null
    access_token: string | null
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
    winner_competitor_id: number | null
    winner_name: string | null
}

const statusTone: Record<string, { label: string; className: string }> = {
    DRAFT: { label: "Черновик", className: "bg-slate-100 text-slate-800" },
    REGISTRATION: { label: "Регистрация", className: "bg-amber-100 text-amber-900" },
    STARTED: { label: "Идёт", className: "bg-emerald-100 text-emerald-900" },
    FINISHED: { label: "Завершён", className: "bg-indigo-100 text-indigo-900" },
    CANCELLED: { label: "Отменён", className: "bg-rose-100 text-rose-900" },
}

function formatDt(value: string | null) {
    if (!value) return "—"
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return "—"
    return format(d, "d MMM, HH:mm", { locale: ru })
}

export function TournamentWorkspace({ clubId, tournamentId }: { clubId: string; tournamentId: string }) {
    const router = useRouter()
    const [tab, setTab] = useState("participants")
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const [tournament, setTournament] = useState<Tournament | null>(null)
    const [invites, setInvites] = useState<Invite[]>([])
    const [organizerInvites, setOrganizerInvites] = useState<Invite[]>([])
    const [competitors, setCompetitors] = useState<CompetitorRow[]>([])
    const [matches, setMatches] = useState<MatchRow[]>([])

    const judgeInvite = useMemo(() => invites.find(i => i.kind === "JUDGE") || null, [invites])
    const organizerInvite = useMemo(() => organizerInvites[0] || null, [organizerInvites])

    const loadAll = async () => {
        setLoading(true)
        setError(null)
        try {
            const [tRes, cRes, mRes, oRes] = await Promise.all([
                fetch(`/api/clubs/${clubId}/tournaments/${tournamentId}`, { cache: "no-store" }),
                fetch(`/api/clubs/${clubId}/tournaments/${tournamentId}/competitors`, { cache: "no-store" }),
                fetch(`/api/clubs/${clubId}/tournaments/${tournamentId}/matches`, { cache: "no-store" }),
                fetch(`/api/clubs/${clubId}/tournaments/organizer-invites`, { cache: "no-store" }),
            ])

            const tData = await tRes.json()
            const cData = await cRes.json()
            const mData = await mRes.json()
            const oData = await oRes.json()

            if (!tRes.ok) throw new Error(tData?.error || "Failed to load tournament")
            if (!cRes.ok) throw new Error(cData?.error || "Failed to load competitors")
            if (!mRes.ok) throw new Error(mData?.error || "Failed to load matches")
            if (!oRes.ok) throw new Error(oData?.error || "Failed to load organizer invites")

            setTournament(tData.tournament)
            setInvites(Array.isArray(tData.invites) ? tData.invites : [])
            setOrganizerInvites(Array.isArray(oData.invites) ? oData.invites : [])
            setCompetitors(Array.isArray(cData.competitors) ? cData.competitors : [])
            setMatches(Array.isArray(mData.matches) ? mData.matches : [])
        } catch (e: any) {
            setError(e?.message || "Failed to load tournament")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadAll()
    }, [clubId, tournamentId])

    const updateStatus = async (nextStatus: string) => {
        if (!tournament) return
        setError(null)
        const res = await fetch(`/api/clubs/${clubId}/tournaments/${tournamentId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: nextStatus }),
        })
        const data = await res.json()
        if (!res.ok) {
            setError(data?.error || "Failed to update status")
            return
        }
        setTournament(prev => (prev ? { ...prev, status: data.tournament.status } : prev))
        router.refresh()
    }

    const statusUi = tournament ? (statusTone[tournament.status] || { label: tournament.status, className: "bg-slate-100 text-slate-800" }) : null

    return (
        <div className="space-y-6">
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
                className="rounded-2xl border border-border bg-card p-5 sm:p-6"
            >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-3">
                        <Link
                            href={`/clubs/${clubId}/tournaments`}
                            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Назад к списку
                        </Link>

                        <div className="flex flex-wrap items-center gap-3">
                            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                                {tournament?.name || "Турнир"}
                            </h1>
                            {statusUi && (
                                <Badge className={cn("rounded-lg px-2.5 py-1 text-[11px] font-bold tracking-wide", statusUi.className)}>
                                    {statusUi.label}
                                </Badge>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
                            <span className="inline-flex items-center gap-2">
                                <CalendarDays className="h-4 w-4 text-slate-400" />
                                {formatDt(tournament?.starts_at || null)}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="text-slate-600">{tournament?.venue ? tournament.venue : "Локация не указана"}</span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <Button variant="outline" className="h-10 rounded-xl" onClick={loadAll} disabled={loading}>
                            <RefreshCcw className={cn("h-4 w-4 mr-2", loading ? "animate-spin" : "")} />
                            Обновить
                        </Button>

                        <Select value={tournament?.status || "DRAFT"} onValueChange={updateStatus} disabled={!tournament || loading}>
                            <SelectTrigger className="h-10 rounded-xl w-[200px]">
                                <SelectValue placeholder="Статус" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="DRAFT">Черновик</SelectItem>
                                <SelectItem value="REGISTRATION">Регистрация</SelectItem>
                                <SelectItem value="STARTED">Запустить</SelectItem>
                                <SelectItem value="FINISHED">Завершить</SelectItem>
                                <SelectItem value="CANCELLED">Отменить</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {error && (
                    <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                        {error}
                    </div>
                )}
            </motion.div>

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
                            Доступы
                        </TabsTrigger>
                        <TabsTrigger
                            value="ledger"
                            className="rounded-none border-b-2 border-transparent text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none px-1 py-3 bg-transparent font-medium transition-colors"
                        >
                            Фонд
                        </TabsTrigger>
                        <TabsTrigger
                            value="arena"
                            className="rounded-none border-b-2 border-transparent text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none px-1 py-3 bg-transparent font-medium transition-colors"
                        >
                            Страница входа
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="participants" className="mt-0 space-y-4">
                    <ParticipantsPanel clubId={clubId} tournamentId={tournamentId} competitors={competitors} onChanged={loadAll} loading={loading} />
                </TabsContent>

                <TabsContent value="matches" className="mt-0 space-y-4">
                    <MatchesPanel clubId={clubId} tournamentId={tournamentId} matches={matches} competitors={competitors} onChanged={loadAll} loading={loading} />
                </TabsContent>

                <TabsContent value="access" className="mt-0 space-y-4">
                    <AccessPanel clubId={clubId} judgeInvite={judgeInvite} organizerInvite={organizerInvite} onOrganizerInviteChanged={loadAll} competitors={competitors} />
                </TabsContent>

                <TabsContent value="ledger" className="mt-0 space-y-4">
                    <LedgerPanel clubId={clubId} tournamentId={tournamentId} />
                </TabsContent>

                <TabsContent value="arena" className="mt-0 space-y-4">
                    <ArenaPanel judgeInvite={judgeInvite} />
                </TabsContent>
            </Tabs>
        </div>
    )
}

function ParticipantsPanel({
    clubId,
    tournamentId,
    competitors,
    loading,
    onChanged,
}: {
    clubId: string
    tournamentId: string
    competitors: CompetitorRow[]
    loading: boolean
    onChanged: () => void
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
            const res = await fetch(`/api/clubs/${clubId}/tournaments/${tournamentId}/competitors`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type, display_name: name.trim() }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data?.error || "Failed to add competitor")
            setOpen(false)
            setName("")
            onChanged()
        } catch (e: any) {
            setError(e?.message || "Failed to add competitor")
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Card className="rounded-2xl border-slate-200">
            <div className="flex flex-col gap-3 p-5 sm:p-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div className="text-sm font-semibold text-slate-900">Участники</div>
                    <div className="text-sm text-slate-500">Добавляй одиночек или команды. Для каждого участника появится 4‑значный код.</div>
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
                                <Input value={name} onChange={e => setName(e.target.value)} className="h-11 rounded-xl" placeholder="Ник или название команды" />
                            </div>
                            {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
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
                            <TableHead>Код</TableHead>
                            <TableHead className="text-right">Статус</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={4} className="py-10 text-center text-sm text-slate-500">
                                    Загрузка…
                                </TableCell>
                            </TableRow>
                        ) : competitors.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="py-10 text-center text-sm text-slate-500">
                                    Участников пока нет.
                                </TableCell>
                            </TableRow>
                        ) : (
                            competitors.map(c => (
                                <TableRow key={c.id} className="hover:bg-slate-50/60">
                                    <TableCell className="py-4">
                                        <div className="text-sm font-semibold text-slate-900">{c.display_name}</div>
                                        <div className="text-xs text-slate-500 tabular-nums">ID {c.id}</div>
                                    </TableCell>
                                    <TableCell className="py-4 text-sm text-slate-700">{c.type === "TEAM" ? "Команда" : "Одиночка"}</TableCell>
                                    <TableCell className="py-4">
                                        <div className="inline-flex items-center gap-2">
                                            <Badge className="rounded-lg bg-black text-white px-2.5 py-1 text-[11px] font-bold tracking-widest tabular-nums">
                                                {c.access_code || "—"}
                                            </Badge>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-4 text-right">
                                        <Badge className="rounded-lg bg-slate-100 text-slate-800 px-2.5 py-1 text-[11px] font-bold tracking-wide">
                                            {c.entry_status}
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

function MatchesPanel({
    clubId,
    tournamentId,
    matches,
    competitors,
    loading,
    onChanged,
}: {
    clubId: string
    tournamentId: string
    matches: MatchRow[]
    competitors: CompetitorRow[]
    loading: boolean
    onChanged: () => void
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

            const res = await fetch(`/api/clubs/${clubId}/tournaments/${tournamentId}/matches`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data?.error || "Failed to create match")
            setOpen(false)
            setAId("")
            setBId("")
            setRound("1")
            setOrder("1")
            setScheduledAt("")
            onChanged()
        } catch (e: any) {
            setError(e?.message || "Failed to create match")
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Card className="rounded-2xl border-slate-200">
            <div className="flex flex-col gap-3 p-5 sm:p-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div className="text-sm font-semibold text-slate-900">Матчи</div>
                    <div className="text-sm text-slate-500">На MVP матчи можно создавать вручную. Судья вводит результат в /arena.</div>
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
                            {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
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
                                <TableCell colSpan={4} className="py-10 text-center text-sm text-slate-500">
                                    Загрузка…
                                </TableCell>
                            </TableRow>
                        ) : matches.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="py-10 text-center text-sm text-slate-500">
                                    Матчей пока нет.
                                </TableCell>
                            </TableRow>
                        ) : (
                            matches.map(m => (
                                <TableRow key={m.id} className="hover:bg-slate-50/60">
                                    <TableCell className="py-4">
                                        <div className="text-sm font-semibold text-slate-900">
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

function AccessPanel({
    clubId,
    judgeInvite,
    organizerInvite,
    onOrganizerInviteChanged,
    competitors,
}: {
    clubId: string
    judgeInvite: Invite | null
    organizerInvite: Invite | null
    onOrganizerInviteChanged: () => void
    competitors: CompetitorRow[]
}) {
    const judgeLink = judgeInvite ? `/api/arena/join/${judgeInvite.token}` : null
    const organizerLink = organizerInvite ? `/api/arena/join/${organizerInvite.token}` : null
    const base = typeof window === "undefined" ? "" : window.location.origin
    const judgeJoinUrl = judgeLink ? `${base}${judgeLink}` : null
    const organizerJoinUrl = organizerLink ? `${base}${organizerLink}` : null
    const [creatingOrganizerInvite, setCreatingOrganizerInvite] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const createOrganizerInvite = async () => {
        if (creatingOrganizerInvite) return
        setCreatingOrganizerInvite(true)
        setError(null)
        try {
            const res = await fetch(`/api/clubs/${clubId}/tournaments/organizer-invites`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data?.error || "Failed to create organizer invite")
            onOrganizerInviteChanged()
        } catch (e: any) {
            setError(e?.message || "Failed to create organizer invite")
        } finally {
            setCreatingOrganizerInvite(false)
        }
    }

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="rounded-2xl border-slate-200">
                    <div className="p-5 sm:p-6 space-y-3">
                        <div className="text-sm font-semibold text-slate-900">Судья</div>
                        <div className="text-sm text-slate-500">
                            Ввод результатов без аккаунта. QR ведёт на ссылку входа, 4‑значный код — резервный вариант.
                        </div>
                        <div className="flex flex-wrap items-center gap-3 pt-2">
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
                                            <QRCode value={judgeJoinUrl} downloadable filename={`judge-${tournamentId}`} />
                                        </div>
                                    </DialogContent>
                                </Dialog>
                            ) : null}
                        </div>
                    </div>
                </Card>

                <Card className="rounded-2xl border-slate-200">
                    <div className="p-5 sm:p-6 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <div className="text-sm font-semibold text-slate-900">Организатор клуба</div>
                                <div className="text-sm text-slate-500">
                                    Сторонний организатор создаёт турниры от имени клуба через /arena без регистрации.
                                </div>
                            </div>
                            <Button
                                variant="outline"
                                className="rounded-xl"
                                onClick={createOrganizerInvite}
                                disabled={creatingOrganizerInvite}
                            >
                                {creatingOrganizerInvite ? <Loader2 className="h-4 w-4 animate-spin" /> : "Новый код"}
                            </Button>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 pt-2">
                            <Badge className="rounded-lg bg-black text-white px-3 py-1.5 text-[12px] font-bold tracking-widest tabular-nums">
                                {organizerInvite?.code || "—"}
                            </Badge>
                            {organizerJoinUrl ? (
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" className="rounded-xl">
                                            <QrCode className="h-4 w-4 mr-2" />
                                            QR
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-sm">
                                        <DialogHeader>
                                            <DialogTitle>QR для организатора</DialogTitle>
                                        </DialogHeader>
                                        <div className="rounded-2xl bg-white p-3">
                                            <QRCode value={organizerJoinUrl} downloadable filename={`organizer-${clubId}`} />
                                        </div>
                                    </DialogContent>
                                </Dialog>
                            ) : null}
                        </div>

                        {error && (
                            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                                {error}
                            </div>
                        )}
                    </div>
                </Card>
            </div>

            <Card className="rounded-2xl border-slate-200 overflow-hidden">
                <div className="p-5 sm:p-6 border-b border-slate-100">
                    <div className="text-sm font-semibold text-slate-900">Коды участников</div>
                    <div className="text-sm text-slate-500">Участник вводит свой код на странице /arena и получает список матчей и чат.</div>
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
                                <TableCell colSpan={2} className="py-10 text-center text-sm text-slate-500">
                                    Нет участников.
                                </TableCell>
                            </TableRow>
                        ) : (
                            competitors.map(c => (
                                <TableRow key={c.id} className="hover:bg-slate-50/60">
                                    <TableCell className="py-4">
                                        <div className="text-sm font-semibold text-slate-900">{c.display_name}</div>
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
    )
}

function ArenaPanel({ judgeInvite }: { judgeInvite: Invite | null }) {
    const base = typeof window === "undefined" ? "" : window.location.origin
    const entryUrl = `${base}/arena`
    const judgeLink = judgeInvite ? `${base}/api/arena/join/${judgeInvite.token}` : null

    return (
        <Card className="rounded-2xl border-slate-200">
            <div className="p-5 sm:p-6 space-y-4">
                <div>
                    <div className="text-sm font-semibold text-slate-900">Закрепляемая страница</div>
                    <div className="text-sm text-slate-500">
                        Открой /arena на планшете или телефоне, добавь в избранное. Дальше участники и судья заходят по коду/QR.
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="text-xs font-bold uppercase tracking-widest text-slate-400">Участники</div>
                        <div className="mt-2 flex items-center justify-between gap-3">
                            <div className="text-sm font-semibold text-slate-900">Ввод кода → мои матчи</div>
                            <a
                                href={entryUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-3 py-2 text-sm font-semibold"
                            >
                                <Link2 className="h-4 w-4" />
                                Открыть
                            </a>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="text-xs font-bold uppercase tracking-widest text-slate-400">Судья</div>
                        <div className="mt-2 flex items-center justify-between gap-3">
                            <div className="text-sm font-semibold text-slate-900">QR → ввод результатов</div>
                            {judgeLink ? (
                                <a
                                    href={judgeLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-2 rounded-xl bg-black text-white px-3 py-2 text-sm font-semibold"
                                >
                                    <QrCode className="h-4 w-4" />
                                    Открыть
                                </a>
                            ) : (
                                <span className="text-sm text-slate-500">Нет доступа</span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm font-semibold text-slate-900">Подсказка</div>
                    <div className="text-sm text-slate-600 mt-1">
                        Для локальных турниров 4‑значные коды работают быстро. Если нужно усилить безопасность — можно увеличить длину кодов без изменения модели.
                    </div>
                </div>
            </div>
        </Card>
    )
}

type LedgerEvent = {
    id: number
    kind: string
    amount: string
    currency: string
    meta: any
    created_at: string
}

type LedgerTotal = {
    kind: string
    currency: string
    total: string
}

function LedgerPanel({ clubId, tournamentId }: { clubId: string; tournamentId: string }) {
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [events, setEvents] = useState<LedgerEvent[]>([])
    const [totals, setTotals] = useState<LedgerTotal[]>([])

    const [open, setOpen] = useState(false)
    const [kind, setKind] = useState<"FEE" | "SPONSOR" | "EXPENSE" | "PRIZE">("FEE")
    const [amount, setAmount] = useState("")
    const [currency, setCurrency] = useState("RUB")
    const [note, setNote] = useState("")
    const [submitting, setSubmitting] = useState(false)

    const load = async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await fetch(`/api/clubs/${clubId}/tournaments/${tournamentId}/ledger`, { cache: "no-store" })
            const data = await res.json()
            if (!res.ok) throw new Error(data?.error || "Failed to load ledger")
            setEvents(Array.isArray(data?.events) ? data.events : [])
            setTotals(Array.isArray(data?.totals) ? data.totals : [])
        } catch (e: any) {
            setError(e?.message || "Failed to load ledger")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
    }, [clubId, tournamentId])

    const addEvent = async () => {
        if (submitting) return
        setSubmitting(true)
        setError(null)
        try {
            const res = await fetch(`/api/clubs/${clubId}/tournaments/${tournamentId}/ledger`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    kind,
                    amount: Number(amount),
                    currency,
                    note: note.trim() || null,
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data?.error || "Failed to add event")
            setOpen(false)
            setAmount("")
            setNote("")
            await load()
        } catch (e: any) {
            setError(e?.message || "Failed to add event")
        } finally {
            setSubmitting(false)
        }
    }

    const totalBy = (k: string) => totals.filter(t => t.kind === k && t.currency === currency)[0]?.total || "0.00"

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="rounded-2xl border-slate-200 lg:col-span-1">
                <div className="p-5 sm:p-6 space-y-4">
                    <div>
                        <div className="text-sm font-semibold text-slate-900">Итоги</div>
                        <div className="text-sm text-slate-500">Учёт взносов, спонсоров и расходов отдельно от финансов клуба.</div>
                    </div>

                    <div className="grid gap-2">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-500">Взносы</span>
                            <span className="font-semibold text-slate-900 tabular-nums">{totalBy("FEE")}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-500">Спонсор</span>
                            <span className="font-semibold text-slate-900 tabular-nums">{totalBy("SPONSOR")}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-500">Расходы</span>
                            <span className="font-semibold text-slate-900 tabular-nums">{totalBy("EXPENSE")}</span>
                        </div>
                        <div className="h-px bg-slate-200 my-2" />
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-500">Призы (выдано)</span>
                            <span className="font-semibold text-slate-900 tabular-nums">{totalBy("PRIZE")}</span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <Dialog open={open} onOpenChange={setOpen}>
                            <DialogTrigger asChild>
                                <Button className="h-10 rounded-xl">
                                    <Plus className="h-4 w-4 mr-2" />
                                    Добавить запись
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-lg">
                                <DialogHeader>
                                    <DialogTitle>Новая запись</DialogTitle>
                                </DialogHeader>
                                <div className="grid gap-4 py-2">
                                    <div className="grid gap-2">
                                        <Label>Тип</Label>
                                        <Select value={kind} onValueChange={v => setKind(v as any)}>
                                            <SelectTrigger className="h-11 rounded-xl">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="FEE">Взнос</SelectItem>
                                                <SelectItem value="SPONSOR">Спонсор</SelectItem>
                                                <SelectItem value="EXPENSE">Расход</SelectItem>
                                                <SelectItem value="PRIZE">Приз выдан</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="grid gap-2">
                                            <Label>Сумма</Label>
                                            <Input value={amount} onChange={e => setAmount(e.target.value)} className="h-11 rounded-xl" inputMode="decimal" />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label>Валюта</Label>
                                            <Input value={currency} onChange={e => setCurrency(e.target.value.toUpperCase())} className="h-11 rounded-xl" />
                                        </div>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Заметка</Label>
                                        <Input value={note} onChange={e => setNote(e.target.value)} className="h-11 rounded-xl" placeholder="Опционально" />
                                    </div>
                                </div>
                                <DialogFooter className="gap-2 sm:gap-3">
                                    <Button variant="outline" className="rounded-xl" onClick={() => setOpen(false)} disabled={submitting}>
                                        Отмена
                                    </Button>
                                    <Button className="rounded-xl" onClick={addEvent} disabled={!amount.trim() || submitting}>
                                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Добавить"}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                        <Button variant="outline" className="h-10 rounded-xl" onClick={load} disabled={loading}>
                            <RefreshCcw className={cn("h-4 w-4 mr-2", loading ? "animate-spin" : "")} />
                            Обновить
                        </Button>
                    </div>

                    {error ? (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                            {error}
                        </div>
                    ) : null}
                </div>
            </Card>

            <Card className="rounded-2xl border-slate-200 overflow-hidden lg:col-span-2">
                <div className="p-5 sm:p-6 border-b border-slate-100">
                    <div className="text-sm font-semibold text-slate-900">История</div>
                    <div className="text-sm text-slate-500">Все события учёта, чтобы быстро свериться и ничего не считать руками.</div>
                </div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Тип</TableHead>
                            <TableHead>Сумма</TableHead>
                            <TableHead>Заметка</TableHead>
                            <TableHead className="text-right">Дата</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={4} className="py-10 text-center text-sm text-slate-500">
                                    Загрузка…
                                </TableCell>
                            </TableRow>
                        ) : events.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="py-10 text-center text-sm text-slate-500">
                                    Пока нет записей.
                                </TableCell>
                            </TableRow>
                        ) : (
                            events.map(ev => (
                                <TableRow key={ev.id} className="hover:bg-slate-50/60">
                                    <TableCell className="py-4">
                                        <Badge className="rounded-lg bg-slate-100 text-slate-800 px-2.5 py-1 text-[11px] font-bold tracking-wide">
                                            {ev.kind}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="py-4 text-sm font-semibold text-slate-900 tabular-nums">
                                        {ev.amount} {ev.currency}
                                    </TableCell>
                                    <TableCell className="py-4 text-sm text-slate-700">
                                        {ev?.meta?.note ? String(ev.meta.note) : "—"}
                                    </TableCell>
                                    <TableCell className="py-4 text-right text-sm text-slate-500 tabular-nums">
                                        {new Date(ev.created_at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </Card>
        </div>
    )
}
