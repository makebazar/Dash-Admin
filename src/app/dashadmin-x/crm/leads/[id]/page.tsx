"use client";

import { useEffect, useState, useMemo, use } from "react";
import {
  Plus,
  Phone,
  User as UserIcon,
  Calendar,
  MessageSquare,
  Loader2,
  Trash2,
  PhoneCall,
  MapPin,
  Send,
  History,
  ChevronLeft,
  Briefcase,
  ExternalLink,
  MoreVertical,
  Check,
  X,
  FileText,
  ClipboardList,
  Globe,
  Navigation,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface Contact {
  id: string;
  name: string;
  phone: string | null;
  tg_username: string | null;
  role: string | null;
}

interface Lead {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  social_link: string | null;
  maps_link: string | null;
  status: string;
  notes: string | null;
  next_contact_at: string | null;
  created_at: string;
  assigned_user_id: string | null;
}

interface LeadNote {
  id: string;
  content: string;
  created_at: string;
  author_name: string | null;
}

interface Script {
  id: string;
  title: string;
  content: string;
}

interface CRMStatus {
  id: string;
  title: string;
  color: string;
}

export default function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [lead, setLead] = useState<Lead | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [statuses, setStatuses] = useState<CRMStatus[]>([]);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Modal states
  const [isScriptsOpen, setIsScriptsOpen] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [isAddingContact, setIsCreateContactOpen] = useState(false);
  const [contactForm, setContactFormData] = useState({
    name: "",
    phone: "",
    tg_username: "",
    role: "",
  });

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [leadRes, contactsRes, notesRes, statusesRes, scriptsRes, usersRes, meRes] =
        await Promise.all([
          fetch(`/api/dashadmin-x/crm/leads`),
          fetch(`/api/dashadmin-x/crm/leads/${id}/contacts`),
          fetch(`/api/dashadmin-x/crm/leads/${id}/notes`),
          fetch(`/api/dashadmin-x/crm/statuses`),
          fetch(`/api/dashadmin-x/crm/scripts`),
          fetch(`/api/dashadmin-x/users`),
          fetch(`/api/auth/me`),
        ]);

      if (leadRes.ok) {
        const allLeads = await leadRes.json();
        const currentLead = allLeads.find((l: Lead) => l.id === id);
        if (currentLead) setLead(currentLead);
      }

      if (contactsRes.ok) setContacts(await contactsRes.json());
      if (notesRes.ok) setNotes(await notesRes.json());
      if (statusesRes.ok) setStatuses(await statusesRes.json());
      if (scriptsRes.ok) setScripts(await scriptsRes.json());
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData.users || []);
      }
      if (meRes.ok) {
        const meData = await meRes.json();
        setCurrentUser(meData.user || null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const updateLead = async (fields: Partial<Lead>) => {
    try {
      const res = await fetch(`/api/dashadmin-x/crm/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (res.ok) {
        const updated = await res.json();
        setLead(updated);
      }
    } catch (e) {}
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    try {
      const res = await fetch(`/api/dashadmin-x/crm/leads/${id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newNote }),
      });
      if (res.ok) {
        const note = await res.json();
        setNotes([note, ...notes]);
        setNewNote("");
      }
    } catch (e) {}
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/dashadmin-x/crm/leads/${id}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contactForm),
      });
      if (res.ok) {
        const contact = await res.json();
        setContacts([...contacts, contact]);
        setContactFormData({ name: "", phone: "", tg_username: "", role: "" });
        setIsCreateContactOpen(false);
      }
    } catch (e) {}
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!confirm("Удалить контакт?")) return;
    try {
      const res = await fetch(
        `/api/dashadmin-x/crm/leads/${id}/contacts/${contactId}`,
        { method: "DELETE" },
      );
      if (res.ok) setContacts(contacts.filter((c) => c.id !== contactId));
    } catch (e) {}
  };

  const openLink = (url: string | null) => {
    if (!url) return;
    const formattedUrl = url.startsWith("http") ? url : `https://${url}`;
    window.open(formattedUrl, "_blank");
  };

  if (isLoading)
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  if (!lead)
    return <div className="p-8 text-center text-slate-500">Лид не найден</div>;

  return (
    <div className="flex flex-col h-screen bg-slate-50/50">
      {/* Header */}
      <header className="px-8 py-4 bg-white border-b border-slate-200 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/dashadmin-x/crm")}
            className="rounded-xl"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">{lead.name}</h1>
            </div>
            <p className="text-xs text-slate-400 mt-1 flex items-center">
              <MapPin className="h-3 w-3 mr-1" />{" "}
              {lead.city || "Город не указан"}
              {lead.address && <span className="ml-1">, {lead.address}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setIsScriptsOpen(true)}
            className="rounded-xl h-10"
          >
            <FileText className="h-4 w-4 mr-2" /> Скрипты
          </Button>
          <Button
            variant="ghost"
            className="text-rose-600 hover:bg-rose-50 h-10"
            onClick={async () => {
              if (confirm("Удалить этого лида полностью?")) {
                await fetch(`/api/dashadmin-x/crm/leads/${id}`, {
                  method: "DELETE",
                });
                router.push("/dashadmin-x/crm");
              }
            }}
          >
            <Trash2 className="h-4 w-4 mr-2" /> Удалить лида
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex gap-0">
        {/* Left Side: Info & Contacts */}
        <div className="w-112.5 border-r border-slate-200 bg-white overflow-y-auto p-8 space-y-10 custom-scrollbar">
          {/* Quick Links Section */}
          {(lead.social_link || lead.maps_link) && (
            <section className="space-y-4">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                Ссылки
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {lead.social_link && (
                  <Button
                    variant="outline"
                    className="rounded-xl border-slate-100 bg-slate-50 hover:bg-white text-slate-600 h-11"
                    onClick={() => openLink(lead.social_link)}
                  >
                    <Globe className="h-4 w-4 mr-2 text-blue-500" /> Соцсети
                  </Button>
                )}
                {lead.maps_link && (
                  <Button
                    variant="outline"
                    className="rounded-xl border-slate-100 bg-slate-50 hover:bg-white text-slate-600 h-11"
                    onClick={() => openLink(lead.maps_link)}
                  >
                    <Navigation className="h-4 w-4 mr-2 text-emerald-500" />{" "}
                    Карты
                  </Button>
                )}
              </div>
            </section>
          )}

          {/* Info Section */}
          <section className="space-y-6">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">
              Основная информация
            </h3>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-500">
                  Название клуба
                </Label>
                <Input
                  defaultValue={lead.name}
                  onBlur={(e) =>
                    lead.name !== e.target.value &&
                    updateLead({ name: e.target.value })
                  }
                  className="rounded-xl border-slate-200 focus:border-blue-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-500">
                    Город
                  </Label>
                  <Input
                    defaultValue={lead.city || ""}
                    onBlur={(e) =>
                      lead.city !== e.target.value &&
                      updateLead({ city: e.target.value })
                    }
                    className="rounded-xl border-slate-200 focus:border-blue-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-500">
                    Статус
                  </Label>
                  <Select
                    value={lead.status}
                    onValueChange={(v) => updateLead({ status: v })}
                  >
                    <SelectTrigger
                      className={cn(
                        "w-full h-10 px-3 rounded-xl font-bold text-[10px] uppercase tracking-wider border-slate-200",
                        statuses.find((c) => c.id === lead.status)?.color,
                      )}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statuses.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-500">Ответственный</Label>
                <Select
                  value={lead.assigned_user_id || "unassigned"}
                  onValueChange={(v) => updateLead({ assigned_user_id: v === "unassigned" ? null : v })}
                >
                  <SelectTrigger className="w-full h-10 px-3 rounded-xl border-slate-200 bg-white font-medium text-sm text-slate-700">
                    <SelectValue placeholder="Не назначен" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="unassigned" className="text-xs">Не назначен</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id} className="text-xs">
                        {u.full_name || u.phone_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-500">
                  Адрес
                </Label>
                <Input
                  defaultValue={lead.address || ""}
                  onBlur={(e) =>
                    lead.address !== e.target.value &&
                    updateLead({ address: e.target.value })
                  }
                  placeholder="ул. Ленина, д. 5"
                  className="rounded-xl border-slate-200 focus:border-blue-400"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-500">
                  Следующий контакт
                </Label>
                <Input
                  type="date"
                  defaultValue={
                    lead.next_contact_at
                      ? lead.next_contact_at.split("T")[0]
                      : ""
                  }
                  onChange={(e) =>
                    updateLead({ next_contact_at: e.target.value })
                  }
                  className="rounded-xl border-slate-200 focus:border-blue-400"
                />
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-500">
                    Ссылка на соцсети
                  </Label>
                  <Input
                    defaultValue={lead.social_link || ""}
                    onBlur={(e) =>
                      lead.social_link !== e.target.value &&
                      updateLead({ social_link: e.target.value })
                    }
                    placeholder="vk.com/..."
                    className="rounded-xl border-slate-200 focus:border-blue-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-500">
                    Ссылка на карты
                  </Label>
                  <Input
                    defaultValue={lead.maps_link || ""}
                    onBlur={(e) =>
                      lead.maps_link !== e.target.value &&
                      updateLead({ maps_link: e.target.value })
                    }
                    placeholder="yandex.ru/maps/..."
                    className="rounded-xl border-slate-200 focus:border-blue-400"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Contacts Section */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                Контактные лица
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCreateContactOpen(true)}
                className="text-blue-600 hover:bg-blue-50 rounded-lg"
              >
                <Plus className="h-4 w-4 mr-1" /> Добавить
              </Button>
            </div>

            <div className="space-y-3">
              {contacts.map((contact) => (
                <Card
                  key={contact.id}
                  className="p-4 rounded-2xl border-slate-100 hover:border-blue-100 hover:shadow-sm transition-all group relative"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-900 truncate">
                          {contact.name}
                        </p>
                        {contact.role && (
                          <Badge
                            variant="outline"
                            className="text-[9px] font-bold uppercase bg-slate-50 border-slate-100 text-slate-500"
                          >
                            {contact.role}
                          </Badge>
                        )}
                      </div>
                      <div className="mt-2 space-y-1">
                        {contact.phone && (
                          <a
                            href={`tel:${contact.phone}`}
                            className="flex items-center text-xs text-blue-600 font-bold hover:underline"
                          >
                            <Phone className="h-3 w-3 mr-1.5 text-slate-300" />{" "}
                            {contact.phone}
                          </a>
                        )}
                        {contact.tg_username && (
                          <button
                            onClick={() =>
                              window.open(
                                `https://t.me/${contact.tg_username?.replace("@", "")}`,
                                "_blank",
                              )
                            }
                            className="flex items-center text-xs text-sky-600 font-bold hover:underline"
                          >
                            <Send className="h-3 w-3 mr-1.5 text-slate-300" />{" "}
                            {contact.tg_username.startsWith("@")
                              ? contact.tg_username
                              : `@${contact.tg_username}`}
                          </button>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteContact(contact.id)}
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 rounded-lg"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))}

              {isAddingContact && (
                <Card className="p-4 rounded-2xl border-blue-200 bg-blue-50/30">
                  <form onSubmit={handleAddContact} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-slate-400">
                          Имя
                        </Label>
                        <Input
                          autoFocus
                          required
                          placeholder="Максим"
                          className="h-9 rounded-lg"
                          value={contactForm.name}
                          onChange={(e) =>
                            setContactFormData({
                              ...contactForm,
                              name: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-slate-400">
                          Должность
                        </Label>
                        <Input
                          placeholder="Владелец"
                          className="h-9 rounded-lg"
                          value={contactForm.role}
                          onChange={(e) =>
                            setContactFormData({
                              ...contactForm,
                              role: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-slate-400">
                          Телефон
                        </Label>
                        <Input
                          placeholder="7999..."
                          className="h-9 rounded-lg"
                          value={contactForm.phone}
                          onChange={(e) =>
                            setContactFormData({
                              ...contactForm,
                              phone: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-slate-400">
                          Telegram
                        </Label>
                        <Input
                          placeholder="@user"
                          className="h-9 rounded-lg"
                          value={contactForm.tg_username}
                          onChange={(e) =>
                            setContactFormData({
                              ...contactForm,
                              tg_username: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsCreateContactOpen(false)}
                        className="rounded-lg"
                      >
                        Отмена
                      </Button>
                      <Button
                        type="submit"
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 rounded-lg"
                      >
                        Добавить
                      </Button>
                    </div>
                  </form>
                </Card>
              )}
            </div>
          </section>
        </div>

        {/* Right Side: Chat History */}
        <div className="flex-1 flex flex-col bg-slate-50/50">
          <div className="flex-1 overflow-y-auto p-12 space-y-8 custom-scrollbar">
            <div className="max-w-3xl mx-auto space-y-8">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest text-center">
                История переговоров
              </h3>

              {notes.map((note) => (
                <div key={note.id} className="flex gap-4">
                  <div className="h-10 w-10 rounded-full bg-blue-50 border-4 border-white shadow-sm flex items-center justify-center shrink-0 text-xs font-bold text-blue-600">
                    {note.author_name ? note.author_name.substring(0, 2).toUpperCase() : <UserIcon className="h-5 w-5 text-slate-400" />}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="bg-white p-6 rounded-3xl rounded-tl-none border border-slate-200 shadow-sm relative">
                      <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                        {note.content}
                      </p>
                    </div>
                    <p className="text-[11px] font-bold text-slate-300 ml-2 uppercase">
                      {note.author_name && <span className="text-slate-500 mr-2">{note.author_name}</span>}
                      {format(new Date(note.created_at), "dd MMM yyyy, HH:mm", {
                        locale: ru,
                      })}
                    </p>
                  </div>
                </div>
              ))}

              {notes.length === 0 && (
                <div className="text-center py-20">
                  <div className="h-16 w-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-200 text-slate-300">
                    <MessageSquare className="h-8 w-8" />
                  </div>
                  <p className="text-slate-400 italic">
                    Напишите первый отчет о звонке ниже
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Note Input */}
          <div className="p-8 bg-white border-t border-slate-200 shadow-[0_-4px_30px_rgb(0,0,0,0.02)]">
            <div className="max-w-3xl mx-auto">
              <form onSubmit={handleAddNote} className="relative group">
                <Textarea
                  placeholder="Результат звонка или важная заметка..."
                  className="min-h-30 rounded-[32px] p-6 pr-16 resize-none border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-300 transition-all text-base"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      handleAddNote(e as any);
                    }
                  }}
                />
                <Button
                  type="submit"
                  disabled={!newNote.trim()}
                  className="absolute bottom-4 right-4 h-12 w-12 rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg transition-all disabled:opacity-50"
                >
                  <Send className="h-5 w-5 text-white" />
                </Button>
              </form>
              <p className="mt-3 text-[10px] text-slate-400 text-center uppercase font-bold tracking-wider">
                Нажми{" "}
                <kbd className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                  Cmd + Enter
                </kbd>{" "}
                чтобы отправить
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Scripts Dialog */}
      <Dialog open={isScriptsOpen} onOpenChange={setIsScriptsOpen}>
        <DialogContent className="sm:max-w-175 h-[80vh] flex flex-col">
          <DialogHeader className="flex flex-row items-center justify-between border-b pb-4 mb-4">
            <DialogTitle className="text-xl font-bold flex items-center">
              <ClipboardList className="h-5 w-5 mr-2 text-blue-600" />
              Скрипты продаж
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
            {scripts.length === 0 ? (
              <div className="text-center py-20 text-slate-400 italic">
                Скриптов пока нет. Добавьте их в общем разделе CRM.
              </div>
            ) : (
              scripts.map((script) => (
                <Card
                  key={script.id}
                  className="p-6 rounded-2xl border-slate-200"
                >
                  <h4 className="font-bold text-slate-900 mb-3 text-lg">
                    {script.title}
                  </h4>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed italic">
                      {script.content}
                    </p>
                  </div>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
