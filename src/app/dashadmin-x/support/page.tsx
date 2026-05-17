"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Headphones,
  Loader2,
  MessageSquare,
  Search,
  Send,
  ShieldCheck,
  UserRound,
} from "lucide-react";

type SupportTicket = {
  id: number;
  user_id: string | null;
  guest_name?: string | null;
  guest_email?: string | null;
  guest_phone?: string | null;
  source: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  description: string;
  assigned_to: string | null;
  assigned_to_name?: string | null;
  closed_at?: string | null;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  submitter_name: string;
  submitter_phone?: string | null;
  submitter_email?: string | null;
  message_count: number;
};

type SupportMessage = {
  id: number;
  ticket_id: number;
  sender_id: string | null;
  sender_name: string;
  message: string;
  is_staff: boolean;
  created_at: string;
};

type SupportResponse = {
  tickets: SupportTicket[];
  enums: {
    statuses: string[];
  };
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Открыт",
  IN_PROGRESS: "В работе",
  ANSWERED: "Отвечен",
  CLOSED: "Закрыт",
};

const CATEGORY_LABELS: Record<string, string> = {
  GENERAL: "Общее",
  BILLING: "Оплата",
  TECHNICAL: "Техническое",
  ACCESS: "Доступ",
  BUG: "Баг",
  FEATURE: "Фича",
};

const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Низкий",
  MEDIUM: "Средний",
  HIGH: "Высокий",
  URGENT: "Срочный",
};

export default function SupportPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [statuses, setStatuses] = useState<string[]>([
    "OPEN",
    "IN_PROGRESS",
    "ANSWERED",
    "CLOSED",
  ]);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [reply, setReply] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | null>(null);
  const [error, setError] = useState("");

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicketId) || null,
    [tickets, selectedTicketId],
  );

  const filteredTickets = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return tickets;

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
        .some((value) => String(value).toLowerCase().includes(normalized)),
    );
  }, [search, tickets]);

  useEffect(() => {
    void loadTickets();
  }, []);

  useEffect(() => {
    if (!selectedTicketId) {
      setMessages([]);
      return;
    }

    void loadMessages(selectedTicketId);
  }, [selectedTicketId]);

  const loadTickets = async (preferredTicketId?: number) => {
    try {
      setError("");
      setIsLoading(true);
      const res = await fetch("/api/support?scope=all", { cache: "no-store" });
      const data = (await res.json()) as SupportResponse & { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Не удалось загрузить обращения");
      }

      setTickets(data.tickets || []);
      setStatuses(
        data.enums?.statuses || ["OPEN", "IN_PROGRESS", "ANSWERED", "CLOSED"],
      );

      if (
        preferredTicketId &&
        data.tickets.some((ticket) => ticket.id === preferredTicketId)
      ) {
        setSelectedTicketId(preferredTicketId);
      } else if (
        selectedTicketId &&
        data.tickets.some((ticket) => ticket.id === selectedTicketId)
      ) {
        setSelectedTicketId(selectedTicketId);
      } else {
        setSelectedTicketId(data.tickets[0]?.id ?? null);
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Ошибка загрузки",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const loadMessages = async (ticketId: number) => {
    try {
      const res = await fetch(`/api/support/${ticketId}/messages`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Не удалось загрузить переписку");
      }
      setMessages(Array.isArray(data.messages) ? data.messages : []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Ошибка загрузки сообщений",
      );
    }
  };

  const updateStatus = async (status: string) => {
    if (!selectedTicketId) return;

    try {
      setIsUpdatingStatus(status);
      setError("");
      const res = await fetch("/api/support", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket_id: selectedTicketId, status }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Не удалось обновить статус");
      }
      await loadTickets(selectedTicketId);
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Ошибка обновления статуса",
      );
    } finally {
      setIsUpdatingStatus(null);
    }
  };

  const sendReply = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedTicketId || !reply.trim()) return;

    try {
      setIsSending(true);
      setError("");
      const res = await fetch(`/api/support/${selectedTicketId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: reply }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Не удалось отправить сообщение");
      }
      setReply("");
      await Promise.all([
        loadTickets(selectedTicketId),
        loadMessages(selectedTicketId),
      ]);
    } catch (sendError) {
      setError(
        sendError instanceof Error ? sendError.message : "Ошибка отправки",
      );
    } finally {
      setIsSending(false);
    }
  };

  const openCount = tickets.filter((ticket) => ticket.status === "OPEN").length;
  const inProgressCount = tickets.filter(
    (ticket) => ticket.status === "IN_PROGRESS",
  ).length;
  const guestCount = tickets.filter((ticket) => !ticket.user_id).length;

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 mb-2">
              Поддержка
            </h1>
            <p className="text-lg text-slate-500">
              Все обращения сайта: гости, владельцы клубов и пользователи
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm">
            <Headphones className="h-4 w-4 text-slate-400" />
            Очередь DashAdmin-X
          </div>
        </div>

        {error ? (
          <div className="mb-6 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        ) : null}

        <div className="grid gap-6 md:grid-cols-3 mb-8">
          <MetricCard label="Открытые" value={openCount} tone="amber" />
          <MetricCard label="В работе" value={inProgressCount} tone="blue" />
          <MetricCard label="Гостевые" value={guestCount} tone="emerald" />
        </div>

        <div className="grid gap-8 xl:grid-cols-[380px_minmax(0,1fr)]">
          <Card className="rounded-2xl border-slate-200 bg-white shadow-sm overflow-hidden">
            <CardHeader className="space-y-4 border-b border-slate-100">
              <div>
                <CardTitle className="text-xl">Очередь обращений</CardTitle>
                <CardDescription className="text-slate-500">
                  Поиск по теме, контакту, ID
                </CardDescription>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Поиск обращения..."
                  className="rounded-xl border-slate-200 bg-slate-50 pl-10 focus:bg-white transition-all"
                />
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {isLoading ? (
                <div className="flex items-center justify-center py-12 text-sm text-slate-400">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Загружаем...
                </div>
              ) : filteredTickets.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
                  Обращения не найдены
                </div>
              ) : (
                <div className="space-y-2 overflow-y-auto max-h-[600px] pr-2">
                  {filteredTickets.map((ticket) => (
                    <button
                      key={ticket.id}
                      type="button"
                      onClick={() => setSelectedTicketId(ticket.id)}
                      className={cn(
                        "w-full rounded-xl border p-4 text-left transition-all",
                        selectedTicketId === ticket.id
                          ? "border-slate-900 bg-slate-900 text-white shadow-lg shadow-slate-200"
                          : "border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div
                            className={cn(
                              "truncate font-semibold",
                              selectedTicketId === ticket.id
                                ? "text-white"
                                : "text-slate-900",
                            )}
                          >
                            {ticket.subject}
                          </div>
                          <div
                            className={cn(
                              "mt-1 text-xs",
                              selectedTicketId === ticket.id
                                ? "text-slate-400"
                                : "text-slate-500",
                            )}
                          >
                            #{ticket.id} • {ticket.submitter_name}
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-md text-[10px] uppercase tracking-wider font-bold",
                            selectedTicketId === ticket.id
                              ? "border-slate-700 text-slate-300"
                              : "border-slate-200 text-slate-500",
                          )}
                        >
                          {STATUS_LABELS[ticket.status] || ticket.status}
                        </Badge>
                      </div>
                      <div
                        className={cn(
                          "mt-3 flex flex-wrap items-center gap-2 text-[10px] font-medium uppercase tracking-wider",
                          selectedTicketId === ticket.id
                            ? "text-slate-500"
                            : "text-slate-400",
                        )}
                      >
                        <span>
                          {CATEGORY_LABELS[ticket.category] || ticket.category}
                        </span>
                        <span>•</span>
                        <span>
                          {PRIORITY_LABELS[ticket.priority] || ticket.priority}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-slate-200 bg-white shadow-sm overflow-hidden">
            {selectedTicket ? (
              <>
                <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                  <div className="space-y-6">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div>
                        <CardTitle className="text-2xl font-bold text-slate-900">
                          {selectedTicket.subject}
                        </CardTitle>
                        <CardDescription className="mt-2 text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
                          <span className="flex items-center gap-1.5">
                            <UserRound className="h-3.5 w-3.5" />{" "}
                            {selectedTicket.submitter_name}
                          </span>
                          {selectedTicket.submitter_email && (
                            <span>• {selectedTicket.submitter_email}</span>
                          )}
                          {selectedTicket.submitter_phone && (
                            <span>• {selectedTicket.submitter_phone}</span>
                          )}
                        </CardDescription>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge
                          variant="outline"
                          className="rounded-md border-slate-200 text-slate-600"
                        >
                          {CATEGORY_LABELS[selectedTicket.category] ||
                            selectedTicket.category}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="rounded-md border-slate-200 text-slate-600"
                        >
                          {PRIORITY_LABELS[selectedTicket.priority] ||
                            selectedTicket.priority}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {statuses.map((status) => (
                        <Button
                          key={status}
                          size="sm"
                          variant={
                            selectedTicket.status === status
                              ? "default"
                              : "outline"
                          }
                          className={cn(
                            "rounded-xl px-4 transition-all",
                            selectedTicket.status === status
                              ? "bg-slate-900 text-white hover:bg-slate-800"
                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                          )}
                          disabled={isUpdatingStatus === status}
                          onClick={() => updateStatus(status)}
                        >
                          {isUpdatingStatus === status ? (
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                          ) : null}
                          {STATUS_LABELS[status] || status}
                        </Button>
                      ))}
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm">
                      <div className="font-bold text-slate-900 mb-2 uppercase text-[10px] tracking-widest">
                        Описание проблемы
                      </div>
                      <p className="whitespace-pre-wrap text-slate-600 leading-relaxed">
                        {selectedTicket.description}
                      </p>
                      <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <span>Источник: {selectedTicket.source}</span>
                        <span>
                          Активность:{" "}
                          {new Date(
                            selectedTicket.last_message_at,
                          ).toLocaleString("ru-RU")}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="max-h-[400px] space-y-4 overflow-y-auto pr-2 mb-8">
                    {messages.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
                        Сообщений пока нет
                      </div>
                    ) : (
                      messages.map((message) => (
                        <div
                          key={message.id}
                          className={cn(
                            "rounded-2xl border p-4 transition-all",
                            message.is_staff
                              ? "border-slate-100 bg-slate-50 ml-12"
                              : "border-slate-200 bg-white mr-12 shadow-sm",
                          )}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                              {message.is_staff ? (
                                <ShieldCheck className="h-3 w-3" />
                              ) : (
                                <UserRound className="h-3 w-3" />
                              )}
                              <span
                                className={cn(
                                  message.is_staff
                                    ? "text-slate-900"
                                    : "text-slate-600",
                                )}
                              >
                                {message.sender_name}
                              </span>
                            </div>
                            <span className="text-[10px] font-medium text-slate-400">
                              {new Date(message.created_at).toLocaleString(
                                "ru-RU",
                              )}
                            </span>
                          </div>
                          <div className="whitespace-pre-wrap text-sm text-slate-600 leading-relaxed">
                            {message.message}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <form
                    onSubmit={sendReply}
                    className="space-y-4 pt-6 border-t border-slate-100"
                  >
                    <Label
                      htmlFor="support-reply"
                      className="text-xs font-bold uppercase tracking-widest text-slate-500"
                    >
                      Ваш ответ
                    </Label>
                    <Textarea
                      id="support-reply"
                      value={reply}
                      onChange={(event) => setReply(event.target.value)}
                      className="min-h-[120px] rounded-2xl border-slate-200 bg-slate-50 focus:bg-white transition-all placeholder:text-slate-400"
                      placeholder="Введите текст ответа..."
                    />
                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-11 px-8 shadow-lg shadow-slate-200 transition-all"
                        disabled={isSending || !reply.trim()}
                      >
                        {isSending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="mr-2 h-4 w-4" />
                        )}
                        Отправить
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </>
            ) : (
              <div className="flex min-h-[500px] items-center justify-center text-sm text-slate-400 italic">
                Выберите обращение для просмотра деталей
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "amber" | "blue" | "emerald";
}) {
  const toneClasses = {
    amber: "bg-amber-50 border-amber-100 text-amber-700",
    blue: "bg-blue-50 border-blue-100 text-blue-700",
    emerald: "bg-emerald-50 border-emerald-100 text-emerald-700",
  };

  return (
    <Card
      className={cn(
        "rounded-2xl border p-6 transition-all hover:shadow-md shadow-sm",
        toneClasses[tone],
      )}
    >
      <div className="text-xs font-bold uppercase tracking-widest opacity-70 mb-2">
        {label}
      </div>
      <div className="text-4xl font-bold tracking-tight">{value}</div>
    </Card>
  );
}
