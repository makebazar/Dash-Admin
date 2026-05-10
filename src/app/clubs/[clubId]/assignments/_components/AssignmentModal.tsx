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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Clock,
  User,
  MessageSquare,
  Send,
  Loader2,
  Calendar,
  AlertCircle,
  CheckCircle2,
  PlayCircle,
  XCircle,
  ChevronLeft,
  ExternalLink,
  Camera,
  Info,
  Monitor,
  MapPin,
  Search,
  Check,
  Plus,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { ImageViewer } from "@/components/ui/image-viewer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Comment {
  id: string;
  content: string;
  user_id: string;
  user_name: string;
  is_system_message: boolean;
  photos?: string[];
  created_at: string;
}

interface Equipment {
  id: string;
  name: string;
  identifier: string;
  type_name: string;
  workstation_id: string;
  workstation_name: string;
  workstation_zone: string;
}

interface Workstation {
  id: string;
  name: string;
  zone: string;
}

interface AssignmentModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  task: any;
  clubId: string;
  onUpdate: () => void;
  isLight?: boolean;
}

export function AssignmentModal({
  isOpen,
  onOpenChange,
  task,
  clubId,
  onUpdate,
  isLight = false,
}: AssignmentModalProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [reportText, setReportText] = useState("");
  const [showReportForm, setShowReportForm] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingPhotos, setPendingPhotos] = useState<string[]>([]);
  const [isManager, setIsManager] = useState(false);

  // Equipment management state
  const [showEquipmentSelector, setShowEquipmentSelector] = useState(false);
  const [allEquipment, setAllEquipment] = useState<Equipment[]>([]);
  const [workstations, setWorkstations] = useState<Workstation[]>([]);
  const [selectedZone, setSelectedZone] = useState<string>("all");
  const [selectedWorkstationId, setSelectedWorkstationId] =
    useState<string>("all");
  const [equipmentSearch, setEquipmentSearch] = useState("");
  const [isEquipmentLoading, setIsEquipmentLoading] = useState(false);
  const [currentTask, setCurrentTask] = useState<any>(null);

  // Mobile tabs state
  const [activeTab, setActiveTab] = useState<"info" | "chat">("info");

  // Image viewer state
  const [viewerImage, setViewerImage] = useState<string | null>(null);
  const [viewerGroup, setViewerGroup] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen && task) {
      fetchTaskDetails();
      fetchComments();
      fetchPermissions();
      setReportText(task.report_text || "");
      setShowReportForm(false);
      setPendingPhotos([]);
      setActiveTab("info");
      setShowEquipmentSelector(false);
      setSelectedZone("all");
      setSelectedWorkstationId("all");
    }
  }, [isOpen, task]);

  const fetchTaskDetails = async () => {
    try {
      const res = await fetch(`/api/clubs/${clubId}/employee-tasks/${task.id}`);
      const data = await res.json();
      if (res.ok) {
        setCurrentTask(data.task);
      }
    } catch (error) {
      console.error("Error fetching task details:", error);
    }
  };

  const fetchPermissions = async () => {
    try {
      const res = await fetch(`/api/clubs/${clubId}/my-permissions`);
      const data = await res.json();
      if (res.ok) {
        setIsManager(
          data.isFullAccess ||
            data.user_role === "Владелец" ||
            data.user_role === "Управляющий" ||
            data.user_role === "Администратор системы",
        );
      }
    } catch (error) {
      console.error("Error fetching permissions:", error);
    }
  };

  const fetchComments = async () => {
    try {
      const res = await fetch(
        `/api/clubs/${clubId}/employee-tasks/${task.id}/comments`,
      );
      const data = await res.json();
      if (res.ok) {
        setComments(data.comments || []);
      }
    } catch (error) {
      console.error("Error fetching comments:", error);
    }
  };

  const fetchEquipmentData = async () => {
    try {
      setIsEquipmentLoading(true);
      const [eqRes, wsRes] = await Promise.all([
        fetch(`/api/clubs/${clubId}/equipment?limit=1000`),
        fetch(`/api/clubs/${clubId}/workstations`),
      ]);
      const [eqData, wsData] = await Promise.all([eqRes.json(), wsRes.json()]);
      if (eqRes.ok) setAllEquipment(eqData.equipment || []);
      if (wsRes.ok) setWorkstations(wsData || []);
    } catch (error) {
      console.error("Error fetching equipment data:", error);
    } finally {
      setIsEquipmentLoading(false);
    }
  };

  useEffect(() => {
    if (showEquipmentSelector && allEquipment.length === 0) {
      fetchEquipmentData();
    }
  }, [showEquipmentSelector]);

  const zones = useMemo(() => {
    const z = new Set(workstations.map((ws) => ws.zone));
    return Array.from(z).sort();
  }, [workstations]);

  const filteredWorkstations = useMemo(() => {
    if (selectedZone === "all") return workstations;
    return workstations.filter((ws) => ws.zone === selectedZone);
  }, [workstations, selectedZone]);

  const filteredAllEquipment = useMemo(() => {
    return allEquipment.filter((e) => {
      const matchesSearch =
        e.name.toLowerCase().includes(equipmentSearch.toLowerCase()) ||
        e.identifier?.toLowerCase().includes(equipmentSearch.toLowerCase());
      const matchesZone =
        selectedZone === "all" || e.workstation_zone === selectedZone;
      const matchesWS =
        selectedWorkstationId === "all" ||
        e.workstation_id === selectedWorkstationId;
      return matchesSearch && matchesZone && matchesWS;
    });
  }, [allEquipment, equipmentSearch, selectedZone, selectedWorkstationId]);

  const handleUpdateEquipment = async (equipmentIds: string[]) => {
    try {
      const res = await fetch(
        `/api/clubs/${clubId}/employee-tasks/${task.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            equipment_ids: equipmentIds,
          }),
        },
      );
      if (res.ok) {
        fetchTaskDetails();
        onUpdate();
      }
    } catch (error) {
      console.error("Error updating equipment:", error);
    }
  };

  const toggleEquipmentSelection = (eId: string) => {
    const currentIds = currentTask?.equipment?.map((e: any) => e.id) || [];
    const newIds = currentIds.includes(eId)
      ? currentIds.filter((id: string) => id !== eId)
      : [...currentIds, eId];
    handleUpdateEquipment(newIds);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    try {
      setIsUploading(true);
      const uploadedUrls: string[] = [];

      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (res.ok && data.url) {
          uploadedUrls.push(data.url);
        }
      }

      setPendingPhotos((prev) => [...prev, ...uploadedUrls]);
    } catch (error) {
      console.error("Error uploading photos:", error);
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newComment.trim() && pendingPhotos.length === 0) || isSending) return;

    try {
      setIsSending(true);
      const res = await fetch(
        `/api/clubs/${clubId}/employee-tasks/${task.id}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: newComment,
            photos: pendingPhotos,
          }),
        },
      );
      if (res.ok) {
        setNewComment("");
        setPendingPhotos([]);
        fetchComments();
      }
    } catch (error) {
      console.error("Error sending comment:", error);
    } finally {
      setIsSending(false);
    }
  };

  const updateStatus = async (status: string, report?: string) => {
    try {
      setIsUpdatingStatus(true);
      const res = await fetch(
        `/api/clubs/${clubId}/employee-tasks/${task.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            report_text: report,
          }),
        },
      );
      if (res.ok) {
        onUpdate();
        if (status !== "REVIEW") {
          onOpenChange(false);
        } else {
          setShowReportForm(false);
          fetchComments();
        }
      }
    } catch (error) {
      console.error("Error updating status:", error);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const deleteTask = async () => {
    if (
      !window.confirm("Вы уверены, что хотите полностью удалить это поручение?")
    )
      return;

    try {
      setIsDeleting(true);
      const res = await fetch(
        `/api/clubs/${clubId}/employee-tasks/${task.id}`,
        {
          method: "DELETE",
        },
      );
      if (res.ok) {
        onUpdate();
        onOpenChange(false);
      }
    } catch (error) {
      console.error("Error deleting task:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!task) return null;

  const displayTask = currentTask || task;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            "max-w-4xl md:max-h-[90vh] w-full h-[100dvh] md:h-auto overflow-hidden flex flex-col p-0 shadow-2xl rounded-none md:rounded-lg",
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
            <div className="flex items-center justify-center md:justify-start min-h-[1.5rem]">
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
              <DialogTitle className="text-[10px] md:text-sm font-black uppercase tracking-[0.2em] text-slate-500">
                Детали поручения
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
              onClick={() => setActiveTab("chat")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                activeTab === "chat"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                  : isLight
                    ? "bg-slate-200/50 text-slate-500"
                    : "bg-white/5 text-slate-500",
              )}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Обсуждение
              {comments.length > 0 && (
                <span
                  className={cn(
                    "ml-1 px-1.5 rounded-full text-[8px]",
                    activeTab === "chat"
                      ? "bg-white/20 text-white"
                      : isLight
                        ? "bg-slate-300 text-slate-600"
                        : "bg-white/10 text-slate-400",
                  )}
                >
                  {comments.length}
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
            {/* Left Side: Details & Report */}
            <div
              className={cn(
                "flex-1 overflow-y-auto p-5 md:p-8 space-y-6 md:space-y-8 border-b md:border-b-0 md:border-r pb-32 md:pb-8",
                isLight ? "border-slate-200" : "border-white/5",
                activeTab !== "info" && "hidden md:block",
              )}
            >
              {/* Full Title Section */}
              <section className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      "uppercase text-[10px] font-black px-2",
                      displayTask.priority === "CRITICAL"
                        ? "text-rose-500 bg-rose-500/10 border-rose-500/20"
                        : displayTask.priority === "HIGH"
                          ? "text-orange-500 bg-orange-500/10 border-orange-500/20"
                          : "text-blue-500 bg-blue-500/10 border-blue-500/20",
                    )}
                  >
                    {displayTask.priority === "CRITICAL"
                      ? "КРИТИЧЕСКИЙ"
                      : displayTask.priority === "HIGH"
                        ? "ВЫСОКИЙ"
                        : displayTask.priority === "MEDIUM"
                          ? "СРЕДНИЙ"
                          : "НИЗКИЙ"}
                  </Badge>
                  <div
                    className={cn(
                      "flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest",
                      isLight ? "text-slate-400" : "text-slate-600",
                    )}
                  >
                    <span>
                      {format(
                        new Date(displayTask.created_at),
                        "d MMM yyyy, HH:mm",
                        {
                          locale: ru,
                        },
                      )}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {displayTask.created_by_name}
                    </span>
                  </div>
                </div>
                <h1
                  className={cn(
                    "text-2xl md:text-3xl font-black uppercase tracking-tighter leading-none",
                    isLight ? "text-slate-900" : "text-white",
                  )}
                >
                  {displayTask.title}
                </h1>
              </section>

              {/* Equipment Section */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500">
                    Прикрепленное оборудование
                  </h4>
                  {isManager && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setShowEquipmentSelector(!showEquipmentSelector)
                      }
                      className={cn(
                        "h-7 px-2 rounded-lg text-[10px] font-black uppercase tracking-widest gap-1",
                        isLight
                          ? "text-slate-400 hover:text-blue-600"
                          : "text-slate-500 hover:text-blue-500",
                      )}
                    >
                      {showEquipmentSelector ? (
                        <X className="h-3 w-3" />
                      ) : (
                        <Plus className="h-3 w-3" />
                      )}
                      {showEquipmentSelector ? "Закрыть" : "Добавить"}
                    </Button>
                  )}
                </div>

                {showEquipmentSelector && (
                  <div
                    className={cn(
                      "rounded-2xl border p-4 space-y-4 transition-all",
                      isLight
                        ? "bg-slate-50 border-slate-200"
                        : "bg-[#11131a] border-white/5",
                    )}
                  >
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
                              "h-9 text-[10px] font-bold rounded-xl",
                              isLight
                                ? "bg-white border-slate-200"
                                : "bg-black/20 border-white/5",
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
                              "h-9 text-[10px] font-bold rounded-xl",
                              isLight
                                ? "bg-white border-slate-200"
                                : "bg-black/20 border-white/5",
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
                        placeholder="Поиск по названию..."
                        className={cn(
                          "pl-9 h-10 text-xs font-bold rounded-xl",
                          isLight
                            ? "bg-white border-slate-200"
                            : "bg-black/20 border-white/5",
                        )}
                        value={equipmentSearch}
                        onChange={(e) => setEquipmentSearch(e.target.value)}
                      />
                    </div>

                    <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1 pr-1">
                      {isEquipmentLoading ? (
                        <div className="py-8 flex justify-center">
                          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                        </div>
                      ) : filteredAllEquipment.length === 0 ? (
                        <div className="py-8 text-center text-[10px] font-black uppercase text-slate-500">
                          Ничего не найдено
                        </div>
                      ) : (
                        filteredAllEquipment.map((eq) => {
                          const isSelected = displayTask.equipment?.some(
                            (e: any) => e.id === eq.id,
                          );
                          return (
                            <div
                              key={eq.id}
                              onClick={() => toggleEquipmentSelection(eq.id)}
                              className={cn(
                                "flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all",
                                isSelected
                                  ? isLight
                                    ? "bg-blue-50"
                                    : "bg-blue-500/10"
                                  : isLight
                                    ? "hover:bg-white"
                                    : "hover:bg-white/5",
                              )}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div
                                  className={cn(
                                    "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                                    isSelected
                                      ? "bg-blue-500 text-white"
                                      : isLight
                                        ? "bg-slate-200 text-slate-500"
                                        : "bg-white/5 text-slate-500",
                                  )}
                                >
                                  <Monitor className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                  <p
                                    className={cn(
                                      "text-xs font-bold truncate",
                                      isLight ? "text-slate-900" : "text-white",
                                    )}
                                  >
                                    {eq.name}
                                  </p>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-black uppercase text-slate-500">
                                      {eq.workstation_name || "Склад"}
                                    </span>
                                    <span className="text-slate-700">•</span>
                                    <span className="text-[9px] font-bold text-blue-500 uppercase">
                                      {eq.type_name}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              {isSelected && (
                                <Check className="h-4 w-4 text-blue-500" />
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {!displayTask.equipment ||
                displayTask.equipment.length === 0 ? (
                  <div
                    className={cn(
                      "border border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center",
                      isLight
                        ? "border-slate-200 bg-slate-50/50"
                        : "border-white/5 bg-white/[0.02]",
                    )}
                  >
                    <Monitor className="h-6 w-6 text-slate-500 mb-2 opacity-20" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 opacity-50">
                      Оборудование не прикреплено
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {displayTask.equipment.map((eq: any) => (
                      <div
                        key={eq.id}
                        className={cn(
                          "flex items-start gap-4 border rounded-2xl p-4 transition-all hover:border-blue-500/30 group",
                          isLight
                            ? "bg-slate-50 border-slate-200"
                            : "bg-[#11131a] border-white/5",
                        )}
                      >
                        <div className="h-9 w-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                          <Monitor className="h-4.5 w-4.5 text-blue-500" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "text-[13px] font-bold truncate",
                                isLight ? "text-slate-900" : "text-white",
                              )}
                            >
                              {eq.name}
                            </span>
                            {isManager && (
                              <button
                                onClick={() => toggleEquipmentSelection(eq.id)}
                                className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-rose-500/10 hover:text-rose-500 transition-all ml-auto"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                            <span className="text-[9px] font-black uppercase text-slate-500 tracking-tight">
                              {eq.type_name}
                            </span>
                            {eq.identifier && (
                              <span className="text-[9px] font-black uppercase text-slate-600 tracking-tight">
                                ID: {eq.identifier}
                              </span>
                            )}
                          </div>
                          {(eq.workstation_zone || eq.workstation_name) && (
                            <div className="flex items-center gap-1 text-[10px] font-bold text-blue-400 uppercase mt-2">
                              <MapPin className="h-3 w-3 shrink-0" />
                              <span className="truncate">
                                {eq.workstation_zone || "Зона"} •{" "}
                                {eq.workstation_name || "Место"}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="space-y-3">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                  Описание задачи
                </h4>
                <div
                  className={cn(
                    "border rounded-2xl p-6 text-sm leading-relaxed whitespace-pre-wrap font-medium",
                    isLight
                      ? "bg-slate-50 border-slate-200 text-slate-600"
                      : "bg-[#11131a] border-white/5 text-slate-300",
                  )}
                >
                  {displayTask.description || "Описание отсутствует"}
                </div>
              </section>

              {displayTask.report_text && !showReportForm && (
                <section className="space-y-3">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">
                    Отчет о выполнении
                  </h4>
                  <div className="text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-6 text-sm leading-relaxed whitespace-pre-wrap font-bold italic">
                    {displayTask.report_text}
                  </div>
                </section>
              )}

              {/* Status Section for Desktop and Mobile (when not fixed) */}
              <div className="hidden md:block">
                {showReportForm ? (
                  <section className="space-y-4 p-6 border border-blue-500/20 bg-blue-500/5 rounded-2xl">
                    <h4 className="text-xs font-black uppercase tracking-[0.2em] text-blue-400 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Сдать отчет
                    </h4>
                    <Textarea
                      placeholder="Опишите, что было сделано..."
                      className={cn(
                        "min-h-[140px] rounded-xl focus:ring-blue-500/20 placeholder:text-slate-600",
                        isLight
                          ? "bg-white border-slate-200 text-slate-900"
                          : "bg-[#0a0b10] border-white/10 text-white",
                      )}
                      value={reportText}
                      onChange={(e) => setReportText(e.target.value)}
                    />
                    <div className="flex gap-3">
                      <Button
                        className="flex-1 rounded-xl font-black uppercase text-[11px] tracking-[0.15em] h-12 bg-blue-600 hover:bg-blue-50 text-white border-none shadow-lg shadow-blue-600/20"
                        onClick={() => updateStatus("REVIEW", reportText)}
                        disabled={isUpdatingStatus || !reportText.trim()}
                      >
                        Отправить на проверку
                      </Button>
                      <Button
                        variant="ghost"
                        className={cn(
                          "rounded-xl font-black uppercase text-[11px] h-12",
                          isLight
                            ? "text-slate-400 hover:text-slate-900"
                            : "text-slate-400 hover:text-white",
                        )}
                        onClick={() => setShowReportForm(false)}
                      >
                        Отмена
                      </Button>
                    </div>
                  </section>
                ) : (
                  <section className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                      Управление поручением
                    </h4>
                    <div className="flex flex-wrap gap-3">
                      {displayTask.status === "OPEN" && (
                        <Button
                          className="gap-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black uppercase text-[11px] tracking-[0.15em] h-12 px-8 shadow-lg shadow-blue-600/20"
                          onClick={() => updateStatus("IN_PROGRESS")}
                        >
                          <PlayCircle className="h-4 w-4" />
                          Взять в работу
                        </Button>
                      )}
                      {displayTask.status === "IN_PROGRESS" && (
                        <Button
                          className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black uppercase text-[11px] tracking-[0.15em] h-12 px-8 shadow-lg shadow-emerald-600/20"
                          onClick={() => setShowReportForm(true)}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Сдать отчет
                        </Button>
                      )}
                      {displayTask.status === "REVIEW" && (
                        <>
                          {isManager && (
                            <Button
                              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black uppercase text-[11px] tracking-[0.15em] h-12 px-8 shadow-lg shadow-emerald-600/20"
                              onClick={() => updateStatus("DONE")}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              Принять работу
                            </Button>
                          )}
                          {isManager && (
                            <Button
                              variant="outline"
                              className="gap-2 text-orange-500 border-orange-500/20 bg-orange-500/5 hover:bg-orange-500/10 rounded-xl font-black uppercase text-[11px] tracking-[0.15em] h-12 px-8"
                              onClick={() => updateStatus("IN_PROGRESS")}
                            >
                              <Clock className="h-4 w-4" />
                              На доработку
                            </Button>
                          )}
                        </>
                      )}
                      {isManager && (
                        <Button
                          variant="ghost"
                          className="text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 gap-2 rounded-xl font-black uppercase text-[11px] h-12 px-6 ml-auto"
                          onClick={deleteTask}
                          disabled={isDeleting}
                        >
                          <Trash2 className="h-4 w-4" />
                          {isDeleting ? "Удаление..." : "Удалить"}
                        </Button>
                      )}
                    </div>
                  </section>
                )}
              </div>
            </div>

            {/* Mobile Fixed Status Bar */}
            {activeTab === "info" && (
              <div
                className={cn(
                  "md:hidden fixed bottom-0 left-0 right-0 border-t p-4 z-50",
                  isLight
                    ? "bg-slate-50 border-slate-200"
                    : "bg-[#11131a] border-white/5",
                )}
              >
                {showReportForm ? (
                  <div className="space-y-4">
                    <Textarea
                      placeholder="Опишите, что было сделано..."
                      className={cn(
                        "min-h-[100px] rounded-xl focus:ring-blue-500/20 placeholder:text-slate-600",
                        isLight
                          ? "bg-white border-slate-200 text-slate-900"
                          : "bg-[#0a0b10] border-white/10 text-white",
                      )}
                      value={reportText}
                      onChange={(e) => setReportText(e.target.value)}
                    />
                    <div className="flex gap-3">
                      <Button
                        className="flex-1 rounded-xl font-black uppercase text-[11px] tracking-[0.15em] h-12 bg-blue-600 hover:bg-blue-50 text-white border-none shadow-lg shadow-blue-600/20"
                        onClick={() => updateStatus("REVIEW", reportText)}
                        disabled={isUpdatingStatus || !reportText.trim()}
                      >
                        Отправить на проверку
                      </Button>
                      <Button
                        variant="ghost"
                        className={cn(
                          "rounded-xl font-black uppercase text-[11px] h-12",
                          isLight ? "text-slate-500" : "text-slate-400",
                        )}
                        onClick={() => setShowReportForm(false)}
                      >
                        Отмена
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    {displayTask.status === "OPEN" && (
                      <Button
                        className="flex-1 gap-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black uppercase text-[11px] tracking-[0.15em] h-14 shadow-lg shadow-blue-600/20"
                        onClick={() => updateStatus("IN_PROGRESS")}
                      >
                        <PlayCircle className="h-5 w-5" />
                        Взять в работу
                      </Button>
                    )}
                    {displayTask.status === "IN_PROGRESS" && (
                      <Button
                        className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black uppercase text-[11px] tracking-[0.15em] h-14 shadow-lg shadow-emerald-600/20"
                        onClick={() => setShowReportForm(true)}
                      >
                        <CheckCircle2 className="h-5 w-5" />
                        Сдать отчет
                      </Button>
                    )}
                    {displayTask.status === "REVIEW" && (
                      <div className="flex flex-col gap-2 w-full">
                        {isManager && (
                          <Button
                            className="w-full gap-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black uppercase text-[11px] tracking-[0.15em] h-12 shadow-lg shadow-emerald-600/20"
                            onClick={() => updateStatus("DONE")}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Принять работу
                          </Button>
                        )}
                        {isManager && (
                          <Button
                            variant="outline"
                            className="w-full gap-2 text-orange-500 border-orange-500/20 bg-orange-500/5 h-10 rounded-xl font-black uppercase text-[10px] tracking-[0.15em]"
                            onClick={() => updateStatus("IN_PROGRESS")}
                          >
                            <Clock className="h-4 w-4" />
                            На доработку
                          </Button>
                        )}
                      </div>
                    )}
                    {isManager && (
                      <Button
                        variant="ghost"
                        className="h-14 px-4 text-rose-500"
                        onClick={deleteTask}
                        disabled={isDeleting}
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Right Side: Chat */}
            <div
              className={cn(
                "w-full md:w-96 flex flex-col",
                isLight ? "bg-slate-50/50" : "bg-[#0d0e15]",
                activeTab !== "chat" && "hidden md:flex",
              )}
            >
              <div
                className={cn(
                  "p-5 border-b hidden md:flex items-center justify-between shrink-0",
                  isLight
                    ? "bg-slate-100 border-slate-200"
                    : "bg-[#11131a] border-white/5",
                )}
              >
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 text-slate-400">
                  <MessageSquare className="h-4 w-4 opacity-50" />
                  Обсуждение
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
                  {comments.length}
                </Badge>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6 min-h-[350px] pb-32 md:pb-6">
                {comments.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-600 text-center p-4">
                    <MessageSquare className="h-10 w-10 mb-4 opacity-5" />
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-30">
                      Сообщений нет
                    </p>
                  </div>
                ) : (
                  comments.map((comment) => (
                    <div
                      key={comment.id}
                      className={cn(
                        "flex flex-col gap-2",
                        comment.is_system_message
                          ? "items-center"
                          : "items-start",
                      )}
                    >
                      {comment.is_system_message ? (
                        <div
                          className={cn(
                            "px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest border",
                            isLight
                              ? "bg-slate-100 text-slate-400 border-slate-200"
                              : "bg-white/5 text-slate-500 border-white/5",
                          )}
                        >
                          {comment.content}
                        </div>
                      ) : (
                        <div
                          className={cn(
                            "max-w-[100%] border rounded-2xl p-4 shadow-sm",
                            isLight
                              ? "bg-white border-slate-200"
                              : "bg-[#161922] border-white/5",
                          )}
                        >
                          <div className="flex items-center justify-between gap-6 mb-2">
                            <span
                              className={cn(
                                "text-[10px] font-black uppercase tracking-tight",
                                isLight ? "text-slate-900" : "text-white/90",
                              )}
                            >
                              {comment.user_name}
                            </span>
                            <span className="text-[9px] font-bold text-slate-600">
                              {format(new Date(comment.created_at), "HH:mm")}
                            </span>
                          </div>
                          <p
                            className={cn(
                              "text-xs font-medium whitespace-pre-wrap leading-relaxed",
                              isLight ? "text-slate-600" : "text-slate-400",
                            )}
                          >
                            {comment.content}
                          </p>

                          {comment.photos && comment.photos.length > 0 && (
                            <div className="mt-3 grid grid-cols-2 gap-2">
                              {comment.photos.map((photo, i) => (
                                <div
                                  key={i}
                                  onClick={() => {
                                    setViewerImage(photo);
                                    setViewerGroup(comment.photos || []);
                                  }}
                                  className={cn(
                                    "relative aspect-square rounded-xl overflow-hidden border bg-black/20 cursor-pointer hover:opacity-80 transition-opacity",
                                    isLight
                                      ? "border-slate-200"
                                      : "border-white/5",
                                  )}
                                >
                                  <img
                                    src={photo}
                                    alt=""
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div
                className={cn(
                  "p-6 border-t space-y-4 shrink-0 fixed md:relative bottom-0 left-0 right-0 z-50 md:z-auto",
                  isLight
                    ? "bg-slate-100 border-slate-200"
                    : "bg-[#11131a] border-white/5",
                )}
              >
                {pendingPhotos.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {pendingPhotos.map((photo, i) => (
                      <div
                        key={i}
                        className={cn(
                          "relative w-12 h-12 rounded-lg overflow-hidden border group",
                          isLight ? "border-slate-300" : "border-white/10",
                        )}
                      >
                        <img
                          src={photo}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={() =>
                            setPendingPhotos((prev) =>
                              prev.filter((_, idx) => idx !== i),
                            )
                          }
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                        >
                          <XCircle className="h-4 w-4 text-white" />
                        </button>
                      </div>
                    ))}
                    {isUploading && (
                      <div
                        className={cn(
                          "w-12 h-12 rounded-lg flex items-center justify-center",
                          isLight ? "bg-slate-200" : "bg-white/5",
                        )}
                      >
                        <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                      </div>
                    )}
                  </div>
                )}

                <form onSubmit={handleSendComment} className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      placeholder="Написать сообщение..."
                      className={cn(
                        "pr-12 transition-all rounded-xl h-12 text-sm font-medium placeholder:text-slate-600",
                        isLight
                          ? "bg-white border-slate-200 focus:border-blue-500/50 focus:bg-white text-slate-900"
                          : "bg-[#0a0b10] border-white/10 focus:border-blue-500/50 focus:bg-[#0a0b10] text-white",
                      )}
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      <input
                        type="file"
                        id="comment-photo-mobile"
                        multiple
                        accept="image/*"
                        className="hidden"
                        onChange={handlePhotoUpload}
                      />
                      <label
                        htmlFor="comment-photo-mobile"
                        className="p-1.5 text-slate-500 hover:text-white transition-colors cursor-pointer"
                      >
                        <Camera className="h-5 w-5" />
                      </label>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    size="icon"
                    disabled={
                      (!newComment.trim() && pendingPhotos.length === 0) ||
                      isSending ||
                      isUploading
                    }
                    className="h-12 w-12 rounded-xl bg-blue-600 hover:bg-blue-50 text-white shadow-lg shadow-blue-600/20 shrink-0"
                  >
                    {isSending ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Send className="h-5 w-5" />
                    )}
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ImageViewer
        src={viewerImage || ""}
        isOpen={!!viewerImage}
        onClose={() => setViewerImage(null)}
        images={viewerGroup}
        onNext={() => {
          const idx = viewerGroup.indexOf(viewerImage || "");
          if (idx < viewerGroup.length - 1)
            setViewerImage(viewerGroup[idx + 1]);
        }}
        onPrev={() => {
          const idx = viewerGroup.indexOf(viewerImage || "");
          if (idx > 0) setViewerImage(viewerGroup[idx - 1]);
        }}
      />
    </>
  );
}
