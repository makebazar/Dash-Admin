"use client"

import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { Headphones, Loader2, MessageSquare, Search, Send, ShieldCheck, UserRound } from "lucide-react"
import { SuperAdminPage } from "../_components/page-shell"

type SupportTicket = {
  id: number
  user_id: string | null
  guest_name?: string | null
  guest_email?: string | null
  guest_phone?: string | null
  source: string
  subject: string
  category: string
  priority: string
  status: string
  description: string
  assigned_to: string | null
  assigned_to_name?: string | null
  closed_at?: string | null
  created_at: string
  updated_at: string
  last_message_at: string
  submitter_name: string
  submitter_phone?: string | null
  submitter_email?: string | null
  message_count: number
}

type SupportMessage = {
  id: number
  ticket_id: number
  sender_id: string | null
  sender_name: string
  message: string
  is_staff: boolean
  created_at: string
}

type SupportResponse = {
  tickets: SupportTicket[]
  enums: {
    statuses: string[]
  }
}

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Открыт",
  IN_PROGRESS: "В работе",
  ANSWERED: "Отвечен",
  CLOSED: "Закрыт",
}

const CATEGORY_LABELS: Record<string, string> = {
  GENERAL: "Общее",
  BILLING: "Оплата",
  TECHNICAL: "Техническое",
  ACCESS: "Доступ",
  BUG: "Баг",
  FEATURE: "Фича",
}

const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Низкий",
  MEDIUM: "Средний",
  HIGH: "Высокий",
  URGENT: "Срочный",
}

export default function SuperAdminSupportPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [statuses, setStatuses] = useState<string[]>(["OPEN", "IN_PROGRESS", "ANSWERED", "CLOSED"])
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null)
  const [search, setSearch] = useState("")
  const [reply, setReply] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | null>(null)
  const [error, setError] = useState("")

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicketId) || null,
    [tickets, selectedTicketId]
  )

  const filteredTickets = useMemo(() => {
    const normalized = search.trim().toLowerCase()
    if (!normalized) return tickets

    return tickets.filter((ticket) =>
      [
        ticket.subject,
        ticket.submitter_name,
        ticket.submitter_email,
        ticket.submitter_phone,
        ticket.category,
        ticket.priority,
        ticket.status,
        String(ticket.id),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized))
    )
  }, [search, tickets])

  useEffect(() => {
    void loadTickets()
  }, [])

  useEffect(() => {
    if (!selectedTicketId) {
      setMessages([])
      return
    }

    void loadMessages(selectedTicketId)
  }, [selectedTicketId])

  const loadTickets = async (preferredTicketId?: number) => {
    try {
      setError("")
      setIsLoading(true)
      const res = await fetch("/api/support?scope=all", { cache: "no-store" })
      const data = (await res.json()) as SupportResponse & { error?: string }
      if (!res.ok) {
        throw new Error(data.error || "Не удалось загрузить обращения")
      }

      setTickets(data.tickets || [])
      setStatuses(data.enums?.statuses || ["OPEN", "IN_PROGRESS", "ANSWERED", "CLOSED"])

      if (preferredTicketId && data.tickets.some((ticket) => ticket.id === preferredTicketId)) {
        setSelectedTicketId(preferredTicketId)
      } else if (selectedTicketId && data.tickets.some((ticket) => ticket.id === selectedTicketId)) {
        setSelectedTicketId(selectedTicketId)
      } else {
        setSelectedTicketId(data.tickets[0]?.id ?? null)
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Ошибка загрузки")
    } finally {
      setIsLoading(false)
    }
  }

  const loadMessages = async (ticketId: number) => {
    try {
      const res = await fetch(`/api/support/${ticketId}/messages`, { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Не удалось загрузить переписку")
      }
      setMessages(Array.isArray(data.messages) ? data.messages : [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Ошибка загрузки сообщений")
    }
  }

  const updateStatus = async (status: string) => {
    if (!selectedTicketId) return

    try {
      setIsUpdatingStatus(status)
      setError("")
      const res = await fetch("/api/support", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket_id: selectedTicketId, status }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Не удалось обновить статус")
      }
      await loadTickets(selectedTicketId)
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Ошибка обновления статуса")
    } finally {
      setIsUpdatingStatus(null)
    }
  }

  const sendReply = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selectedTicketId || !reply.trim()) return

    try {
      setIsSending(true)
      setError("")
      const res = await fetch(`/api/support/${selectedTicketId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: reply }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Не удалось отправить сообщение")
      }
      setReply("")
      await Promise.all([loadTickets(selectedTicketId), loadMessages(selectedTicketId)])
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Ошибка отправки")
    } finally {
      setIsSending(false)
    }
  }

  const openCount = tickets.filter((ticket) => ticket.status === "OPEN").length
  const inProgressCount = tickets.filter((ticket) => ticket.status === "IN_PROGRESS").length
  const guestCount = tickets.filter((ticket) => !ticket.user_id).length

  return (
    <SuperAdminPage
      title="Поддержка"
      description="Все обращения сайта: гости, владельцы клубов и пользователи внутри кабинетов"
      actions={
        <div className="inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-sm text-red-200">
          <Headphones className="h-4 w-4" />
          Очередь super admin
        </div>
      }
    >

      {error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Открытые" value={openCount} tone="amber" />
        <MetricCard label="В работе" value={inProgressCount} tone="blue" />
        <MetricCard label="Гостевые" value={guestCount} tone="emerald" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="border-zinc-800 bg-zinc-900 text-white">
          <CardHeader className="space-y-4">
            <div>
              <CardTitle>Очередь обращений</CardTitle>
              <CardDescription className="text-zinc-400">
                Поиск по теме, контакту, ID и категории
              </CardDescription>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Поиск обращения"
                className="border-zinc-800 bg-zinc-950 pl-10 text-white placeholder:text-zinc-500"
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-10 text-sm text-zinc-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Загружаем обращения…
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-5 text-sm text-zinc-500">
                Обращения не найдены
              </div>
            ) : (
              filteredTickets.map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => setSelectedTicketId(ticket.id)}
                  className={cn(
                    "w-full rounded-xl border p-4 text-left transition-colors",
                    selectedTicketId === ticket.id
                      ? "border-red-500/30 bg-red-500/10"
                      : "border-zinc-800 bg-zinc-950 hover:bg-zinc-900"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{ticket.subject}</div>
                      <div className="mt-1 text-xs text-zinc-500">
                        #{ticket.id} • {ticket.submitter_name}
                      </div>
                    </div>
                    <Badge variant="outline" className="border-zinc-700 text-zinc-300">
                      {STATUS_LABELS[ticket.status] || ticket.status}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                    <span>{CATEGORY_LABELS[ticket.category] || ticket.category}</span>
                    <span>•</span>
                    <span>{PRIORITY_LABELS[ticket.priority] || ticket.priority}</span>
                    <span>•</span>
                    <span>{ticket.user_id ? "Аккаунт" : "Гость"}</span>
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900 text-white">
          <CardHeader>
            {selectedTicket ? (
              <div className="space-y-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <CardTitle className="text-2xl">{selectedTicket.subject}</CardTitle>
                    <CardDescription className="mt-2 text-zinc-400">
                      #{selectedTicket.id} • {selectedTicket.submitter_name}
                      {selectedTicket.submitter_email ? ` • ${selectedTicket.submitter_email}` : ""}
                      {selectedTicket.submitter_phone ? ` • ${selectedTicket.submitter_phone}` : ""}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="border-zinc-700 text-zinc-300">
                      {CATEGORY_LABELS[selectedTicket.category] || selectedTicket.category}
                    </Badge>
                    <Badge variant="outline" className="border-zinc-700 text-zinc-300">
                      {PRIORITY_LABELS[selectedTicket.priority] || selectedTicket.priority}
                    </Badge>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {statuses.map((status) => (
                    <Button
                      key={status}
                      size="sm"
                      variant={selectedTicket.status === status ? "default" : "outline"}
                      className={
                        selectedTicket.status === status
                          ? "bg-red-500 text-white hover:bg-red-400"
                          : "border-zinc-700 bg-zinc-950 text-zinc-200 hover:bg-zinc-800"
                      }
                      disabled={isUpdatingStatus === status}
                      onClick={() => updateStatus(status)}
                    >
                      {isUpdatingStatus === status ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                      {STATUS_LABELS[status] || status}
                    </Button>
                  ))}
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-300">
                  <div className="font-medium text-white">Первичное описание</div>
                  <p className="mt-2 whitespace-pre-wrap text-zinc-400">{selectedTicket.description}</p>
                  <div className="mt-3 text-xs text-zinc-500">
                    Источник: {selectedTicket.source} • Последняя активность:{" "}
                    {new Date(selectedTicket.last_message_at).toLocaleString("ru-RU")}
                  </div>
                </div>
              </div>
            ) : (
              <>
                <CardTitle>Выберите тикет</CardTitle>
                <CardDescription className="text-zinc-400">
                  Слева отображается вся очередь обращений
                </CardDescription>
              </>
            )}
          </CardHeader>
          <CardContent>
            {selectedTicket ? (
              <>
                <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
                  {messages.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-5 text-sm text-zinc-500">
                      Сообщений пока нет
                    </div>
                  ) : (
                    messages.map((message) => (
                      <div
                        key={message.id}
                        className={cn(
                          "rounded-2xl border p-4",
                          message.is_staff
                            ? "border-red-500/20 bg-red-500/10"
                            : "border-zinc-800 bg-zinc-950"
                        )}
                      >
                        <div className="flex items-center gap-2 text-xs text-zinc-500">
                          {message.is_staff ? <ShieldCheck className="h-3.5 w-3.5" /> : <UserRound className="h-3.5 w-3.5" />}
                          <span className="font-medium text-zinc-200">{message.sender_name}</span>
                          <span>•</span>
                          <span>{new Date(message.created_at).toLocaleString("ru-RU")}</span>
                        </div>
                        <div className="mt-2 whitespace-pre-wrap text-sm text-zinc-300">{message.message}</div>
                      </div>
                    ))
                  )}
                </div>

                <form onSubmit={sendReply} className="mt-5 space-y-3 border-t border-zinc-800 pt-5">
                  <Label htmlFor="super-admin-reply" className="text-zinc-300">Ответ пользователю</Label>
                  <Textarea
                    id="super-admin-reply"
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    className="min-h-[120px] border-zinc-800 bg-zinc-950 text-white placeholder:text-zinc-500"
                    placeholder="Напишите ответ, который увидит пользователь в обращении"
                  />
                  <Button type="submit" className="bg-red-500 text-white hover:bg-red-400" disabled={isSending || !reply.trim()}>
                    {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Отправить ответ
                  </Button>
                </form>
              </>
            ) : (
              <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-zinc-800 text-sm text-zinc-500">
                Ничего не выбрано
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </SuperAdminPage>
  )
}

function MetricCard({ label, value, tone }: { label: string; value: number; tone: "amber" | "blue" | "emerald" }) {
  const toneClass =
    tone === "amber"
      ? "border-amber-500/20 bg-amber-500/10 text-amber-100"
      : tone === "blue"
        ? "border-blue-500/20 bg-blue-500/10 text-blue-100"
        : "border-emerald-500/20 bg-emerald-500/10 text-emerald-100"

  return (
    <div className={cn("rounded-2xl border p-5", toneClass)}>
      <div className="text-sm opacity-80">{label}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
    </div>
  )
}
