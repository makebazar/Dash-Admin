"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Calendar as CalendarIcon,
  X,
  Monitor,
  Search,
  Check,
  Trash2,
  MapPin,
  ChevronLeft,
  Info,
} from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface Employee {
  id: string;
  full_name: string;
  role: string;
}

interface Equipment {
  id: string;
  name: string;
  type: string;
  identifier: string;
  type_name: string;
  workstation_id: string;
  workstation_name: string;
  workstation_zone: string;
  parent_equipment_id?: string | null;
}

interface Workstation {
  id: string;
  name: string;
  zone: string;
}

interface CreateAssignmentModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  clubId: string;
  onCreated: () => void;
  isLight?: boolean;
}

export function CreateAssignmentModal({
  isOpen,
  onOpenChange,
  clubId,
  onCreated,
  isLight = false,
}: CreateAssignmentModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [workstations, setWorkstations] = useState<Workstation[]>([]);

  const [selectedZone, setSelectedZone] = useState<string>("all");
  const [selectedWorkstationId, setSelectedWorkstationId] =
    useState<string>("all");
  const [equipmentSearch, setEquipmentSearch] = useState("");
  const [isDataLoading, setIsDataLoading] = useState(false);

  // Mobile tabs state
  const [activeTab, setActiveTab] = useState<"info" | "equipment">("info");

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    assigned_to: "",
    priority: "MEDIUM",
    due_date: undefined as Date | undefined,
    equipment_ids: [] as string[],
    taskType: "GENERAL" as "GENERAL" | "PERFORMANCE_CHECK",
  });

  useEffect(() => {
    if (isOpen) {
      fetchData();
      setActiveTab("info");
      setFormData((prev) => ({
        ...prev,
        taskType: "GENERAL",
        title: "",
        description: "",
      }));
    }
  }, [isOpen]);

  const fetchData = async () => {
    try {
      setIsDataLoading(true);
      const [empRes, eqRes, wsRes] = await Promise.all([
        fetch(`/api/clubs/${clubId}/employees`),
        fetch(`/api/clubs/${clubId}/equipment?limit=1000`),
        fetch(`/api/clubs/${clubId}/workstations`),
      ]);

      const [empData, eqData, wsData] = await Promise.all([
        empRes.json(),
        eqRes.json(),
        wsRes.json(),
      ]);

      if (empRes.ok) setEmployees(empData.employees || []);
      if (eqRes.ok) setEquipmentList(eqData.equipment || []);
      if (wsRes.ok) setWorkstations(wsData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsDataLoading(false);
    }
  };

  const zones = useMemo(() => {
    const z = new Set(workstations.map((ws) => ws.zone));
    return Array.from(z).sort();
  }, [workstations]);

  const filteredWorkstations = useMemo(() => {
    if (selectedZone === "all") return workstations;
    return workstations.filter((ws) => ws.zone === selectedZone);
  }, [workstations, selectedZone]);

  const filteredEquipment = useMemo(() => {
    return equipmentList.filter((eq) => {
      if (eq.parent_equipment_id) return false;
      if (formData.taskType === "PERFORMANCE_CHECK" && eq.type !== "PC")
        return false;

      const matchesSearch =
        eq.name.toLowerCase().includes(equipmentSearch.toLowerCase()) ||
        eq.identifier?.toLowerCase().includes(equipmentSearch.toLowerCase());

      const matchesZone =
        selectedZone === "all" || eq.workstation_zone === selectedZone;
      const matchesWS =
        selectedWorkstationId === "all" ||
        eq.workstation_id === selectedWorkstationId;

      return matchesSearch && matchesZone && matchesWS;
    });
  }, [
    equipmentList,
    equipmentSearch,
    selectedZone,
    selectedWorkstationId,
    formData.taskType,
  ]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isLoading) return;
    if (formData.taskType === "GENERAL" && !formData.title) return;
    if (
      formData.taskType === "PERFORMANCE_CHECK" &&
      formData.equipment_ids.length === 0
    ) {
      alert("Выберите ПК во вкладке Оборудование");
      return;
    }

    try {
      setIsLoading(true);

      const res = await fetch(`/api/clubs/${clubId}/employee-tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          assigned_to:
            formData.assigned_to === "none"
              ? null
              : formData.assigned_to || null,
        }),
      });
      if (res.ok) {
        onCreated();
        onOpenChange(false);
        setFormData({
          title: "",
          description: "",
          assigned_to: "",
          priority: "MEDIUM",
          due_date: undefined,
          equipment_ids: [],
          taskType: "GENERAL",
        });
        setSelectedZone("all");
        setSelectedWorkstationId("all");
      } else {
        alert("Ошибка при создании поручения");
      }
    } catch (error) {
      console.error("Error creating task:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleEquipment = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      equipment_ids: prev.equipment_ids.includes(id)
        ? prev.equipment_ids.filter((eId) => eId !== id)
        : [...prev.equipment_ids, id],
    }));
  };

  const selectedEquipmentObjects = equipmentList.filter((e) =>
    formData.equipment_ids.includes(e.id),
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-w-4xl md:max-h-[90vh] w-full h-dvh md:h-auto overflow-hidden flex flex-col p-0 shadow-2xl rounded-none md:rounded-lg",
          " [&>button]:hidden md:[&>button]:inline-flex",
          isLight
            ? "bg-white border-slate-200"
            : "bg-[#0a0b10] border-none md:border md:border-white/5",
        )}
      >
        <DialogHeader
          className={cn(
            "p-4 md:p-6 border-b shrink-0 relative",
            isLight
              ? "bg-slate-50 border-slate-200"
              : "bg-[#11131a] border-white/5",
          )}
        >
          <div className="flex items-center justify-center md:justify-start min-h-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className={cn(
                "md:hidden absolute left-4",
                isLight
                  ? "text-slate-400 hover:text-slate-900"
                  : "text-slate-400 hover:text-white",
              )}
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <DialogTitle
              className={cn(
                "text-[10px] md:text-sm font-black uppercase tracking-[0.2em]",
                isLight ? "text-slate-500" : "text-slate-500",
              )}
            >
              Новое поручение
            </DialogTitle>
          </div>
        </DialogHeader>

        {/* Mobile Tab Switcher */}
        <div
          className={cn(
            "md:hidden p-3 border-b flex gap-2 shrink-0",
            isLight
              ? "bg-slate-50 border-slate-200"
              : "bg-[#11131a] border-white/5",
          )}
        >
          <button
            onClick={() => setActiveTab("info")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
              activeTab === "info"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                : isLight
                  ? "bg-slate-200/50 text-slate-500"
                  : "bg-white/5 text-slate-500",
            )}
          >
            <Info className="h-3.5 w-3.5" />
            Информация
          </button>
          <button
            onClick={() => setActiveTab("equipment")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
              activeTab === "equipment"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                : isLight
                  ? "bg-slate-200/50 text-slate-500"
                  : "bg-white/5 text-slate-500",
            )}
          >
            <Monitor className="h-3.5 w-3.5" />
            Оборудование
            {formData.equipment_ids.length > 0 && (
              <span
                className={cn(
                  "ml-1 px-1.5 rounded-full text-[8px]",
                  activeTab === "equipment"
                    ? "bg-white/20 text-white"
                    : "bg-blue-500/20 text-blue-500",
                )}
              >
                {formData.equipment_ids.length}
              </span>
            )}
          </button>
        </div>

        <div
          className={cn(
            "flex-1 overflow-hidden flex flex-col md:flex-row relative",
            isLight ? "bg-white" : "bg-[#0a0b10]",
          )}
        >
          {/* Main Info Section */}
          <div
            className={cn(
              "flex-1 overflow-y-auto p-5 md:p-8 space-y-6 md:space-y-8 border-b md:border-b-0 md:border-r pb-32 md:pb-8",
              isLight ? "border-slate-200" : "border-white/5",
              activeTab !== "info" && "hidden md:block",
            )}
          >
            <div className="space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                  Тип поручения
                </Label>
                <Select
                  value={formData.taskType}
                  onValueChange={(v: "GENERAL" | "PERFORMANCE_CHECK") =>
                    setFormData({ ...formData, taskType: v, equipment_ids: [] })
                  }
                >
                  <SelectTrigger
                    className={cn(
                      "rounded-xl h-11 text-xs font-bold",
                      isLight
                        ? "bg-slate-50 border-slate-200 text-slate-900"
                        : "bg-[#11131a] border-white/10 text-white",
                    )}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent
                    className={cn(
                      "border-none shadow-xl",
                      isLight
                        ? "bg-white text-slate-900"
                        : "bg-[#11131a] text-white",
                    )}
                  >
                    <SelectItem value="GENERAL">Обычная задача</SelectItem>
                    <SelectItem value="PERFORMANCE_CHECK">
                      Замер производительности
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.taskType === "GENERAL" && (
                <>
                  <div className="space-y-2">
                    <Label
                      htmlFor="title"
                      className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500"
                    >
                      Название поручения
                    </Label>
                    <Input
                      id="title"
                      placeholder="Название задачи..."
                      required
                      className={cn(
                        "rounded-xl h-12 text-sm font-medium transition-all",
                        isLight
                          ? "bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:ring-blue-500/20 placeholder:text-slate-400"
                          : "bg-[#11131a] border-white/10 text-white focus:bg-[#0a0b10] focus:ring-blue-500/20 placeholder:text-slate-600",
                      )}
                      value={formData.title}
                      onChange={(e) =>
                        setFormData({ ...formData, title: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="description"
                      className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500"
                    >
                      Описание
                    </Label>
                    <Textarea
                      id="description"
                      placeholder="Подробности задачи..."
                      className={cn(
                        "rounded-xl min-h-30 text-sm font-medium transition-all resize-none",
                        isLight
                          ? "bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:ring-blue-500/20 placeholder:text-slate-400"
                          : "bg-[#11131a] border-white/10 text-white focus:bg-[#0a0b10] focus:ring-blue-500/20 placeholder:text-slate-600",
                      )}
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          description: e.target.value,
                        })
                      }
                    />
                  </div>
                </>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                    Исполнитель
                  </Label>
                  <Select
                    value={formData.assigned_to}
                    onValueChange={(v) =>
                      setFormData({ ...formData, assigned_to: v })
                    }
                  >
                    <SelectTrigger
                      className={cn(
                        "rounded-xl h-11 text-xs",
                        isLight
                          ? "bg-slate-50 border-slate-200 text-slate-900"
                          : "bg-[#11131a] border-white/10 text-white",
                      )}
                    >
                      <SelectValue placeholder="Выберите сотрудника" />
                    </SelectTrigger>
                    <SelectContent
                      className={cn(
                        "border-none shadow-xl",
                        isLight
                          ? "bg-white text-slate-900"
                          : "bg-[#11131a] text-white",
                      )}
                    >
                      <SelectItem value="none">Не назначен</SelectItem>
                      {employees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                    Приоритет
                  </Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(v) =>
                      setFormData({ ...formData, priority: v })
                    }
                  >
                    <SelectTrigger
                      className={cn(
                        "rounded-xl h-11 text-xs",
                        isLight
                          ? "bg-slate-50 border-slate-200 text-slate-900"
                          : "bg-[#11131a] border-white/10 text-white",
                      )}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent
                      className={cn(
                        "border-none shadow-xl",
                        isLight
                          ? "bg-white text-slate-900"
                          : "bg-[#11131a] text-white",
                      )}
                    >
                      <SelectItem value="LOW">Низкий</SelectItem>
                      <SelectItem value="MEDIUM">Средний</SelectItem>
                      <SelectItem value="HIGH">Высокий</SelectItem>
                      <SelectItem value="CRITICAL">Критический</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                  Срок выполнения (Дедлайн)
                </Label>
                <DatePicker
                  value={formData.due_date}
                  className={cn(
                    "rounded-xl h-11 text-xs",
                    isLight
                      ? "bg-slate-50 border-slate-200 text-slate-900"
                      : "bg-[#11131a] border-white/10 text-white",
                  )}
                  onChange={(date) =>
                    setFormData({ ...formData, due_date: date })
                  }
                />
              </div>
            </div>
          </div>

          {/* Equipment Section */}
          <div
            className={cn(
              "w-full md:w-96 flex flex-col pb-32 md:pb-0",
              isLight ? "bg-slate-50/50" : "bg-[#0d0e15]",
              activeTab !== "equipment" && "hidden md:flex",
            )}
          >
            <div
              className={cn(
                "p-5 border-b hidden md:flex items-center justify-between bg-[#11131a]",
                isLight
                  ? "bg-slate-100 border-slate-200"
                  : "bg-[#11131a] border-white/5",
              )}
            >
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 text-blue-500">
                <Monitor className="h-4 w-4" />
                Оборудование
              </h4>
              <Badge
                variant="secondary"
                className={cn(
                  "border-none font-black text-[10px] px-2",
                  isLight
                    ? "bg-slate-200 text-slate-500"
                    : "bg-white/5 text-slate-400",
                )}
              >
                {formData.equipment_ids.length}
              </Badge>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 custom-scrollbar">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase text-slate-500 tracking-widest ml-1">
                      Зона
                    </Label>
                    <Select
                      value={selectedZone}
                      onValueChange={(v) => {
                        setSelectedZone(v);
                        setSelectedWorkstationId("all");
                      }}
                    >
                      <SelectTrigger
                        className={cn(
                          "rounded-lg h-9 text-[10px] font-bold",
                          isLight
                            ? "bg-white border-slate-200"
                            : "bg-white/5 border-white/5",
                        )}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Все зоны</SelectItem>
                        {zones.map((z) => (
                          <SelectItem key={z} value={z}>
                            {z}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase text-slate-500 tracking-widest ml-1">
                      Место
                    </Label>
                    <Select
                      value={selectedWorkstationId}
                      onValueChange={setSelectedWorkstationId}
                    >
                      <SelectTrigger
                        className={cn(
                          "rounded-lg h-9 text-[10px] font-bold",
                          isLight
                            ? "bg-white border-slate-200"
                            : "bg-white/5 border-white/5",
                        )}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Все места</SelectItem>
                        {filteredWorkstations.map((ws) => (
                          <SelectItem key={ws.id} value={ws.id}>
                            {ws.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                  <Input
                    placeholder="Поиск по названию или ID..."
                    className={cn(
                      "pl-9 h-10 text-[11px] font-bold rounded-xl transition-all",
                      isLight
                        ? "bg-white border-slate-200 text-slate-900 focus:bg-slate-50"
                        : "bg-black/20 border-white/5 text-white focus:bg-black/40",
                    )}
                    value={equipmentSearch}
                    onChange={(e) => setEquipmentSearch(e.target.value)}
                  />
                </div>

                <div
                  className={cn(
                    "border rounded-xl overflow-hidden max-h-75 md:max-h-87.5 overflow-y-auto custom-scrollbar transition-all shadow-sm",
                    isLight
                      ? "bg-white border-slate-200"
                      : "bg-[#11131a] border-white/5",
                  )}
                >
                  {isDataLoading ? (
                    <div className="p-12 flex items-center justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                    </div>
                  ) : filteredEquipment.length === 0 ? (
                    <div className="p-12 text-center text-[10px] font-black uppercase text-slate-500 tracking-widest">
                      Ничего не найдено
                    </div>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {filteredEquipment.map((eq) => {
                        const isSelected = formData.equipment_ids.includes(
                          eq.id,
                        );
                        return (
                          <div
                            key={eq.id}
                            onClick={() => toggleEquipment(eq.id)}
                            className={cn(
                              "flex items-center justify-between p-3 cursor-pointer transition-all group",
                              isSelected
                                ? isLight
                                  ? "bg-blue-50"
                                  : "bg-blue-500/10"
                                : isLight
                                  ? "hover:bg-slate-50"
                                  : "hover:bg-white/5",
                            )}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={cn(
                                  "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-transform group-active:scale-90",
                                  isSelected
                                    ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20"
                                    : isLight
                                      ? "bg-slate-100 text-slate-500"
                                      : "bg-white/5 text-slate-500",
                                )}
                              >
                                <Monitor className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <p
                                  className={cn(
                                    "text-xs font-bold truncate leading-none mb-1",
                                    isLight ? "text-slate-900" : "text-white",
                                  )}
                                >
                                  {eq.name}
                                </p>
                                <div className="flex items-center gap-2 overflow-hidden">
                                  <span className="text-[9px] font-black uppercase text-slate-500 truncate">
                                    {eq.workstation_name || "Склад"}
                                  </span>
                                  <span className="text-slate-700">•</span>
                                  <span className="text-[9px] font-bold text-blue-500 uppercase truncate">
                                    {eq.type_name}
                                  </span>
                                </div>
                              </div>
                            </div>
                            {isSelected && (
                              <Check className="h-4 w-4 text-blue-500 stroke-3" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {selectedEquipmentObjects.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1 max-h-32 overflow-y-auto pr-1">
                    {selectedEquipmentObjects.map((eq) => (
                      <Badge
                        key={eq.id}
                        variant="secondary"
                        className={cn(
                          "gap-1 pl-2 pr-1 py-1 rounded-lg text-[10px] font-black uppercase tracking-tight",
                          isLight
                            ? "bg-blue-50 text-blue-600 hover:bg-blue-100"
                            : "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30",
                        )}
                      >
                        {eq.name}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleEquipment(eq.id);
                          }}
                          className="p-0.5 hover:bg-black/10 rounded-md"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action Bar (Fixed on Mobile, Standard Footer on Desktop) */}
        <div
          className={cn(
            "shrink-0 p-4 md:p-6 border-t z-50",
            isLight
              ? "bg-slate-50 border-slate-200"
              : "bg-[#11131a] border-white/5",
            "fixed md:relative bottom-0 left-0 right-0",
          )}
        >
          <div className="flex gap-3 max-w-4xl mx-auto">
            <Button
              type="button"
              variant="ghost"
              className={cn(
                "rounded-xl font-black uppercase text-[11px] h-12 flex-1 md:flex-initial md:px-8",
                isLight
                  ? "text-slate-400 hover:text-slate-900 hover:bg-slate-200"
                  : "text-slate-400 hover:text-white hover:bg-white/5",
              )}
              onClick={() => onOpenChange(false)}
            >
              Отмена
            </Button>
            <Button
              type="button"
              disabled={
                isLoading ||
                (formData.taskType === "GENERAL" && !formData.title) ||
                (formData.taskType === "PERFORMANCE_CHECK" &&
                  formData.equipment_ids.length === 0)
              }
              className="flex-2 md:flex-initial md:px-12 rounded-xl font-black uppercase text-[11px] tracking-[0.15em] h-12 bg-blue-600 hover:bg-blue-700 text-white border-none shadow-lg shadow-blue-600/20"
              onClick={() => handleSubmit()}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Создать поручение"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
