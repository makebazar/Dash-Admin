"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { ArrowRight, LogOut, MessageCircle, Plus, Shield, Trophy, Users } from "lucide-react"
import { motion } from "framer-motion"

type ArenaSession = {
    invite: {
        kind: "PARTICIPANT" | "JUDGE" | "ORGANIZER"
        tournament_id: number | null
        competitor_id: number | null
        label: string | null
    } | null
    tournament: { id: number; name: string; status: string; venue: string | null; starts_at: string | null } | null
    competitor: { id: number; display_name: string; type: string } | null
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

type OrganizerTournamentRow = {
    id: number
    name: string
    status: string
    venue: string | null
    starts_at: string | null
    entries_count?: number
}

const roleUi: Record<string, { title: string; icon: any; badge: string }> = {
    PARTICIPANT: { title: "Участник", icon: Users, badge: "bg-black text-white" },
    JUDGE: { title: "Судья", icon: Shield, badge: "bg-emerald-100 text-emerald-900" },
    ORGANIZER: { title: "Организатор", icon: Trophy, badge: "bg-indigo-100 text-indigo-900" },
}

function formatTime(value: string | null) {
    if (!value) return "—"
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return "—"
    return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
}

export default function ArenaPage() {
    const [mode, setMode] = useState<"PARTICIPANT" | "JUDGE" | "ORGANIZER">("PARTICIPANT")
    const [code, setCode] = useState("")
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [orgName, setOrgName] = useState("")
    const [orgVenue, setOrgVenue] = useState("")
    const [orgStartsAt, setOrgStartsAt] = useState("")
    const [orgCreating, setOrgCreating] = useState(false)

    const [session, setSession] = useState<ArenaSession | null>(null)
    const [matches, setMatches] = useState<MatchRow[]>([])
    const [organizerTournaments, setOrganizerTournaments] = useState<OrganizerTournamentRow[]>([])
    const [loading, setLoading] = useState(true)

    const hasSession = Boolean(session?.invite)

    const loadSession = async () => {
        setLoading(true)
        try {
            const res = await fetch("/api/arena/session", { cache: "no-store" })
            const data = (await res.json()) as ArenaSession
            setSession(data)
            if (data?.invite) {
                if (data.invite.kind === "ORGANIZER") {
                    const tRes = await fetch("/api/arena/organizer/tournaments", { cache: "no-store" })
                    const tData = await tRes.json()
                    setOrganizerTournaments(Array.isArray(tData?.tournaments) ? tData.tournaments : [])
                    setMatches([])
                } else {
                    const mRes = await fetch("/api/arena/matches", { cache: "no-store" })
                    const mData = await mRes.json()
                    setMatches(Array.isArray(mData?.matches) ? mData.matches : [])
                    setOrganizerTournaments([])
                }
            } else {
                setMatches([])
                setOrganizerTournaments([])
            }
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadSession()
    }, [])

    const enter = async () => {
        if (!code.trim() || busy) return
        setBusy(true)
        setError(null)
        try {
            const res = await fetch("/api/arena/enter", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ kind: mode, code: code.trim() }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data?.error || "Неверный код")
            setCode("")
            await loadSession()
        } catch (e: any) {
            setError(e?.message || "Неверный код")
        } finally {
            setBusy(false)
        }
    }

    const logout = async () => {
        await fetch("/api/arena/logout", { method: "POST" })
        setSession({ invite: null, tournament: null, competitor: null })
        setMatches([])
        setOrganizerTournaments([])
        setError(null)
        setCode("")
    }

    const createOrganizerTournament = async () => {
        if (orgCreating || !orgName.trim()) return
        setOrgCreating(true)
        setError(null)
        try {
            const res = await fetch("/api/arena/organizer/tournaments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: orgName.trim(),
                    venue: orgVenue.trim() || null,
                    starts_at: orgStartsAt ? new Date(orgStartsAt).toISOString() : null,
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data?.error || "Не удалось создать турнир")
            setOrgName("")
            setOrgVenue("")
            setOrgStartsAt("")
            await loadSession()
        } catch (e: any) {
            setError(e?.message || "Не удалось создать турнир")
        } finally {
            setOrgCreating(false)
        }
    }

    const header = useMemo(() => {
        const kind = session?.invite?.kind
        if (!kind) return null
        const ui = roleUi[kind]
        return { kind, ui }
    }, [session?.invite?.kind])

    return (
        <div className="dark min-h-dvh bg-[radial-gradient(1100px_400px_at_50%_-120px,rgba(255,255,255,0.06),transparent),radial-gradient(900px_350px_at_15%_0%,rgba(2,132,199,0.12),transparent),radial-gradient(900px_350px_at_85%_0%,rgba(168,85,247,0.10),transparent)]">
            <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
                <motion.div
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
                    className="relative overflow-hidden rounded-[28px] border border-border bg-card shadow-[0_24px_80px_-40px_rgba(0,0,0,0.55)]"
                >
                    <div className="absolute inset-0 opacity-[0.10] bg-[linear-gradient(to_right,rgba(255,255,255,0.22)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.22)_1px,transparent_1px)] bg-[size:36px_36px]" />
                    <div className="relative p-6 sm:p-10">
                        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                            <div className="space-y-3">
                                <div className="inline-flex items-center gap-2 rounded-full bg-primary px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-primary-foreground">
                                    <span className="h-1.5 w-1.5 rounded-full bg-background/80" />
                                    Arena
                                </div>

                                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
                                    Турнирный доступ
                                </h1>
                                <p className="text-sm sm:text-base text-muted-foreground max-w-2xl">
                                    Введи код участника или судьи — и сразу получишь матчи и чат. Страница подходит для локальных турниров в клубе.
                                </p>
                            </div>

                            {hasSession && (
                                <div className="flex items-center gap-2">
                                    {header && (
                                        <Badge className={cn("rounded-full px-3 py-1 text-[11px] font-bold tracking-widest", header.ui.badge)}>
                                            {header.ui.title}
                                        </Badge>
                                    )}
                                    <Button variant="outline" className="rounded-xl" onClick={logout}>
                                        <LogOut className="h-4 w-4 mr-2" />
                                        Сменить код
                                    </Button>
                                </div>
                            )}
                        </div>

                        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-5">
                            <div className="lg:col-span-2">
                                <div className="rounded-2xl border border-border bg-card/70 p-5 backdrop-blur">
                                    <div className="text-sm font-semibold text-foreground">Вход</div>
                                    <div className="text-sm text-muted-foreground mt-1">
                                        Код выдаёт организатор или судья. Для QR-ссылок можно просто открыть ссылку — код вводить не нужно.
                                    </div>

                                    <div className="mt-4">
                                        <Tabs value={mode} onValueChange={v => setMode(v as any)}>
                                            <TabsList className="grid grid-cols-3 rounded-xl bg-muted p-1 h-10">
                                                <TabsTrigger value="PARTICIPANT" className="rounded-lg text-xs font-semibold">
                                                    Участник
                                                </TabsTrigger>
                                                <TabsTrigger value="JUDGE" className="rounded-lg text-xs font-semibold">
                                                    Судья
                                                </TabsTrigger>
                                                <TabsTrigger value="ORGANIZER" className="rounded-lg text-xs font-semibold">
                                                    Орг.
                                                </TabsTrigger>
                                            </TabsList>
                                        </Tabs>
                                    </div>

                                    <div className="mt-4 space-y-3">
                                        <Input
                                            value={code}
                                            onChange={e => setCode(e.target.value)}
                                            placeholder="Код (например 2047)"
                                            className="h-12 rounded-xl text-base tracking-widest font-semibold"
                                            inputMode="numeric"
                                        />
                                        <Button className="h-12 rounded-xl w-full" onClick={enter} disabled={!code.trim() || busy}>
                                            Войти
                                            <ArrowRight className="h-4 w-4 ml-2" />
                                        </Button>
                                    </div>

                                    {error && (
                                        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                                            {error}
                                        </div>
                                    )}

                                    {hasSession && session?.tournament && (
                                        <div className="mt-5 rounded-2xl border border-border bg-card p-4">
                                            <div className="text-xs font-bold uppercase tracking-widest text-slate-400">Турнир</div>
                                            <div className="mt-2 text-sm font-semibold text-foreground">{session.tournament.name}</div>
                                            <div className="mt-1 text-sm text-muted-foreground">
                                                {session.tournament.venue ? session.tournament.venue : "Локация не указана"} · {formatTime(session.tournament.starts_at)}
                                            </div>
                                            {session?.competitor && (
                                                <div className="mt-3 inline-flex items-center gap-2 rounded-xl bg-muted px-3 py-2">
                                                    <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Вы</span>
                                                    <span className="text-sm font-semibold text-foreground">{session.competitor.display_name}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="lg:col-span-3">
                                <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <div className="text-sm font-semibold text-foreground">
                                                {session?.invite?.kind === "ORGANIZER" ? "Турниры" : "Матчи"}
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                {session?.invite?.kind === "ORGANIZER"
                                                    ? "Создавай турниры от имени клуба. Дальше управлять сеткой и участниками можно в админке клуба."
                                                    : "Открой матч, чтобы договориться в чате или внести результат."}
                                            </div>
                                        </div>
                                        <Button variant="outline" className="rounded-xl" onClick={loadSession} disabled={loading}>
                                            {loading ? <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-slate-300" />...</span> : "Обновить"}
                                        </Button>
                                    </div>

                                    <div className="mt-4 space-y-2">
                                        {!hasSession ? (
                                            <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-8 text-center text-sm text-muted-foreground">
                                                Сначала войди по коду.
                                            </div>
                                        ) : session?.invite?.kind === "ORGANIZER" ? (
                                            <>
                                                <div className="rounded-2xl border border-border bg-muted/40 p-4 sm:p-5">
                                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                                        <div className="grid gap-2 w-full">
                                                            <div className="text-xs font-bold uppercase tracking-widest text-slate-400">Новый турнир</div>
                                                            <Input
                                                                value={orgName}
                                                                onChange={e => setOrgName(e.target.value)}
                                                                placeholder="Название"
                                                                className="h-11 rounded-xl"
                                                            />
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                                <Input
                                                                    value={orgVenue}
                                                                    onChange={e => setOrgVenue(e.target.value)}
                                                                    placeholder="Локация (опц.)"
                                                                    className="h-11 rounded-xl"
                                                                />
                                                                <Input
                                                                    value={orgStartsAt}
                                                                    onChange={e => setOrgStartsAt(e.target.value)}
                                                                    type="datetime-local"
                                                                    className="h-11 rounded-xl"
                                                                />
                                                            </div>
                                                        </div>
                                                        <Button
                                                            className="h-11 rounded-xl shrink-0"
                                                            onClick={createOrganizerTournament}
                                                            disabled={!orgName.trim() || orgCreating}
                                                        >
                                                            <Plus className="h-4 w-4 mr-2" />
                                                            Создать
                                                        </Button>
                                                    </div>
                                                </div>

                                                {organizerTournaments.length === 0 ? (
                                                    <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-8 text-center text-sm text-muted-foreground">
                                                        Турниров пока нет.
                                                    </div>
                                                ) : (
                                                    organizerTournaments.map(t => (
                                                        <Link
                                                            key={t.id}
                                                            href={`/arena/organizer/tournaments/${t.id}`}
                                                            className="group flex items-center justify-between gap-4 rounded-2xl border border-border bg-card px-4 py-3 hover:bg-muted/40 transition-colors"
                                                        >
                                                            <div className="min-w-0">
                                                                <div className="text-sm font-semibold text-foreground truncate">{t.name}</div>
                                                                <div className="mt-1 text-xs text-muted-foreground">
                                                                    {t.venue ? t.venue : "Локация не указана"} · {formatTime(t.starts_at)} · {t.status}
                                                                </div>
                                                            </div>
                                                            <div className="shrink-0 inline-flex items-center gap-3">
                                                                <div className="text-xs font-semibold text-slate-500">
                                                                    {t.entries_count ?? 0} заявок
                                                                </div>
                                                                <div className="inline-flex items-center rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white group-hover:bg-black">
                                                                    Открыть
                                                                </div>
                                                            </div>
                                                        </Link>
                                                    ))
                                                )}
                                            </>
                                        ) : matches.length === 0 ? (
                                            <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-8 text-center text-sm text-muted-foreground">
                                                Матчей пока нет. Организатор может создать пары в панели турнира.
                                            </div>
                                        ) : (
                                            matches.map(m => (
                                                <Link
                                                    key={m.id}
                                                    href={`/arena/matches/${m.id}`}
                                                    className="group flex items-center justify-between gap-4 rounded-2xl border border-border bg-card px-4 py-3 hover:bg-muted/40 transition-colors"
                                                >
                                                    <div className="min-w-0">
                                                        <div className="text-sm font-semibold text-foreground truncate">
                                                            {m.competitor_a_name || "—"} <span className="text-slate-300 mx-2">vs</span> {m.competitor_b_name || "—"}
                                                        </div>
                                                        <div className="mt-1 text-xs text-muted-foreground tabular-nums">
                                                            Раунд {m.round}.{m.order_in_round} · {formatTime(m.scheduled_at)} · {m.status}
                                                        </div>
                                                    </div>
                                                    <div className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
                                                        <MessageCircle className="h-4 w-4" />
                                                        Открыть
                                                    </div>
                                                </Link>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    )
}
