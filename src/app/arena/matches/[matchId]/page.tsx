"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { ArrowLeft, Loader2, Send, Shield, Trophy, Users } from "lucide-react"
import { motion } from "framer-motion"

type ArenaSession = {
    invite: { kind: "PARTICIPANT" | "JUDGE" | "ORGANIZER"; competitor_id: number | null } | null
}

type Match = {
    id: number
    tournament_id: number
    tournament_name: string
    tournament_status: string
    competitor_a_id: number | null
    competitor_b_id: number | null
    competitor_a_name: string | null
    competitor_b_name: string | null
    status: string
    scheduled_at: string | null
    result: any
    winner_competitor_id: number | null
    winner_name: string | null
}

type MessageRow = {
    id: number
    match_id: number
    sender_kind: string
    sender_competitor_id: number | null
    sender_competitor_name: string | null
    body: string
    created_at: string
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

export default function ArenaMatchPage({ params }: { params: { matchId: string } }) {
    const { matchId } = params
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const [session, setSession] = useState<ArenaSession | null>(null)
    const [match, setMatch] = useState<Match | null>(null)
    const [messages, setMessages] = useState<MessageRow[]>([])

    const [text, setText] = useState("")
    const [sending, setSending] = useState(false)

    const [winnerId, setWinnerId] = useState<string>("")
    const [scoreA, setScoreA] = useState("")
    const [scoreB, setScoreB] = useState("")
    const [savingResult, setSavingResult] = useState(false)

    const listRef = useRef<HTMLDivElement | null>(null)
    const stickToBottomRef = useRef(true)

    const role = session?.invite?.kind || null
    const roleBadge = role ? roleUi[role] : null

    const loadAll = async () => {
        setLoading(true)
        setError(null)
        try {
            const sRes = await fetch("/api/arena/session", { cache: "no-store" })
            const sData = await sRes.json()
            setSession(sData)

            const mRes = await fetch(`/api/arena/matches/${matchId}`, { cache: "no-store" })
            const mData = await mRes.json()
            if (!mRes.ok) throw new Error(mData?.error || "Не удалось загрузить матч")
            setMatch(mData.match)

            const msgsRes = await fetch(`/api/arena/matches/${matchId}/messages`, { cache: "no-store" })
            const msgsData = await msgsRes.json()
            if (!msgsRes.ok) throw new Error(msgsData?.error || "Не удалось загрузить чат")
            setMessages(Array.isArray(msgsData?.messages) ? msgsData.messages : [])

            setWinnerId(mData.match?.winner_competitor_id ? String(mData.match.winner_competitor_id) : "")
        } catch (e: any) {
            setError(e?.message || "Ошибка")
        } finally {
            setLoading(false)
        }
    }

    const loadMessages = async () => {
        const msgsRes = await fetch(`/api/arena/matches/${matchId}/messages`, { cache: "no-store" })
        const msgsData = await msgsRes.json()
        if (msgsRes.ok) setMessages(Array.isArray(msgsData?.messages) ? msgsData.messages : [])
    }

    useEffect(() => {
        loadAll()
    }, [matchId])

    useEffect(() => {
        const el = listRef.current
        if (!el) return

        const onScroll = () => {
            const threshold = 24
            stickToBottomRef.current = el.scrollTop + el.clientHeight >= el.scrollHeight - threshold
        }

        el.addEventListener("scroll", onScroll, { passive: true })
        return () => el.removeEventListener("scroll", onScroll)
    }, [])

    useEffect(() => {
        const el = listRef.current
        if (!el) return
        if (stickToBottomRef.current) el.scrollTop = el.scrollHeight
    }, [messages.length])

    useEffect(() => {
        const es = new EventSource(`/api/arena/matches/${matchId}/messages/stream`)
        const onUpdate = () => loadMessages()
        es.addEventListener("update", onUpdate)
        return () => {
            es.close()
        }
    }, [matchId])

    const send = async () => {
        if (!text.trim() || sending) return
        setSending(true)
        try {
            const res = await fetch(`/api/arena/matches/${matchId}/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ body: text.trim() }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data?.error || "Не удалось отправить")
            setText("")
            await loadMessages()
        } catch (e: any) {
            setError(e?.message || "Не удалось отправить")
        } finally {
            setSending(false)
        }
    }

    const saveResult = async () => {
        if (role !== "JUDGE" || !winnerId || savingResult) return
        setSavingResult(true)
        setError(null)
        try {
            const score =
                scoreA.trim() !== "" || scoreB.trim() !== ""
                    ? { a: Number(scoreA || 0), b: Number(scoreB || 0) }
                    : null
            const res = await fetch(`/api/arena/matches/${matchId}/result`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ winner_competitor_id: Number(winnerId), score }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data?.error || "Не удалось сохранить")
            setMatch(data.match)
            router.refresh()
        } catch (e: any) {
            setError(e?.message || "Не удалось сохранить")
        } finally {
            setSavingResult(false)
        }
    }

    const competitorsForSelect = useMemo(() => {
        if (!match) return []
        return [
            match.competitor_a_id ? { id: match.competitor_a_id, name: match.competitor_a_name || `#${match.competitor_a_id}` } : null,
            match.competitor_b_id ? { id: match.competitor_b_id, name: match.competitor_b_name || `#${match.competitor_b_id}` } : null,
        ].filter(Boolean) as { id: number; name: string }[]
    }, [match?.competitor_a_id, match?.competitor_b_id, match?.competitor_a_name, match?.competitor_b_name])

    return (
        <div className="dark min-h-dvh bg-[radial-gradient(950px_320px_at_50%_-120px,rgba(255,255,255,0.06),transparent),radial-gradient(900px_300px_at_10%_0%,rgba(2,132,199,0.12),transparent),radial-gradient(900px_300px_at_90%_0%,rgba(168,85,247,0.10),transparent)]">
            <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
                    className="rounded-[28px] border border-border bg-card shadow-[0_24px_80px_-40px_rgba(0,0,0,0.55)]"
                >
                    <div className="p-6 sm:p-10">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="space-y-3">
                                <Link href="/arena" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900">
                                    <ArrowLeft className="h-4 w-4" />
                                    Назад в Arena
                                </Link>
                                <div className="flex flex-wrap items-center gap-3">
                                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                                        {match?.competitor_a_name || "—"} <span className="text-slate-300 mx-2">vs</span> {match?.competitor_b_name || "—"}
                                    </h1>
                                    {roleBadge && (
                                        <Badge className={cn("rounded-full px-3 py-1 text-[11px] font-bold tracking-widest", roleBadge.badge)}>
                                            {roleBadge.title}
                                        </Badge>
                                    )}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                    <span className="font-semibold text-foreground">{match?.tournament_name || "Турнир"}</span>
                                    <span className="text-slate-300 mx-2">•</span>
                                    <span>{formatTime(match?.scheduled_at || null)}</span>
                                    <span className="text-slate-300 mx-2">•</span>
                                    <span className="tabular-nums">{match?.status || "—"}</span>
                                </div>
                            </div>

                            <Button variant="outline" className="rounded-xl" onClick={loadAll} disabled={loading}>
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Обновить"}
                            </Button>
                        </div>

                        {error && (
                            <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                                {error}
                            </div>
                        )}

                        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
                            <Card className="lg:col-span-3 rounded-2xl border-slate-200 overflow-hidden">
                                <div className="border-b border-slate-100 px-5 py-4 sm:px-6 sm:py-5">
                                    <div className="text-sm font-semibold text-foreground">Чат матча</div>
                                    <div className="text-sm text-muted-foreground">Скидывайте ссылку на локальный сервер, пароль, договоритесь по времени.</div>
                                </div>

                                <div ref={listRef} className="max-h-[48vh] overflow-auto px-4 py-4 sm:px-6 bg-muted/20">
                                    {messages.length === 0 ? (
                                        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
                                            Сообщений пока нет.
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {messages.map(msg => (
                                                <MessageBubble
                                                    key={msg.id}
                                                    msg={msg}
                                                    myCompetitorId={session?.invite?.competitor_id || null}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="border-t border-slate-100 p-4 sm:p-6">
                                    <div className="flex items-end gap-3">
                                        <Input
                                            value={text}
                                            onChange={e => setText(e.target.value)}
                                            className="h-12 rounded-xl"
                                            placeholder="Сообщение…"
                                            onKeyDown={e => {
                                                if (e.key === "Enter" && !e.shiftKey) {
                                                    e.preventDefault()
                                                    send()
                                                }
                                            }}
                                        />
                                        <Button className="h-12 rounded-xl px-4" onClick={send} disabled={!text.trim() || sending}>
                                            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                </div>
                            </Card>

                            <div className="lg:col-span-2 space-y-6">
                                {role === "JUDGE" && (
                                    <Card className="rounded-2xl border-slate-200">
                                        <div className="p-5 sm:p-6 space-y-4">
                                            <div>
                                                <div className="text-sm font-semibold text-foreground">Результат</div>
                                                <div className="text-sm text-muted-foreground">Выбери победителя и при необходимости укажи счёт.</div>
                                            </div>

                                            <div className="grid gap-3">
                                                <div className="grid gap-2">
                                                    <div className="text-xs font-bold uppercase tracking-widest text-slate-400">Победитель</div>
                                                    <Select value={winnerId} onValueChange={setWinnerId}>
                                                        <SelectTrigger className="h-11 rounded-xl">
                                                            <SelectValue placeholder="Выбери" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {competitorsForSelect.map(c => (
                                                                <SelectItem key={c.id} value={String(c.id)}>
                                                                    {c.name}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <div className="grid gap-2">
                                                    <div className="text-xs font-bold uppercase tracking-widest text-slate-400">Счёт</div>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <Input value={scoreA} onChange={e => setScoreA(e.target.value)} className="h-11 rounded-xl" placeholder="A" inputMode="numeric" />
                                                        <Input value={scoreB} onChange={e => setScoreB(e.target.value)} className="h-11 rounded-xl" placeholder="B" inputMode="numeric" />
                                                    </div>
                                                </div>
                                            </div>

                                            <Button className="h-11 rounded-xl w-full" onClick={saveResult} disabled={!winnerId || savingResult}>
                                                {savingResult ? <Loader2 className="h-4 w-4 animate-spin" /> : "Сохранить результат"}
                                            </Button>
                                        </div>
                                    </Card>
                                )}

                                <Card className="rounded-2xl border-slate-200">
                                    <div className="p-5 sm:p-6 space-y-2">
                                        <div className="text-sm font-semibold text-foreground">Статус</div>
                                        <div className="text-sm text-muted-foreground">
                                            {match?.winner_name ? (
                                                <span>
                                                    Победитель: <span className="font-semibold text-foreground">{match.winner_name}</span>
                                                </span>
                                            ) : (
                                                <span>Результат ещё не зафиксирован.</span>
                                            )}
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    )
}

function MessageBubble({ msg, myCompetitorId }: { msg: MessageRow; myCompetitorId: number | null }) {
    const mine = msg.sender_kind === "COMPETITOR" && myCompetitorId != null && msg.sender_competitor_id != null && Number(myCompetitorId) === Number(msg.sender_competitor_id)
    const judge = msg.sender_kind === "JUDGE"

    return (
        <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
            <div
                className={cn(
                    "max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm",
                    mine ? "bg-primary text-primary-foreground" : judge ? "bg-emerald-500/15 text-emerald-200 border border-emerald-500/25" : "bg-card text-foreground border border-border"
                )}
            >
                <div className={cn("text-[11px] font-bold uppercase tracking-widest opacity-70", mine ? "text-white" : "text-slate-500")}>
                    {mine ? "Вы" : judge ? "Судья" : msg.sender_competitor_name || "Участник"}
                </div>
                <div className="mt-1 whitespace-pre-wrap break-words">{msg.body}</div>
            </div>
        </div>
    )
}
