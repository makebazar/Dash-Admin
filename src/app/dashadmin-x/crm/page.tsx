"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Plus,
  MoreVertical,
  Phone,
  User as UserIcon,
  Calendar,
  MessageSquare,
  Loader2,
  Search,
  Trash2,
  PhoneCall,
  MapPin,
  Send,
  FileText,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ClipboardList,
  Filter,
  Settings2,
  X,
  Globe,
  Navigation,
} from "lucide-react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  defaultDropAnimationSideEffects,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRouter } from "next/navigation";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface Lead {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  city: string | null;
  tg_username: string | null;
  address: string | null;
  social_link: string | null;
  maps_link: string | null;
  status: string;
  notes: string | null;
  next_contact_at: string | null;
  position: number;
  created_at: string;
  assigned_user_id: string | null;
  assignee_name: string | null;
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
  position: number;
}

export default function CRMPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [statuses, setStatuses] = useState<CRMStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState<string>("all");
  const [activeId, setActiveId] = useState<string | null>(null);

  // User states & assignee filtering
  const [users, setUsers] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [selectedAssignee, setSelectedAssignee] = useState<string>("all");

  // Scripts
  const [scripts, setScripts] = useState<Script[]>([]);
  const [isScriptsOpen, setIsScriptsOpen] = useState(false);
  const [isCreateScriptOpen, setIsCreateScriptOpen] = useState(false);
  const [scriptFormData, setScriptFormData] = useState({
    title: "",
    content: "",
  });

  // Status Management
  const [isStatusManagementOpen, setIsStatusManagementOpen] = useState(false);
  const [newStatusData, setNewStatusData] = useState({
    id: "",
    title: "",
    color: "bg-slate-100 text-slate-700",
  });

  // Dialog states for Create/Edit
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    contact_person: "",
    phone: "",
    city: "",
    tg_username: "",
    address: "",
    social_link: "",
    maps_link: "",
    status: "new",
    notes: "",
    next_contact_at: "",
    assigned_user_id: "",
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [leadsRes, statusesRes, scriptsRes, usersRes, meRes] = await Promise.all([
        fetch("/api/dashadmin-x/crm/leads"),
        fetch("/api/dashadmin-x/crm/statuses"),
        fetch("/api/dashadmin-x/crm/scripts"),
        fetch("/api/dashadmin-x/employees"),
        fetch("/api/auth/me"),
      ]);

      if (leadsRes.ok) setLeads(await leadsRes.json());
      if (statusesRes.ok) setStatuses(await statusesRes.json());
      if (scriptsRes.ok) setScripts(await scriptsRes.json());
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData.employees || []);
      }
      if (meRes.ok) {
        const meData = await meRes.json();
        setCurrentUser(meData.user || null);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/dashadmin-x/crm/statuses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newStatusData, position: statuses.length }),
      });
      if (res.ok) {
        const status = await res.json();
        setStatuses([...statuses, status]);
        setNewStatusData({
          id: "",
          title: "",
          color: "bg-slate-100 text-slate-700",
        });
      }
    } catch (e) {}
  };

  const handleDeleteStatus = async (statusId: string) => {
    const leadsCount = leads.filter((l) => l.status === statusId).length;
    if (leadsCount > 0) {
      alert(
        `Нельзя удалить этап, на котором есть лиды (${leadsCount}). Сначала переместите их.`,
      );
      return;
    }
    if (!confirm("Удалить этот этап из воронки?")) return;

    try {
      const res = await fetch(`/api/dashadmin-x/crm/statuses/${statusId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setStatuses(statuses.filter((s) => s.id !== statusId));
      } else {
        const error = await res.json();
        alert(error.error || "Ошибка при удалении");
      }
    } catch (e) {}
  };

  const handleMoveStatus = async (index: number, direction: "up" | "down") => {
    const newStatuses = [...statuses];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newStatuses.length) return;

    const temp = newStatuses[index];
    newStatuses[index] = newStatuses[targetIndex];
    newStatuses[targetIndex] = temp;

    setStatuses(newStatuses);

    try {
      await Promise.all(
        newStatuses.map((s, idx) =>
          fetch(`/api/dashadmin-x/crm/statuses/${s.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ position: idx }),
          })
        )
      );
    } catch (e) {
      console.error("Failed to reorder statuses:", e);
    }
  };

  const handleCreateScript = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/dashadmin-x/crm/scripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scriptFormData),
      });
      if (res.ok) {
        const script = await res.json();
        setScripts([script, ...scripts]);
        setIsCreateScriptOpen(false);
        setScriptFormData({ title: "", content: "" });
      }
    } catch (e) {}
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/dashadmin-x/crm/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        const newLead = await res.json();
        setLeads([...leads, newLead]);
        setIsCreateOpen(false);
        resetForm();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleUpdateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;
    try {
      const res = await fetch(`/api/dashadmin-x/crm/leads/${selectedLead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        const updatedLead = await res.json();
        setLeads(leads.map((l) => (l.id === updatedLead.id ? updatedLead : l)));
        setIsEditOpen(false);
        resetForm();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteLead = async (id: string) => {
    if (!confirm("Удалить лида?")) return;
    try {
      const res = await fetch(`/api/dashadmin-x/crm/leads/${id}`, {
        method: "DELETE",
      });
      if (res.ok) setLeads(leads.filter((l) => l.id !== id));
    } catch (error) {
      console.error(error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      contact_person: "",
      phone: "",
      city: "",
      tg_username: "",
      address: "",
      social_link: "",
      maps_link: "",
      status: statuses[0]?.id || "new",
      notes: "",
      next_contact_at: "",
      assigned_user_id: "",
    });
    setSelectedLead(null);
  };

  const openDetail = (lead: Lead) => {
    router.push(`/dashadmin-x/crm/leads/${lead.id}`);
  };

  const openEdit = (lead: Lead) => {
    setSelectedLead(lead);
    setFormData({
      name: lead.name,
      contact_person: lead.contact_person || "",
      phone: lead.phone || "",
      city: lead.city || "",
      tg_username: lead.tg_username || "",
      address: lead.address || "",
      social_link: lead.social_link || "",
      maps_link: lead.maps_link || "",
      status: lead.status,
      notes: lead.notes || "",
      next_contact_at: lead.next_contact_at
        ? lead.next_contact_at.split("T")[0]
        : "",
      assigned_user_id: lead.assigned_user_id || "",
    });
    setIsEditOpen(true);
  };

  const openCreate = (status: string) => {
    resetForm();
    setFormData((prev) => ({ ...prev, status }));
    setIsCreateOpen(true);
  };

  const cities = useMemo(() => {
    const uniqueCities = new Set(
      leads.map((l) => l.city).filter((c): c is string => Boolean(c))
    );
    return Array.from(uniqueCities).sort();
  }, [leads]);

  const filteredLeads = useMemo(() => {
    let result = leads;
    if (selectedCity !== "all")
      result = result.filter((l) => l.city === selectedCity);
    if (selectedAssignee !== "all") {
      if (selectedAssignee === "me") {
        result = result.filter((l) => l.assigned_user_id === currentUser?.id);
      } else if (selectedAssignee === "unassigned") {
        result = result.filter((l) => !l.assigned_user_id);
      } else {
        result = result.filter((l) => l.assigned_user_id === selectedAssignee);
      }
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.contact_person?.toLowerCase().includes(q) ||
          l.phone?.includes(q) ||
          l.city?.toLowerCase().includes(q) ||
          l.tg_username?.toLowerCase().includes(q) ||
          l.address?.toLowerCase().includes(q),
      );
    }
    return result;
  }, [leads, searchQuery, selectedCity, selectedAssignee, currentUser]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeLead = leads.find((l) => l.id === active.id);
    if (!activeLead) return;
    const overId = over.id as string;
    const overLead = leads.find((l) => l.id === overId);
    const overColumn = statuses.find((c) => c.id === overId);

    if (overLead) {
      if (activeLead.status !== overLead.status) {
        setLeads((prev) => {
          const activeIndex = prev.findIndex((l) => l.id === active.id);
          const overIndex = prev.findIndex((l) => l.id === overId);
          const newLeads = [...prev];
          newLeads[activeIndex] = {
            ...newLeads[activeIndex],
            status: overLead.status,
          };
          return arrayMove(newLeads, activeIndex, overIndex);
        });
      }
    } else if (overColumn) {
      if (activeLead.status !== overColumn.id) {
        setLeads((prev) => {
          const activeIndex = prev.findIndex((l) => l.id === active.id);
          const newLeads = [...prev];
          newLeads[activeIndex] = {
            ...newLeads[activeIndex],
            status: overColumn.id,
          };
          return newLeads;
        });
      }
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const activeLead = leads.find((l) => l.id === active.id);
    if (!activeLead) return;
    const columnLeads = leads.filter((l) => l.status === activeLead.status);
    const newPosition = columnLeads.findIndex((l) => l.id === active.id);
    try {
      await fetch(`/api/dashadmin-x/crm/leads/${active.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: activeLead.status,
          position: newPosition,
        }),
      });
    } catch (e) {}
  };

  const activeLead = activeId ? leads.find((l) => l.id === activeId) : null;

  return (
    <div className="flex flex-col h-screen bg-slate-50/50">
      <header className="fixed top-0 right-0 left-64 h-20 bg-white border-b border-slate-200 z-30 px-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-blue-50 rounded-lg">
            <PhoneCall className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">CRM Лиды</h1>
            <p className="text-xs text-slate-500 font-medium">
              Воронка продаж DashAdmin
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-1.5 border border-slate-200">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <Select value={selectedCity} onValueChange={setSelectedCity}>
              <SelectTrigger className="h-7 border-none bg-transparent shadow-none p-0 focus:ring-0 text-xs font-bold w-30">
                <SelectValue placeholder="Все города" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all" className="text-xs">
                  Все города
                </SelectItem>
                {cities.map((city) => (
                  <SelectItem key={city} value={city!} className="text-xs">
                    {city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-1.5 border border-slate-200">
            <UserIcon className="h-3.5 w-3.5 text-slate-400" />
            <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
              <SelectTrigger className="h-7 border-none bg-transparent shadow-none p-0 focus:ring-0 text-xs font-bold w-36">
                <SelectValue placeholder="Все ответственные" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all" className="text-xs">
                  Все ответственные
                </SelectItem>
                <SelectItem value="me" className="text-xs">
                  Мои лиды
                </SelectItem>
                <SelectItem value="unassigned" className="text-xs">
                  Без ответственного
                </SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id} className="text-xs">
                    {user.full_name || user.phone_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            onClick={() => setIsScriptsOpen(true)}
            className="h-10 rounded-xl"
          >
            <FileText className="h-4 w-4 mr-2" />
            Скрипты
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsStatusManagementOpen(true)}
            className="h-10 w-10 rounded-xl"
          >
            <Settings2 className="h-4 w-4" />
          </Button>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Поиск..."
              className="pl-9 h-10 bg-slate-50 border-slate-200 rounded-xl"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button
            onClick={() => openCreate(statuses[0]?.id || "new")}
            className="h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Добавить лида
          </Button>
        </div>
      </header>

      <main className="flex-1 mt-20 overflow-x-auto p-8 pl-12">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-6 h-full min-w-max pb-4">
              {statuses.map((column) => (
                <Column
                  key={column.id}
                  column={column}
                  leads={filteredLeads.filter((l) => l.status === column.id)}
                  onEdit={openEdit}
                  onAdd={() => openCreate(column.id)}
                  onDetail={openDetail}
                />
              ))}
            </div>
            <DragOverlay
              dropAnimation={{
                sideEffects: defaultDropAnimationSideEffects({
                  styles: { active: { opacity: "0.5" } },
                }),
              }}
            >
              {activeLead ? <LeadCard lead={activeLead} isOverlay /> : null}
            </DragOverlay>
          </DndContext>
        )}
      </main>

      {/* Dialogs */}
      <Dialog open={isScriptsOpen} onOpenChange={setIsScriptsOpen}>
        <DialogContent className="sm:max-w-175 h-[80vh] flex flex-col">
          <DialogHeader className="flex flex-row items-center justify-between border-b pb-4 mb-4">
            <DialogTitle className="text-xl font-bold flex items-center">
              <ClipboardList className="h-5 w-5 mr-2 text-blue-600" />
              Скрипты продаж
            </DialogTitle>
            <Button
              size="sm"
              onClick={() => setIsCreateScriptOpen(true)}
              className="rounded-xl mr-8"
            >
              <Plus className="h-4 w-4 mr-2" />
              Новый скрипт
            </Button>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
            {scripts.length === 0 ? (
              <div className="text-center py-20 text-slate-400 italic">
                Скриптов пока нет
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
                    <p className="text-sm text-slate-700 whitespace-pre-wrap italic">
                      {script.content}
                    </p>
                  </div>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isStatusManagementOpen}
        onOpenChange={setIsStatusManagementOpen}
      >
        <DialogContent className="sm:max-w-125">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Настройка воронки
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-3">
              <Label className="text-xs font-bold uppercase text-slate-400">
                Текущие этапы
              </Label>
              <div className="space-y-2">
                {statuses.map((s, idx) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 group"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "w-3 h-3 rounded-full",
                          s.color.split(" ")[0],
                        )}
                      />
                      <span className="font-bold text-sm text-slate-700">
                        {s.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={idx === 0}
                          onClick={() => handleMoveStatus(idx, "up")}
                          className="h-7 w-7 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg disabled:opacity-30 disabled:pointer-events-none"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={idx === statuses.length - 1}
                          onClick={() => handleMoveStatus(idx, "down")}
                          className="h-7 w-7 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg disabled:opacity-30 disabled:pointer-events-none"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </div>
                      <Badge
                        variant="outline"
                        className="text-[10px] uppercase font-bold text-slate-400"
                      >
                        {s.id}
                      </Badge>
                      {s.id !== "new" && s.id !== "rejected" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-300 hover:text-rose-600 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all rounded-lg"
                          onClick={() => handleDeleteStatus(s.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <form
              onSubmit={handleCreateStatus}
              className="space-y-4 p-4 bg-blue-50/50 rounded-2xl border border-blue-100"
            >
              <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                Добавить новый этап
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-bold">
                    ID (англ)
                  </Label>
                  <Input
                    required
                    placeholder="demo"
                    value={newStatusData.id}
                    onChange={(e) =>
                      setNewStatusData({
                        ...newStatusData,
                        id: e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9]/g, ""),
                      })
                    }
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-bold">
                    Заголовок
                  </Label>
                  <Input
                    required
                    placeholder="Демонстрация"
                    value={newStatusData.title}
                    onChange={(e) =>
                      setNewStatusData({
                        ...newStatusData,
                        title: e.target.value,
                      })
                    }
                    className="h-9"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-bold">
                  Цвет (Tailwind класс)
                </Label>
                <Input
                  placeholder="bg-blue-100 text-blue-700"
                  value={newStatusData.color}
                  onChange={(e) =>
                    setNewStatusData({
                      ...newStatusData,
                      color: e.target.value,
                    })
                  }
                  className="h-9"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-blue-600 rounded-xl h-9 text-xs"
              >
                Добавить в воронку
              </Button>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateScriptOpen} onOpenChange={setIsCreateScriptOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить скрипт</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateScript} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Название</Label>
              <Input
                required
                placeholder="Напр: Холодный звонок"
                value={scriptFormData.title}
                onChange={(e) =>
                  setScriptFormData({
                    ...scriptFormData,
                    title: e.target.value,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Текст скрипта</Label>
              <Textarea
                required
                placeholder="Текст..."
                rows={10}
                value={scriptFormData.content}
                onChange={(e) =>
                  setScriptFormData({
                    ...scriptFormData,
                    content: e.target.value,
                  })
                }
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateScriptOpen(false)}
              >
                Отмена
              </Button>
              <Button type="submit">Создать</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-125">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Новый лид</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateLead} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Название клуба *</Label>
              <Input
                id="name"
                required
                placeholder="Напр: Киберклуб"
                className="rounded-xl"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Город</Label>
                <Input
                  id="city"
                  list="cities-list"
                  placeholder="Москва"
                  className="rounded-xl"
                  value={formData.city}
                  onChange={(e) =>
                    setFormData({ ...formData, city: e.target.value })
                  }
                />
                <datalist id="cities-list">
                  {cities.map((city) => (
                    <option key={city} value={city} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Адрес</Label>
                <Input
                  id="address"
                  placeholder="ул. Ленина, 10"
                  className="rounded-xl"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">
                  Соцсети (ссылка)
                </Label>
                <Input
                  id="social"
                  placeholder="vk.com/..."
                  className="rounded-xl"
                  value={formData.social_link}
                  onChange={(e) =>
                    setFormData({ ...formData, social_link: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Карты (ссылка)</Label>
                <Input
                  id="maps"
                  placeholder="yandex.ru/maps/..."
                  className="rounded-xl"
                  value={formData.maps_link}
                  onChange={(e) =>
                    setFormData({ ...formData, maps_link: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Контакт</Label>
                <Input
                  id="contact"
                  placeholder="Рабочий телефон"
                  className="rounded-xl"
                  value={formData.contact_person}
                  onChange={(e) =>
                    setFormData({ ...formData, contact_person: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Телефон</Label>
                <Input
                  id="phone"
                  placeholder="+7 (999) 999-99-99"
                  className="rounded-xl"
                  value={formData.phone}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
                    let masked = "";
                    if (digits.length === 0) { masked = ""; }
                    else if (digits.length <= 1) { masked = "+" + digits; }
                    else if (digits.length <= 4) { masked = `+${digits[0]} (${digits.slice(1)}`; }
                    else if (digits.length <= 7) { masked = `+${digits[0]} (${digits.slice(1, 4)}) ${digits.slice(4)}`; }
                    else if (digits.length <= 9) { masked = `+${digits[0]} (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`; }
                    else { masked = `+${digits[0]} (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`; }
                    setFormData({ ...formData, phone: masked });
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Статус</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData({ ...formData, status: v })}
                >
                  <SelectTrigger className="rounded-xl">
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
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Дата контакта</Label>
                <Input
                  id="next"
                  type="date"
                  className="rounded-xl"
                  value={formData.next_contact_at}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      next_contact_at: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Ответственный</Label>
              <Select
                value={formData.assigned_user_id || "unassigned"}
                onValueChange={(v) => setFormData({ ...formData, assigned_user_id: v === "unassigned" ? "" : v })}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Не назначен" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Не назначен</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name || u.phone_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                className="rounded-xl"
              >
                Отмена
              </Button>
              <Button type="submit" className="bg-blue-600 rounded-xl">
                Создать
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-106.25">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Редактирование
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateLead} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Название клуба *</Label>
              <Input
                required
                className="rounded-xl"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Город</Label>
                <Input
                  list="cities-list"
                  className="rounded-xl"
                  value={formData.city}
                  onChange={(e) =>
                    setFormData({ ...formData, city: e.target.value })
                  }
                />
                <datalist id="cities-list">
                  {cities.map((city) => (
                    <option key={city} value={city} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Telegram</Label>
                <Input
                  className="rounded-xl"
                  value={formData.tg_username}
                  onChange={(e) =>
                    setFormData({ ...formData, tg_username: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Статус</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData({ ...formData, status: v })}
                >
                  <SelectTrigger className="rounded-xl">
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
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Дата контакта</Label>
                <Input
                  type="date"
                  className="rounded-xl"
                  value={formData.next_contact_at}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      next_contact_at: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Ответственный</Label>
              <Select
                value={formData.assigned_user_id || "unassigned"}
                onValueChange={(v) => setFormData({ ...formData, assigned_user_id: v === "unassigned" ? "" : v })}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Не назначен" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Не назначен</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name || u.phone_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="flex justify-between items-center pt-2">
              <Button
                type="button"
                variant="ghost"
                className="text-rose-600 hover:bg-rose-50 rounded-xl"
                onClick={() => {
                  if (selectedLead) handleDeleteLead(selectedLead.id);
                  setIsEditOpen(false);
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Удалить
              </Button>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditOpen(false)}
                  className="rounded-xl"
                >
                  Отмена
                </Button>
                <Button type="submit" className="bg-blue-600 rounded-xl">
                  Сохранить
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Column({
  column,
  leads,
  onEdit,
  onAdd,
  onDetail,
}: {
  column: CRMStatus;
  leads: Lead[];
  onEdit: any;
  onAdd: any;
  onDetail: any;
}) {
  const { setNodeRef } = useSortable({
    id: column.id,
    data: { type: "Column", column },
  });
  return (
    <div ref={setNodeRef} className="flex flex-col w-72 shrink-0 h-full">
      <div className="flex items-center justify-between mb-4 px-2 shrink-0">
        <div className="flex items-center gap-2">
          <Badge
            variant="secondary"
            className={cn(
              "rounded-lg px-2 py-1 font-bold text-[10px] uppercase tracking-wider",
              column.color,
            )}
          >
            {column.title}
          </Badge>
          <span className="text-xs font-bold text-slate-300">
            {leads.length}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onAdd}
          className="h-7 w-7 rounded-lg text-slate-400 hover:text-blue-600 transition-all"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 flex flex-col gap-3 min-h-50 bg-slate-100/30 rounded-2xl p-2 border border-dashed border-slate-200 overflow-y-auto custom-scrollbar">
        <SortableContext
          items={leads.map((l) => l.id)}
          strategy={verticalListSortingStrategy}
        >
          {leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onClick={() => onDetail(lead)}
              onEdit={() => onEdit(lead)}
            />
          ))}
        </SortableContext>
        <Button
          variant="ghost"
          className="w-full justify-start text-slate-400 hover:text-blue-600 h-10 px-3 rounded-xl group shrink-0"
          onClick={onAdd}
        >
          <Plus className="h-4 w-4 mr-2 group-hover:scale-110" />
          <span className="text-xs font-medium">Добавить лида</span>
        </Button>
      </div>
    </div>
  );
}

function LeadCard({
  lead,
  isOverlay,
  onClick,
  onEdit,
}: {
  lead: Lead;
  isOverlay?: boolean;
  onClick?: () => void;
  onEdit?: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id, data: { type: "Lead", lead } });
  const style = { transform: CSS.Translate.toString(transform), transition };
  if (isDragging)
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="h-32 rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/50"
      />
    );
  const nextContact = lead.next_contact_at
    ? new Date(lead.next_contact_at)
    : null;
  const isOverdue =
    nextContact &&
    nextContact < new Date() &&
    lead.status !== "success" &&
    lead.status !== "rejected";
  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        "group relative p-4 bg-white border-slate-200 hover:border-blue-200 hover:shadow-lg transition-all cursor-grab active:cursor-grabbing rounded-2xl shrink-0",
        isOverlay && "shadow-xl border-blue-300 rotate-1 scale-105 z-50",
        isOverdue && "border-rose-200 bg-rose-50/30",
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-slate-900 text-sm leading-tight group-hover:text-blue-600 truncate">
            {lead.name}
          </h3>
          <div className="space-y-0.5 mt-0.5">
            {lead.city && (
              <div className="flex items-center text-[10px] text-slate-400 font-medium">
                <MapPin className="h-2.5 w-2.5 mr-1 shrink-0" />
                {lead.city}
              </div>
            )}
            {lead.address && (
              <div className="flex items-center text-[9px] text-slate-400 truncate">
                <span className="truncate">{lead.address}</span>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="space-y-2">
        {(lead.social_link || lead.maps_link) && (
          <div className="flex items-center gap-2 mb-1">
            {lead.social_link && <Globe className="h-3 w-3 text-slate-300" />}
            {lead.maps_link && (
              <Navigation className="h-3 w-3 text-slate-300" />
            )}
          </div>
        )}
        {nextContact && (
          <div
            className={cn(
              "flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg w-fit",
              isOverdue
                ? "bg-rose-100 text-rose-600"
                : "bg-slate-100 text-slate-500",
            )}
          >
            <Calendar className="h-3 w-3 mr-1.5" />
            {format(nextContact, "dd MMM", { locale: ru })}
          </div>
        )}
        {lead.assignee_name && (
          <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100">
            <div className="h-5 w-5 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-[8px] font-bold text-blue-600 shrink-0">
              {lead.assignee_name.substring(0, 2).toUpperCase()}
            </div>
            <span className="text-[10px] text-slate-500 font-medium truncate">
              {lead.assignee_name}
            </span>
          </div>
        )}
      </div>
      <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <ChevronRight className="h-4 w-4 text-blue-400" />
      </div>
    </Card>
  );
}
