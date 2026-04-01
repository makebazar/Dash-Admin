"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  ArrowLeft,
  Headphones,
  Loader2,
  MessageSquare,
  Send,
  ShieldCheck,
  UserRound,
  Zap,
} from "lucide-react"

type Viewer = {
  id: string
  full_name: string
  can_manage_all: boolean
}

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

type SupportEnums = {
  categories: string[]
  priorities: string[]
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

export default function SupportPage() {
  const [viewer, setViewer] = useState<Viewer | null>(null)
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null)
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [supportEnums, setSupportEnums] = useState<SupportEnums>({
    categories: ["GENERAL", "BILLING", "TECHNICAL", "ACCESS", "BUG", "FEATURE"],
    priorities: ["LOW", "MEDIUM", "HIGH", "URGENT"],
  })
  const [subject, setSubject] = useState("")
  const [description, setDescription] = useState("")
  const [guestName, setGuestName] = useState("")
  const [guestEmail, setGuestEmail] = useState("")
  const [guestPhone, setGuestPhone] = useState("")
  const [category, setCategory] = useState("GENERAL")
  const [priority, setPriority] = useState("MEDIUM")
  const [reply, setReply] = useState("")
  const [isPageLoading, setIsPageLoading] = useState(true)
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false)
  const [isSubmittingReply, setIsSubmittingReply] = useState(false)
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicketId) || null,
    [tickets, selectedTicketId]
  )

  useEffect(() => {
    void loadTickets()
  }, [])

  useEffect(() => {
    if (!viewer || !selectedTicketId) {
      setMessages([])
      return
    }

    void loadMessages(selectedTicketId)
  }, [viewer, selectedTicketId])

  const loadTickets = async (preferredTicketId?: number) => {
    try {
      if (!preferredTicketId) {
        setIsPageLoading(true)
      }
      setError("")

      const res = await fetch("/api/support", { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Не удалось загрузить обращения")
      }

      const nextTickets = Array.isArray(data.tickets) ? data.tickets : []
      const nextViewer = data.viewer || null
      setViewer(nextViewer)
      setTickets(nextTickets)
      setSupportEnums(data.enums || supportEnums)

      if (!nextViewer) {
        setSelectedTicketId(null)
        return
      }

      const preferredExists = preferredTicketId
        ? nextTickets.some((ticket: SupportTicket) => ticket.id === preferredTicketId)
        : false

      if (preferredExists) {
        setSelectedTicketId(preferredTicketId || null)
      } else if (selectedTicketId && nextTickets.some((ticket: SupportTicket) => ticket.id === selectedTicketId)) {
        setSelectedTicketId(selectedTicketId)
      } else {
        setSelectedTicketId(nextTickets[0]?.id ?? null)
      }
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Ошибка загрузки"
      setError(message)
    } finally {
      setIsPageLoading(false)
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
      const message = loadError instanceof Error ? loadError.message : "Ошибка загрузки сообщений"
      setError(message)
    }
  }

  const handleCreateTicket = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSubmittingTicket(true)
    setError("")
    setSuccessMessage("")

    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          description,
          category,
          priority,
          guest_name: guestName,
          guest_email: guestEmail,
          guest_phone: guestPhone,
          source: viewer ? "account" : "landing",
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Не удалось создать обращение")
      }

      setSubject("")
      setDescription("")
      setCategory("GENERAL")
      setPriority("MEDIUM")
      if (!viewer) {
        setGuestName("")
        setGuestEmail("")
        setGuestPhone("")
        setSuccessMessage("Обращение отправлено. Мы свяжемся по указанным контактам.")
        return
      }

      setSuccessMessage("Обращение создано и появилось в вашем списке.")
      await loadTickets(data.ticket_id)
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Ошибка создания обращения"
      setError(message)
    } finally {
      setIsSubmittingTicket(false)
    }
  }

  const handleSendReply = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selectedTicketId) return

    setIsSubmittingReply(true)
    setError("")

    try {
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
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Ошибка отправки сообщения"
      setError(message)
    } finally {
      setIsSubmittingReply(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#050816] text-white">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-purple-600/20 blur-[120px]" />
        <div className="absolute right-0 top-1/3 h-[320px] w-[320px] rounded-full bg-blue-500/10 blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/[0.03] px-5 py-4 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-500 to-blue-500">
              <Zap className="h-5 w-5 fill-current text-white" />
            </div>
            <div>
              <div className="text-lg font-semibold">DashAdmin</div>
              <div className="text-xs text-white/50">Центр поддержки</div>
            </div>
          </Link>

          <div className="flex flex-wrap items-center gap-3">
            <Link href="/" className="inline-flex items-center gap-2 text-sm text-white/60 transition-colors hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              На лендинг
            </Link>
            <Link href={viewer ? "/dashboard" : "/login"}>
              <Button variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10">
                {viewer ? "В кабинет" : "Войти"}
              </Button>
            </Link>
          </div>
        </header>

        <section className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200">
              <Headphones className="h-3.5 w-3.5" />
              Поддержка DashAdmin
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Обращение в поддержку
            </h1>
          </div>
          {viewer ? (
            <div className="text-sm text-white/45">
              {viewer.full_name}
            </div>
          ) : null}
        </section>

        {error ? (
          <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {successMessage ? (
          <div className="mb-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {successMessage}
          </div>
        ) : null}

        <div className={cn("grid gap-6", viewer ? "xl:grid-cols-[460px_minmax(0,1fr)]" : "xl:grid-cols-[1fr_420px]")}>
          <Card className="rounded-[28px] border-white/10 bg-white/[0.04] text-white shadow-2xl shadow-black/20">
            <CardHeader>
              <CardTitle className="text-2xl">Новое обращение</CardTitle>
              <CardDescription className="text-white/50">
                Чем конкретнее текст, тем быстрее ответ
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateTicket} className="space-y-5">
                {!viewer ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="guest-name" className="text-white/80">Имя</Label>
                      <Input
                        id="guest-name"
                        value={guestName}
                        onChange={(event) => setGuestName(event.target.value)}
                        className="border-white/10 bg-black/20 text-white placeholder:text-white/30"
                        placeholder="Как к вам обращаться"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="guest-phone" className="text-white/80">Телефон</Label>
                      <Input
                        id="guest-phone"
                        value={guestPhone}
                        onChange={(event) => setGuestPhone(event.target.value)}
                        className="border-white/10 bg-black/20 text-white placeholder:text-white/30"
                        placeholder="+7..."
                      />
                    </div>
                    <div className="grid gap-2 sm:col-span-2">
                      <Label htmlFor="guest-email" className="text-white/80">Email</Label>
                      <Input
                        id="guest-email"
                        value={guestEmail}
                        onChange={(event) => setGuestEmail(event.target.value)}
                        className="border-white/10 bg-black/20 text-white placeholder:text-white/30"
                        placeholder="name@example.com"
                      />
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-2">
                  <Label htmlFor="support-subject" className="text-white/80">Тема</Label>
                  <Input
                    id="support-subject"
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    className="border-white/10 bg-black/20 text-white placeholder:text-white/30"
                    placeholder="Например: не проходит вход по коду"
                    required
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label className="text-white/80">Категория</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger className="border-white/10 bg-black/20 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {supportEnums.categories.map((item) => (
                          <SelectItem key={item} value={item}>
                            {CATEGORY_LABELS[item] || item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label className="text-white/80">Приоритет</Label>
                    <Select value={priority} onValueChange={setPriority}>
                      <SelectTrigger className="border-white/10 bg-black/20 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {supportEnums.priorities.map((item) => (
                          <SelectItem key={item} value={item}>
                            {PRIORITY_LABELS[item] || item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="support-description" className="text-white/80">Описание</Label>
                  <Textarea
                    id="support-description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Что делали, что ожидали увидеть и что произошло фактически"
                    className="min-h-[180px] border-white/10 bg-black/20 text-white placeholder:text-white/30"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  className="h-12 w-full rounded-2xl bg-white text-black hover:bg-white/90"
                  disabled={isSubmittingTicket}
                >
                  {isSubmittingTicket ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Отправить обращение
                </Button>
              </form>
            </CardContent>
          </Card>

          {viewer ? (
            <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
              <Card className="rounded-[28px] border-white/10 bg-white/[0.04] text-white">
                <CardHeader>
                  <CardTitle className="text-2xl">Мои обращения</CardTitle>
                  <CardDescription className="text-white/50">
                    {isPageLoading ? "Загрузка…" : `${tickets.length} шт.`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isPageLoading ? (
                    <div className="flex items-center justify-center py-8 text-sm text-white/50">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Загружаем обращения…
                    </div>
                  ) : tickets.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 px-4 py-5 text-sm text-white/45">
                      Обращений пока нет
                    </div>
                  ) : (
                    tickets.map((ticket) => (
                      <button
                        key={ticket.id}
                        type="button"
                        onClick={() => setSelectedTicketId(ticket.id)}
                        className={cn(
                          "w-full rounded-2xl border p-4 text-left transition-all",
                          selectedTicketId === ticket.id
                            ? "border-white/25 bg-white/10"
                            : "border-white/10 bg-black/10 hover:bg-white/[0.06]"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate font-medium">{ticket.subject}</div>
                            <div className="mt-1 text-xs text-white/45">
                              #{ticket.id} • {CATEGORY_LABELS[ticket.category] || ticket.category}
                            </div>
                          </div>
                          <Badge variant="outline" className="border-white/15 text-white/70">
                            {STATUS_LABELS[ticket.status] || ticket.status}
                          </Badge>
                        </div>
                        <div className="mt-3 text-xs text-white/45">
                          {PRIORITY_LABELS[ticket.priority] || ticket.priority} • {ticket.message_count} сообщ.
                        </div>
                      </button>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-[28px] border-white/10 bg-white/[0.04] text-white">
                <CardHeader>
                  {selectedTicket ? (
                    <>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <CardTitle className="text-2xl">{selectedTicket.subject}</CardTitle>
                          <CardDescription className="mt-1 text-white/50">
                            #{selectedTicket.id} • {CATEGORY_LABELS[selectedTicket.category] || selectedTicket.category}
                          </CardDescription>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline" className="border-white/15 text-white/70">
                            {STATUS_LABELS[selectedTicket.status] || selectedTicket.status}
                          </Badge>
                          <Badge variant="outline" className="border-white/15 text-white/70">
                            {PRIORITY_LABELS[selectedTicket.priority] || selectedTicket.priority}
                          </Badge>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/10 p-4 text-sm text-white/60">
                        <div className="font-medium text-white">Первичное описание</div>
                        <p className="mt-2 whitespace-pre-wrap">{selectedTicket.description}</p>
                        {selectedTicket.assigned_to_name ? (
                          <div className="mt-3 text-xs text-white/45">
                            Ведёт обращение: <span className="text-white/80">{selectedTicket.assigned_to_name}</span>
                          </div>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <>
                      <CardTitle className="text-2xl">Диалог</CardTitle>
                      <CardDescription className="text-white/50">
                        Выберите обращение слева, чтобы продолжить переписку
                      </CardDescription>
                    </>
                  )}
                </CardHeader>
                <CardContent>
                  {selectedTicket ? (
                    <>
                      <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
                        {messages.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-white/10 px-4 py-5 text-sm text-white/45">
                            Сообщений пока нет
                          </div>
                        ) : (
                          messages.map((message) => (
                            <div
                              key={message.id}
                              className={cn(
                                "rounded-2xl border p-4",
                                message.is_staff
                                  ? "border-blue-400/20 bg-blue-400/10"
                                  : "border-white/10 bg-black/10"
                              )}
                            >
                              <div className="flex items-center gap-2 text-xs text-white/45">
                                {message.is_staff ? <ShieldCheck className="h-3.5 w-3.5" /> : <UserRound className="h-3.5 w-3.5" />}
                                <span className="font-medium text-white/80">{message.sender_name}</span>
                                <span>•</span>
                                <span>{new Date(message.created_at).toLocaleString("ru-RU")}</span>
                              </div>
                              <div className="mt-2 whitespace-pre-wrap text-sm text-white/85">{message.message}</div>
                            </div>
                          ))
                        )}
                      </div>

                      <form onSubmit={handleSendReply} className="mt-4 space-y-3 border-t border-white/10 pt-4">
                        <Label htmlFor="support-reply" className="text-white/80">Новый ответ</Label>
                        <Textarea
                          id="support-reply"
                          value={reply}
                          onChange={(event) => setReply(event.target.value)}
                          className="min-h-[120px] border-white/10 bg-black/20 text-white placeholder:text-white/30"
                          placeholder="Уточните детали, отправьте новую информацию или задайте вопрос"
                        />
                        <Button
                          type="submit"
                          className="rounded-2xl bg-white text-black hover:bg-white/90"
                          disabled={isSubmittingReply || !reply.trim()}
                        >
                          {isSubmittingReply ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-2 h-4 w-4" />}
                          Отправить сообщение
                        </Button>
                      </form>
                    </>
                  ) : (
                    <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-white/10 text-sm text-white/45">
                      Создайте обращение или выберите существующее
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="rounded-[28px] border-white/10 bg-white/[0.04] text-white">
              <CardHeader>
                <CardTitle className="text-2xl">Важно</CardTitle>
                <CardDescription className="text-white/50">
                  Нужен хотя бы один контакт для ответа
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm text-white/60">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  Укажите имя.
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  Укажите email или телефон.
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
