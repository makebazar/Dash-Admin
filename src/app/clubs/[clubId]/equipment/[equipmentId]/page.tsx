"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRightLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircuitBoard,
  Cpu,
  Fan,
  HardDrive,
  Info,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Settings,
  Trash2,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  EQUIPMENT_STATUS_LABELS,
  type EquipmentStatus,
} from "@/lib/equipment-status";

type HistoryActionType = "MAINTENANCE" | "REWORK" | "MOVE" | "ISSUE";
type HistoryFilter = "all" | "maintenance" | "move" | "issue";
type EquipmentTab =
  | "details"
  | "maintenance"
  | "performance"
  | "history"
  | "components"
  | "files";

interface Equipment {
  id: string;
  name: string;
  type: string;
  type_name: string;
  type_icon: string;
  identifier: string | null;
  brand: string | null;
  model: string | null;
  workstation_id: string | null;
  workstation_name: string | null;
  workstation_zone: string | null;
  warranty_expires: string | null;
  last_cleaned_at: string | null;
  cleaning_interval_days?: number;
  is_active: boolean;
  notes: string | null;
  maintenance_enabled?: boolean;
  assigned_user_id?: string | null;
  open_issues_count?: number;
  status: EquipmentStatus;
  purchase_date?: string | null;
  purchase_price?: number | null;
  parent_equipment_id?: string | null;
  parent_equipment_name?: string | null;
  components?: Equipment[];
  photos?: string[];
}

interface EquipmentType {
  code: string;
  name_ru: string;
  icon: string;
}

interface Workstation {
  id: string;
  name: string;
  zone: string;
}

interface Employee {
  id: string;
  full_name: string;
  role?: string;
  is_active?: boolean;
  dismissed_at?: string | null;
}

interface HistoryLog {
  id: string;
  action_type: HistoryActionType;
  action: string;
  date: string;
  user_name: string | null;
  details: string | null;
  photos?: string[];
}

const COMPONENT_TYPES = [
  "CPU",
  "GPU",
  "RAM",
  "MOTHERBOARD",
  "PSU",
  "STORAGE",
  "COOLING",
];

export default function EquipmentDetailsPage() {
  const { clubId, equipmentId } = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const getInitialTab = (): EquipmentTab => {
    const tab = searchParams.get("tab");
    return tab === "maintenance" ||
      tab === "history" ||
      tab === "components" ||
      tab === "performance" ||
      tab === "files"
      ? tab
      : "details";
  };

  const [activeTab, setActiveTab] = useState<EquipmentTab>(getInitialTab());
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [types, setTypes] = useState<EquipmentType[]>([]);
  const [workstations, setWorkstations] = useState<Workstation[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [pcs, setPcs] = useState<Equipment[]>([]);
  const [history, setHistory] = useState<HistoryLog[]>([]);
  const [performanceLogs, setPerformanceLogs] = useState<any[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<any[]>([]);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [historyPhotoViewer, setHistoryPhotoViewer] = useState<{
    images: string[];
    index: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAddComponentDialogOpen, setIsAddComponentDialogOpen] =
    useState(false);
  const [availableComponents, setAvailableComponents] = useState<Equipment[]>(
    [],
  );
  const [isLinkingComponent, setIsLinkingComponent] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) throw new Error("Failed to upload photo");
      const { url } = await uploadRes.json();

      const newPhotos = [...(equipment?.photos || []), url];

      const updateRes = await fetch(
        `/api/clubs/${clubId}/equipment/${equipmentId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photos: newPhotos }),
        },
      );

      if (updateRes.ok) {
        setEquipment((prev) => (prev ? { ...prev, photos: newPhotos } : prev));
      } else {
        alert("Ошибка при сохранении фото");
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("Ошибка при загрузке фото");
    } finally {
      setIsUploadingPhoto(false);
      // Reset input
      e.target.value = "";
    }
  };

  const handleDeletePhoto = async (photoUrl: string) => {
    if (!confirm("Удалить это фото?")) return;

    const newPhotos = (equipment?.photos || []).filter((p) => p !== photoUrl);

    try {
      const updateRes = await fetch(
        `/api/clubs/${clubId}/equipment/${equipmentId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photos: newPhotos }),
        },
      );

      if (updateRes.ok) {
        setEquipment((prev) => (prev ? { ...prev, photos: newPhotos } : prev));
      } else {
        alert("Ошибка при удалении фото");
      }
    } catch (error) {
      console.error("Delete error:", error);
      alert("Ошибка при удалении фото");
    }
  };

  const [isAddPerformanceLogOpen, setIsAddPerformanceLogOpen] = useState(false);
  const [manualPerformanceData, setManualPerformanceData] = useState<
    Record<string, string>
  >({});
  const [manualPerformanceNotes, setManualPerformanceNotes] = useState("");
  const [isSubmittingPerformance, setIsSubmittingPerformance] = useState(false);

  useEffect(() => {
    setActiveTab(getInitialTab());
  }, [searchParams]);

  const maintenanceResponsibleEmployees = useMemo(
    () =>
      employees.filter(
        (emp) =>
          (emp.role === "Админ" ||
            emp.role === "Управляющий" ||
            emp.role === "Manager") &&
          emp.is_active !== false &&
          !emp.dismissed_at,
      ),
    [employees],
  );

  const filteredHistory = useMemo(() => {
    if (historyFilter === "all") return history;
    return history.filter((log) => {
      if (historyFilter === "maintenance") {
        return (
          log.action_type === "MAINTENANCE" || log.action_type === "REWORK"
        );
      }
      if (historyFilter === "move") {
        return log.action_type === "MOVE";
      }
      return log.action_type === "ISSUE";
    });
  }, [history, historyFilter]);

  const groupedHistory = useMemo(() => {
    return filteredHistory.reduce<
      Array<{ label: string; items: HistoryLog[] }>
    >((groups, log) => {
      const itemDate = new Date(log.date);
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);

      const isSameDay = (a: Date, b: Date) =>
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();

      const label = isSameDay(itemDate, today)
        ? "Сегодня"
        : isSameDay(itemDate, yesterday)
          ? "Вчера"
          : itemDate.toLocaleDateString("ru-RU", {
              day: "numeric",
              month: "long",
              year:
                today.getFullYear() === itemDate.getFullYear()
                  ? undefined
                  : "numeric",
            });

      const existingGroup = groups.find((group) => group.label === label);
      if (existingGroup) {
        existingGroup.items.push(log);
      } else {
        groups.push({ label, items: [log] });
      }

      return groups;
    }, []);
  }, [filteredHistory]);

  const fetchAvailableComponents = async () => {
    try {
      const res = await fetch(
        `/api/clubs/${clubId}/equipment?status=STORAGE&limit=1000`,
        { cache: "no-store" },
      );
      const data = await res.json();
      if (res.ok) {
        const components = (data.equipment || []).filter(
          (e: Equipment) =>
            COMPONENT_TYPES.includes(e.type) && !e.parent_equipment_id,
        );
        setAvailableComponents(components);
      }
    } catch (error) {
      console.error("Error fetching available components:", error);
    }
  };

  const handleLinkComponent = async (componentIdToLink: string) => {
    setIsLinkingComponent(true);
    try {
      const res = await fetch(
        `/api/clubs/${clubId}/equipment/${componentIdToLink}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parent_equipment_id: equipmentId,
            status: "ACTIVE",
            workstation_id: equipment?.workstation_id,
          }),
        },
      );

      if (res.ok) {
        setIsAddComponentDialogOpen(false);
        fetchPageData();
      } else {
        const data = await res.json();
        alert(data.error || "Ошибка при привязке детали");
      }
    } catch (error) {
      console.error("Error linking component:", error);
      alert("Ошибка сервера");
    } finally {
      setIsLinkingComponent(false);
    }
  };

  const fetchPageData = async () => {
    setIsLoading(true);
    try {
      const [equipmentRes, typesRes, workstationsRes, employeesRes, pcsRes] =
        await Promise.all([
          fetch(`/api/clubs/${clubId}/equipment/${equipmentId}`, {
            cache: "no-store",
          }),
          fetch(`/api/equipment-types?clubId=${clubId}`, { cache: "no-store" }),
          fetch(`/api/clubs/${clubId}/workstations`, { cache: "no-store" }),
          fetch(`/api/clubs/${clubId}/employees`, { cache: "no-store" }),
          fetch(`/api/clubs/${clubId}/equipment?type=PC&limit=1000`, {
            cache: "no-store",
          }),
        ]);

      if (!equipmentRes.ok) {
        setEquipment(null);
        return;
      }

      const [
        equipmentData,
        typesData,
        workstationsData,
        employeesData,
        pcsData,
      ] = await Promise.all([
        equipmentRes.json(),
        typesRes.json(),
        workstationsRes.json(),
        employeesRes.json(),
        pcsRes.json(),
      ]);

      setEquipment(equipmentData);
      setTypes(Array.isArray(typesData) ? typesData : []);
      setWorkstations(Array.isArray(workstationsData) ? workstationsData : []);
      setEmployees(
        Array.isArray(employeesData?.employees) ? employeesData.employees : [],
      );
      setPcs(Array.isArray(pcsData.equipment) ? pcsData.equipment : []);
    } catch (error) {
      console.error("Error loading equipment page:", error);
      setEquipment(null);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchHistory = async () => {
    setIsHistoryLoading(true);
    try {
      const res = await fetch(
        `/api/clubs/${clubId}/equipment/${equipmentId}/history`,
        { cache: "no-store" },
      );
      const data = await res.json();
      if (res.ok) {
        setHistory(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching equipment history:", error);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const fetchPerformanceLogs = async () => {
    try {
      const [logsRes, metricsRes] = await Promise.all([
        fetch(`/api/clubs/${clubId}/equipment/${equipmentId}/performance`, {
          cache: "no-store",
        }),
        fetch(
          `/api/clubs/${clubId}/equipment/performance/metrics?type=${equipment?.type}`,
          { cache: "no-store" },
        ),
      ]);

      if (logsRes.ok && metricsRes.ok) {
        const logs = await logsRes.json();
        const metrics = await metricsRes.json();
        setPerformanceLogs(logs);
        setPerformanceMetrics(metrics);
      }
    } catch (error) {
      console.error("Error fetching performance logs:", error);
    }
  };

  const handleAddManualPerformanceLog = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingPerformance(true);
    try {
      const res = await fetch(
        `/api/clubs/${clubId}/equipment/${equipmentId}/performance`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            metrics_data: manualPerformanceData,
            notes: manualPerformanceNotes,
          }),
        },
      );
      if (res.ok) {
        setIsAddPerformanceLogOpen(false);
        setManualPerformanceData({});
        setManualPerformanceNotes("");
        fetchPerformanceLogs();
      } else {
        const error = await res.json();
        alert(error.error || "Ошибка при сохранении");
      }
    } catch (err) {
      console.error(err);
      alert("Ошибка сети");
    } finally {
      setIsSubmittingPerformance(false);
    }
  };

  useEffect(() => {
    fetchPageData();
  }, [clubId, equipmentId]);

  useEffect(() => {
    if (activeTab === "maintenance" && equipment?.parent_equipment_id) {
      setActiveTab("details");
    }
  }, [activeTab, equipment]);

  useEffect(() => {
    const query =
      activeTab === "details" ? pathname : `${pathname}?tab=${activeTab}`;
    router.replace(query, { scroll: false });
  }, [activeTab, pathname, router]);

  useEffect(() => {
    if (activeTab === "history" && equipment?.id) {
      fetchHistory();
    }
    if (activeTab === "performance" && equipment?.id) {
      fetchPerformanceLogs();
    }
  }, [activeTab, equipment?.id]);

  const getMaintenanceActionLabel = (action: string) => {
    switch (action) {
      case "CLEANING":
        return "Плановое обслуживание";
      case "REPAIR":
        return "Ремонт";
      case "INSPECTION":
        return "Проверка";
      case "REPLACEMENT":
        return "Замена";
      case "PERFORMANCE_CHECK":
        return "Проверка производительности";
      default:
        return action;
    }
  };

  const getHistoryPresentation = (log: HistoryLog) => {
    if (log.action_type === "MAINTENANCE") {
      return {
        icon: <Wrench className="h-4 w-4" />,
        badgeLabel: "Обслуживание",
        badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
        title: getMaintenanceActionLabel(log.action),
        description:
          log.details?.trim() ||
          "Задача обслуживания выполнена без дополнительного комментария.",
      };
    }

    if (log.action_type === "MOVE") {
      return {
        icon: <ArrowRightLeft className="h-4 w-4" />,
        badgeLabel: "Перемещение",
        badgeClassName: "border-blue-200 bg-blue-50 text-blue-700",
        title: "Перемещение оборудования",
        description:
          log.details?.trim() ||
          "Оборудование было перемещено без указанной причины.",
      };
    }

    if (log.action_type === "REWORK") {
      return {
        icon: <RefreshCw className="h-4 w-4" />,
        badgeLabel: "Доработка",
        badgeClassName: "border-amber-200 bg-amber-50 text-amber-700",
        title: `Отправлено на доработку: ${getMaintenanceActionLabel(log.action)}`,
        description:
          log.details?.trim() ||
          "Задача возвращена на доработку без указанного комментария.",
      };
    }

    return {
      icon: <AlertCircle className="h-4 w-4" />,
      badgeLabel: "Инцидент",
      badgeClassName: "border-rose-200 bg-rose-50 text-rose-700",
      title: log.action,
      description:
        log.details?.trim() || "Инцидент зафиксирован без подробного описания.",
    };
  };

  const formatHistoryTime = (date: string) =>
    new Date(date).toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    });

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!equipment?.name || !equipment?.type) return;

    setIsSaving(true);
    try {
      const res = await fetch(
        `/api/clubs/${clubId}/equipment/${equipment.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(equipment),
        },
      );

      if (res.ok) {
        const updated = await res.json();
        setEquipment((prev) => ({ ...prev, ...updated }));
        if (activeTab === "history") {
          fetchHistory();
        }
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert(`Ошибка сохранения: ${errorData.error || res.statusText}`);
      }
    } catch (error) {
      console.error("Error saving equipment:", error);
      alert("Ошибка при сохранении оборудования");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!equipment?.id) return;
    if (!confirm(`Удалить "${equipment.name}"? Это действие нельзя отменить.`))
      return;

    setIsDeleting(true);
    try {
      const res = await fetch(
        `/api/clubs/${clubId}/equipment/${equipment.id}`,
        { method: "DELETE" },
      );
      if (res.ok) {
        router.push(`/clubs/${clubId}/equipment/inventory`);
        router.refresh();
        return;
      }
      const data = await res.json().catch(() => null);
      alert(data?.error || "Не удалось удалить оборудование");
    } catch (error) {
      console.error("Error deleting equipment:", error);
      alert("Не удалось удалить оборудование");
    } finally {
      setIsDeleting(false);
    }
  };

  const openHistoryPhotoViewer = (images: string[], index: number) => {
    setHistoryPhotoViewer({ images, index });
  };

  const closeHistoryPhotoViewer = () => {
    setHistoryPhotoViewer(null);
  };

  const showNextHistoryPhoto = () => {
    setHistoryPhotoViewer((prev) => {
      if (!prev || prev.index >= prev.images.length - 1) return prev;
      return { ...prev, index: prev.index + 1 };
    });
  };

  const showPrevHistoryPhoto = () => {
    setHistoryPhotoViewer((prev) => {
      if (!prev || prev.index <= 0) return prev;
      return { ...prev, index: prev.index - 1 };
    });
  };

  if (isLoading) {
    return (
      <PageShell maxWidth="7xl">
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/70" />
        </div>
      </PageShell>
    );
  }

  if (!equipment) {
    return (
      <PageShell maxWidth="4xl">
        <PageHeader
          title="Карточка оборудования"
          description="Оборудование не найдено или недоступно."
        />
        <Card>
          <CardContent className="p-6">
            <Button asChild variant="outline">
              <Link href={`/clubs/${clubId}/equipment/inventory`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Вернуться в инвентарь
              </Link>
            </Button>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth="7xl">
      <div className="space-y-6">
        <PageHeader
          title={equipment.name || "Карточка оборудования"}
          description={equipment.type_name || equipment.type}
        >
          <div className="hidden md:flex items-center gap-2">
            <Button asChild variant="outline" className="h-10">
              <Link href={`/clubs/${clubId}/equipment/inventory`}>
                <ArrowLeft className="mr-2 h-4 w-4" />В инвентарь
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10"
              onClick={() => {
                router.push(
                  `/clubs/${clubId}/equipment/inventory?action=new&clone_from=${equipment.id}`,
                );
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Дублировать
            </Button>
            <Button
              form="equipment-page-form"
              type="submit"
              disabled={isSaving || isDeleting || activeTab === "history"}
              className="h-10"
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" />
              Сохранить
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isDeleting}
              className="h-10"
              onClick={handleDelete}
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Trash2 className="mr-2 h-4 w-4" />
              Удалить
            </Button>
          </div>
        </PageHeader>

        <Card className="overflow-hidden border-none shadow-sm">
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as EquipmentTab)}
            className="flex flex-col"
          >
            <div className="border-b bg-muted px-4 sm:px-6">
              <TabsList className="h-auto w-full justify-start gap-4 overflow-x-auto bg-transparent p-0">
                <TabsTrigger
                  value="details"
                  className="shrink-0 rounded-none border-b-2 border-transparent bg-transparent px-0 py-3 data-[state=active]:border-primary data-[state=active]:shadow-none"
                >
                  <span className="sm:hidden">Основное</span>
                  <span className="hidden sm:inline">Основные данные</span>
                </TabsTrigger>
                {!equipment.parent_equipment_id && (
                  <TabsTrigger
                    value="maintenance"
                    className="shrink-0 rounded-none border-b-2 border-transparent bg-transparent px-0 py-3 data-[state=active]:border-primary data-[state=active]:shadow-none"
                  >
                    <span className="sm:hidden">Сервис</span>
                    <span className="hidden sm:inline">Обслуживание</span>
                  </TabsTrigger>
                )}
                {equipment.type === "PC" && (
                  <TabsTrigger
                    value="performance"
                    className="shrink-0 rounded-none border-b-2 border-transparent bg-transparent px-0 py-3 data-[state=active]:border-primary data-[state=active]:shadow-none"
                  >
                    Производительность
                  </TabsTrigger>
                )}
                <TabsTrigger
                  value="history"
                  className="shrink-0 rounded-none border-b-2 border-transparent bg-transparent px-0 py-3 data-[state=active]:border-primary data-[state=active]:shadow-none"
                >
                  История
                </TabsTrigger>
                {(equipment.type === "PC" ||
                  (equipment.components &&
                    equipment.components.length > 0)) && (
                  <TabsTrigger
                    value="components"
                    className="shrink-0 rounded-none border-b-2 border-transparent bg-transparent px-0 py-3 data-[state=active]:border-primary data-[state=active]:shadow-none"
                  >
                    Комплектующие
                    {equipment.components &&
                      equipment.components.length > 0 && (
                        <Badge
                          variant="secondary"
                          className="ml-2 h-5 min-w-5 justify-center px-1 text-[10px]"
                        >
                          {equipment.components.length}
                        </Badge>
                      )}
                  </TabsTrigger>
                )}
                <TabsTrigger
                  value="files"
                  className="shrink-0 rounded-none border-b-2 border-transparent bg-transparent px-0 py-3 data-[state=active]:border-primary data-[state=active]:shadow-none"
                >
                  Файлы
                  {equipment.photos && equipment.photos.length > 0 && (
                    <Badge
                      variant="secondary"
                      className="ml-2 h-5 min-w-5 justify-center px-1 text-[10px]"
                    >
                      {equipment.photos.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="bg-card">
              <form
                id="equipment-page-form"
                onSubmit={handleSave}
                className="p-4 sm:p-6"
              >
                <TabsContent value="details" className="mt-0 space-y-6">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="md:col-span-2 space-y-2">
                      <Label>
                        Название <span className="text-rose-500">*</span>
                      </Label>
                      <Input
                        placeholder="Название модели"
                        value={equipment.name || ""}
                        onChange={(e) =>
                          setEquipment((prev) =>
                            prev ? { ...prev, name: e.target.value } : prev,
                          )
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Тип</Label>
                      <Select
                        value={equipment.type}
                        onValueChange={(val) =>
                          setEquipment((prev) =>
                            prev ? { ...prev, type: val } : prev,
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите тип" />
                        </SelectTrigger>
                        <SelectContent>
                          {types.map((t) => (
                            <SelectItem key={t.code} value={t.code}>
                              {t.name_ru}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Серийный номер / ID</Label>
                      <Input
                        placeholder="SN12345678"
                        value={equipment.identifier || ""}
                        onChange={(e) =>
                          setEquipment((prev) =>
                            prev
                              ? { ...prev, identifier: e.target.value }
                              : prev,
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Бренд</Label>
                      <Input
                        placeholder="Напр: ASUS, Logitech"
                        value={equipment.brand || ""}
                        onChange={(e) =>
                          setEquipment((prev) =>
                            prev ? { ...prev, brand: e.target.value } : prev,
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Модель</Label>
                      <Input
                        placeholder="Напр: G502 Hero"
                        value={equipment.model || ""}
                        onChange={(e) =>
                          setEquipment((prev) =>
                            prev ? { ...prev, model: e.target.value } : prev,
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Локация (Рабочее место)</Label>
                      <Select
                        value={equipment.workstation_id || "unassigned"}
                        onValueChange={(val) =>
                          setEquipment((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  workstation_id:
                                    val === "unassigned" ? null : val,
                                }
                              : prev,
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Склад" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">
                            Склад (Не назначено)
                          </SelectItem>
                          {workstations.map((w) => (
                            <SelectItem key={w.id} value={w.id}>
                              {w.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Статус оборудования</Label>
                      <Select
                        value={equipment.status}
                        onValueChange={(val: EquipmentStatus) =>
                          setEquipment((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  status: val,
                                  is_active: val !== "WRITTEN_OFF",
                                }
                              : prev,
                          )
                        }
                      >
                        <SelectTrigger className="bg-muted">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ACTIVE">
                            {EQUIPMENT_STATUS_LABELS.ACTIVE}
                          </SelectItem>
                          <SelectItem value="STORAGE">
                            {EQUIPMENT_STATUS_LABELS.STORAGE}
                          </SelectItem>
                          <SelectItem value="REPAIR">
                            {EQUIPMENT_STATUS_LABELS.REPAIR}
                          </SelectItem>
                          <SelectItem value="WRITTEN_OFF">
                            {EQUIPMENT_STATUS_LABELS.WRITTEN_OFF}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {equipment.type !== "PC" && (
                      <div className="space-y-2">
                        <Label>Родительский ПК (Системный блок)</Label>
                        <Select
                          value={equipment.parent_equipment_id || "none"}
                          onValueChange={(val) =>
                            setEquipment((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    parent_equipment_id:
                                      val === "none" ? null : val,
                                  }
                                : prev,
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Не привязано" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Не привязано</SelectItem>
                            {pcs
                              .filter((p) => p.id !== equipment.id)
                              .map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Дата покупки</Label>
                      <Input
                        type="date"
                        value={equipment.purchase_date || ""}
                        onChange={(e) =>
                          setEquipment((prev) =>
                            prev
                              ? { ...prev, purchase_date: e.target.value }
                              : prev,
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Срок гарантии до</Label>
                      <Input
                        type="date"
                        value={equipment.warranty_expires || ""}
                        onChange={(e) =>
                          setEquipment((prev) =>
                            prev
                              ? { ...prev, warranty_expires: e.target.value }
                              : prev,
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Цена (₽)</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={equipment.purchase_price || ""}
                        onChange={(e) =>
                          setEquipment((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  purchase_price: e.target.value
                                    ? Number(e.target.value)
                                    : null,
                                }
                              : prev,
                          )
                        }
                      />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <Label>Заметки / Примечания</Label>
                      <Textarea
                        placeholder="Любая дополнительная информация..."
                        className="resize-none"
                        value={equipment.notes || ""}
                        onChange={(e) =>
                          setEquipment((prev) =>
                            prev ? { ...prev, notes: e.target.value } : prev,
                          )
                        }
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="components" className="mt-0 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">
                        Комплектующие системного блока
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Список деталей, установленных в этот системный блок.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        setIsAddComponentDialogOpen(true);
                        fetchAvailableComponents();
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Добавить деталь
                    </Button>
                  </div>

                  {!equipment.components ||
                  equipment.components.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-muted py-12 text-center">
                      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-background shadow-sm">
                        <Layers className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <h4 className="font-medium text-foreground">
                        Нет комплектующих
                      </h4>
                      <p className="mt-1 max-w-70 text-sm text-muted-foreground">
                        Вы можете привязать процессоры, видеокарты и другие
                        детали к этому системному блоку.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {equipment.components.map((component) => (
                        <Card
                          key={component.id}
                          className="group overflow-hidden transition-all hover:border-primary/50 hover:shadow-md"
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted transition-colors group-hover:bg-primary/5">
                                {component.type === "CPU" && (
                                  <Cpu className="h-5 w-5 text-primary" />
                                )}
                                {component.type === "GPU" && (
                                  <CircuitBoard className="h-5 w-5 text-primary" />
                                )}
                                {component.type === "RAM" && (
                                  <Layers className="h-5 w-5 text-primary" />
                                )}
                                {component.type === "PSU" && (
                                  <Zap className="h-5 w-5 text-primary" />
                                )}
                                {component.type === "STORAGE" && (
                                  <HardDrive className="h-5 w-5 text-primary" />
                                )}
                                {component.type === "COOLING" && (
                                  <Fan className="h-5 w-5 text-primary" />
                                )}
                                {![
                                  "CPU",
                                  "GPU",
                                  "RAM",
                                  "PSU",
                                  "STORAGE",
                                  "COOLING",
                                ].includes(component.type) && (
                                  <Settings className="h-5 w-5 text-primary" />
                                )}
                              </div>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] font-semibold",
                                  component.status === "ACTIVE" &&
                                    "border-emerald-200 bg-emerald-50 text-emerald-700",
                                  component.status === "REPAIR" &&
                                    "border-rose-200 bg-rose-50 text-rose-700",
                                  component.status === "STORAGE" &&
                                    "border-blue-200 bg-blue-50 text-blue-700",
                                  component.status === "WRITTEN_OFF" &&
                                    "border-slate-200 bg-slate-50 text-slate-700",
                                )}
                              >
                                {EQUIPMENT_STATUS_LABELS[component.status]}
                              </Badge>
                            </div>

                            <div className="mt-3">
                              <h5 className="line-clamp-1 font-semibold text-foreground group-hover:text-primary">
                                {component.name}
                              </h5>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {component.type_name}
                              </p>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                              {component.brand && (
                                <Badge
                                  variant="secondary"
                                  className="h-5 px-1.5 text-[10px]"
                                >
                                  {component.brand}
                                </Badge>
                              )}
                              {Number(component.open_issues_count) > 0 && (
                                <Badge
                                  variant="destructive"
                                  className="h-5 px-1.5 text-[10px]"
                                >
                                  <AlertCircle className="mr-1 h-3 w-3" />
                                  Инциденты: {component.open_issues_count}
                                </Badge>
                              )}
                            </div>

                            <div className="mt-4 flex gap-2 pt-2">
                              <Button
                                asChild
                                variant="outline"
                                size="sm"
                                className="h-8 w-full text-xs"
                              >
                                <Link
                                  href={`/clubs/${clubId}/equipment/${component.id}`}
                                >
                                  Детали
                                </Link>
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="maintenance" className="mt-0 space-y-6">
                  <div className="flex gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
                    <Info className="h-5 w-5 shrink-0 text-blue-500" />
                    <div className="text-sm text-blue-700">
                      <p className="font-semibold">Настройка обслуживания</p>
                      <ul className="mt-1 ml-4 list-disc space-y-1 opacity-80">
                        <li>
                          Если ответственный не назначен, задачи на чистку
                          создаваться не будут.
                        </li>
                        <li>
                          Назначьте конкретного сотрудника или выберите
                          свободный пул.
                        </li>
                      </ul>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between rounded-xl border p-4">
                      <div className="space-y-0.5">
                        <Label className="text-base font-bold">
                          Обслуживание
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Включает напоминания о необходимости чистки
                        </p>
                      </div>
                      <Switch
                        checked={equipment.maintenance_enabled}
                        onCheckedChange={(val) =>
                          setEquipment((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  maintenance_enabled: val,
                                  assigned_user_id: val
                                    ? prev.assigned_user_id
                                    : null,
                                }
                              : prev,
                          )
                        }
                      />
                    </div>

                    {equipment.maintenance_enabled && (
                      <div className="space-y-4 rounded-xl border border-border bg-muted p-4">
                        <div className="space-y-2">
                          <Label>Ответственный за обслуживание</Label>
                          <Select
                            value={
                              equipment.assigned_user_id
                                ? equipment.assigned_user_id
                                : equipment.maintenance_enabled
                                  ? "free_pool"
                                  : "none"
                            }
                            onValueChange={(val) => {
                              if (val === "free_pool") {
                                setEquipment((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        assigned_user_id: null,
                                        maintenance_enabled: true,
                                      }
                                    : prev,
                                );
                                return;
                              }
                              const userId = val === "none" ? null : val;
                              setEquipment((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      assigned_user_id: userId,
                                      maintenance_enabled: !!userId,
                                    }
                                  : prev,
                              );
                            }}
                          >
                            <SelectTrigger className="bg-card">
                              <SelectValue placeholder="Не назначено" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Не назначено</SelectItem>
                              <SelectItem value="free_pool">
                                🤝 Свободный пул
                              </SelectItem>
                              {maintenanceResponsibleEmployees.map((emp) => (
                                <SelectItem key={emp.id} value={emp.id}>
                                  {emp.full_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-[10px] italic text-muted-foreground">
                            При выборе сотрудника обслуживание включается
                            автоматически.
                          </p>
                        </div>

                        <div className="space-y-2 border-t border-border/50 pt-2">
                          <Label>Интервал обслуживания</Label>
                          <div className="rounded-xl border bg-card px-4 py-3">
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="text-sm font-medium text-foreground">
                                  {`${equipment.cleaning_interval_days ?? 30} дн.`}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  Интервал задаётся в стандартах обслуживания по
                                  типу оборудования.
                                </p>
                              </div>
                              <Link
                                href={`/clubs/${clubId}/equipment/settings`}
                                className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                              >
                                Открыть настройки
                              </Link>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {equipment.last_cleaned_at && (
                      <div className="flex items-center justify-between rounded-xl border bg-muted p-4">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span className="text-sm font-medium">
                            Последнее обслуживание
                          </span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {new Date(
                            equipment.last_cleaned_at,
                          ).toLocaleDateString("ru-RU")}
                        </span>
                      </div>
                    )}

                    <Separator className="my-6" />

                    <div className="space-y-4">
                      <div className="space-y-1">
                        <Label className="text-base font-bold">
                          Разовые поручения
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Назначить внеплановую проверку или обслуживание
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800"
                          onClick={async () => {
                            if (
                              !confirm(
                                "Создать задачу на проверку производительности?",
                              )
                            )
                              return;
                            try {
                              const res = await fetch(
                                `/api/clubs/${clubId}/equipment/maintenance`,
                                {
                                  method: "POST",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({
                                    equipment_ids: [equipment.id],
                                    task_type: "PERFORMANCE_CHECK",
                                    date_from: new Date()
                                      .toISOString()
                                      .split("T")[0],
                                    date_to: new Date()
                                      .toISOString()
                                      .split("T")[0],
                                  }),
                                },
                              );
                              if (res.ok) {
                                alert(
                                  "Задача создана и появится в списке сотрудника",
                                );
                              } else {
                                alert("Ошибка при создании задачи");
                              }
                            } catch (e) {
                              console.error(e);
                              alert("Ошибка сети");
                            }
                          }}
                        >
                          <Zap className="mr-2 h-4 w-4" />
                          Проверка производительности
                        </Button>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="performance" className="mt-0 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">
                        История замеров производительности
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Результаты проверок системного блока.
                      </p>
                    </div>
                    {performanceMetrics.length > 0 && (
                      <Button
                        size="sm"
                        onClick={() => setIsAddPerformanceLogOpen(true)}
                        type="button"
                        variant="outline"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Добавить замер
                      </Button>
                    )}
                  </div>

                  {performanceLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-muted py-12 text-center">
                      <Zap className="h-10 w-10 text-muted-foreground/30 mb-4" />
                      <p className="text-sm text-muted-foreground">
                        Замеров пока не проводилось
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead>
                          <tr className="border-b">
                            <th className="pb-3 font-semibold text-muted-foreground">
                              Дата
                            </th>
                            <th className="pb-3 font-semibold text-muted-foreground">
                              Сотрудник
                            </th>
                            {performanceMetrics.map((m) => (
                              <th
                                key={m.id}
                                className="pb-3 font-semibold text-muted-foreground text-center"
                              >
                                {m.name} {m.unit ? `(${m.unit})` : ""}
                              </th>
                            ))}
                            <th className="pb-3 font-semibold text-muted-foreground">
                              Заметки
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {performanceLogs.map((log) => (
                            <tr
                              key={log.id}
                              className="group hover:bg-muted/50 transition-colors"
                            >
                              <td className="py-4 whitespace-nowrap">
                                <div className="font-medium">
                                  {new Date(log.recorded_at).toLocaleDateString(
                                    "ru-RU",
                                  )}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  {new Date(log.recorded_at).toLocaleTimeString(
                                    "ru-RU",
                                    { hour: "2-digit", minute: "2-digit" },
                                  )}
                                </div>
                              </td>
                              <td className="py-4">
                                <div className="text-xs font-semibold">
                                  {log.recorder_name || "Система"}
                                </div>
                              </td>
                              {performanceMetrics.map((m) => (
                                <td key={m.id} className="py-4 text-center">
                                  <Badge
                                    variant="outline"
                                    className="bg-emerald-50 text-emerald-700 border-emerald-100 font-mono"
                                  >
                                    {log.metrics_data[m.id] || "—"}
                                  </Badge>
                                </td>
                              ))}
                              <td
                                className="py-4 text-xs text-muted-foreground max-w-50 truncate"
                                title={log.notes}
                              >
                                {log.notes || "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="history" className="mt-0">
                  <div className="space-y-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-slate-950">
                          История событий
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Перемещения, обслуживание и инциденты по этому
                          оборудованию.
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {[
                          { value: "all", label: "Все" },
                          { value: "maintenance", label: "Обслуживание" },
                          { value: "move", label: "Перемещения" },
                          { value: "issue", label: "Инциденты" },
                        ].map((filterOption) => (
                          <Button
                            key={filterOption.value}
                            type="button"
                            variant={
                              historyFilter === filterOption.value
                                ? "default"
                                : "outline"
                            }
                            size="sm"
                            className={cn(
                              "h-8 rounded-full px-3 text-xs",
                              historyFilter === filterOption.value &&
                                "bg-primary hover:bg-primary/90",
                            )}
                            onClick={() =>
                              setHistoryFilter(
                                filterOption.value as HistoryFilter,
                              )
                            }
                          >
                            {filterOption.label}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {isHistoryLoading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
                      </div>
                    ) : history.length === 0 ? (
                      <div className="rounded-2xl border border-dashed bg-muted px-4 py-10 text-center text-sm italic text-muted-foreground">
                        История изменений пуста
                      </div>
                    ) : filteredHistory.length === 0 ? (
                      <div className="rounded-2xl border border-dashed bg-muted px-4 py-10 text-center text-sm italic text-muted-foreground">
                        Для выбранного фильтра событий пока нет
                      </div>
                    ) : (
                      groupedHistory.map((group) => (
                        <div key={group.label} className="space-y-3">
                          <div className="px-1 py-1">
                            <div className="inline-flex items-center rounded-full border bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                              {group.label}
                            </div>
                          </div>

                          <div className="space-y-3">
                            {group.items.map((log) => {
                              const presentation = getHistoryPresentation(log);

                              return (
                                <div
                                  key={`${group.label}-${log.id}`}
                                  className="relative pl-12"
                                >
                                  <div className="absolute top-0 bottom-0 left-4.5 w-px bg-slate-200" />
                                  <div
                                    className={cn(
                                      "absolute left-0 top-5 flex h-9 w-9 items-center justify-center rounded-xl border bg-card",
                                      presentation.badgeClassName,
                                    )}
                                  >
                                    {presentation.icon}
                                  </div>

                                  <div className="rounded-2xl border bg-card p-4">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                      <div className="min-w-0 space-y-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <Badge
                                            variant="outline"
                                            className={cn(
                                              "rounded-full border text-[10px] font-semibold",
                                              presentation.badgeClassName,
                                            )}
                                          >
                                            {presentation.badgeLabel}
                                          </Badge>
                                          <span className="text-xs text-muted-foreground/70">
                                            {formatHistoryTime(log.date)}
                                          </span>
                                        </div>
                                        <div>
                                          <p className="text-sm font-semibold text-slate-950">
                                            {presentation.title}
                                          </p>
                                          <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                            {presentation.description}
                                          </p>
                                        </div>

                                        {Array.isArray(log.photos) &&
                                          log.photos.length > 0 && (
                                            <div className="space-y-2 pt-1">
                                              <div className="flex items-center justify-between gap-3">
                                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                                  Прикреплённые фото
                                                </p>
                                                <span className="text-[11px] text-muted-foreground/70">
                                                  {log.photos.length} шт.
                                                </span>
                                              </div>

                                              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                                                {log.photos.map(
                                                  (photo, photoIndex) => (
                                                    <button
                                                      key={`${log.id}-photo-${photoIndex}`}
                                                      type="button"
                                                      onClick={() =>
                                                        openHistoryPhotoViewer(
                                                          log.photos || [],
                                                          photoIndex,
                                                        )
                                                      }
                                                      className="relative aspect-4/3 overflow-hidden rounded-xl border bg-accent"
                                                    >
                                                      <img
                                                        src={photo}
                                                        alt={`Фото события ${presentation.title} ${photoIndex + 1}`}
                                                        className="h-full w-full object-cover"
                                                      />
                                                      <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/55 to-transparent px-2 py-1 text-left text-[10px] font-medium text-primary-foreground">
                                                        Открыть
                                                      </div>
                                                    </button>
                                                  ),
                                                )}
                                              </div>
                                            </div>
                                          )}
                                      </div>

                                      <div className="shrink-0 rounded-xl bg-muted px-3 py-2 text-right">
                                        <p className="text-[11px] font-semibold text-foreground">
                                          {log.user_name || "Система"}
                                        </p>
                                        <p className="mt-0.5 text-[10px] text-muted-foreground/70">
                                          {new Date(
                                            log.date,
                                          ).toLocaleDateString("ru-RU")}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="files" className="mt-0 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">
                        Файлы и фотографии
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Фотографии оборудования для инвентаризации и контроля
                        состояния.
                      </p>
                    </div>
                    <div className="relative">
                      <input
                        type="file"
                        accept="image/*"
                        className="absolute inset-0 cursor-pointer opacity-0"
                        onChange={handleUploadPhoto}
                        disabled={isUploadingPhoto}
                      />
                      <Button
                        size="sm"
                        disabled={isUploadingPhoto}
                        type="button"
                      >
                        {isUploadingPhoto ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="mr-2 h-4 w-4" />
                        )}
                        Добавить фото
                      </Button>
                    </div>
                  </div>

                  {!equipment.photos || equipment.photos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-muted py-12 text-center">
                      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-background shadow-sm">
                        <Info className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <h4 className="font-medium text-foreground">
                        Нет фотографий
                      </h4>
                      <p className="mt-1 max-w-70 text-sm text-muted-foreground">
                        Вы можете загрузить фотографии этого оборудования здесь.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                      {equipment.photos.map((photo, index) => (
                        <div
                          key={`equipment-photo-${index}`}
                          className="group relative aspect-square overflow-hidden rounded-xl border bg-muted"
                        >
                          <img
                            src={photo}
                            alt={`Фото оборудования ${index + 1}`}
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          />
                          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                            <Button
                              type="button"
                              size="icon"
                              variant="secondary"
                              className="h-9 w-9 rounded-full"
                              onClick={() =>
                                openHistoryPhotoViewer(
                                  equipment.photos || [],
                                  index,
                                )
                              }
                            >
                              <Info className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="destructive"
                              className="h-9 w-9 rounded-full"
                              onClick={() => handleDeletePhoto(photo)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </form>
            </div>
          </Tabs>
        </Card>
      </div>

      {/* Manual Performance Log Dialog */}
      <Dialog
        open={isAddPerformanceLogOpen}
        onOpenChange={setIsAddPerformanceLogOpen}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Добавить замер производительности</DialogTitle>
            <DialogDescription>
              Внесите результаты тестов вручную для этого оборудования.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={handleAddManualPerformanceLog}
            className="space-y-4 pt-4"
          >
            <div className="space-y-4">
              {performanceMetrics.map((metric) => (
                <div key={metric.id} className="space-y-2">
                  <Label htmlFor={metric.id}>
                    {metric.name} {metric.unit ? `(${metric.unit})` : ""}
                  </Label>
                  <Input
                    id={metric.id}
                    value={manualPerformanceData[metric.id] || ""}
                    onChange={(e) =>
                      setManualPerformanceData((prev) => ({
                        ...prev,
                        [metric.id]: e.target.value,
                      }))
                    }
                    placeholder={`Введите значение...`}
                  />
                </div>
              ))}

              <div className="space-y-2">
                <Label htmlFor="perf_notes">Заметки (необязательно)</Label>
                <Textarea
                  id="perf_notes"
                  value={manualPerformanceNotes}
                  onChange={(e) => setManualPerformanceNotes(e.target.value)}
                  placeholder="Дополнительная информация о результатах тестов..."
                  className="resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsAddPerformanceLogOpen(false)}
              >
                Отмена
              </Button>
              <Button type="submit" disabled={isSubmittingPerformance}>
                {isSubmittingPerformance && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                <Save className="mr-2 h-4 w-4" />
                Сохранить
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(historyPhotoViewer)}
        onOpenChange={(open) => {
          if (!open) closeHistoryPhotoViewer();
        }}
      >
        <DialogContent className="left-0 top-0 h-screen w-screen max-w-none translate-x-0 translate-y-0 rounded-none border-0 bg-primary p-0 text-primary-foreground shadow-none [&>button]:hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Просмотр фото из истории оборудования</DialogTitle>
            <DialogDescription>
              Полноэкранный просмотр прикреплённых фотографий с возможностью
              переключения между изображениями.
            </DialogDescription>
          </DialogHeader>
          {historyPhotoViewer && (
            <div className="relative flex h-screen flex-col">
              <div className="pointer-events-none absolute inset-x-0 top-4 z-20 flex justify-center px-4">
                <div className="pointer-events-auto flex max-w-[90vw] items-center gap-2 overflow-x-auto rounded-full border border-white/10 bg-primary/80 p-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={showPrevHistoryPhoto}
                    disabled={historyPhotoViewer.index === 0}
                    className="h-8 w-8 shrink-0 text-primary-foreground hover:bg-card/20 disabled:opacity-30"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="w-24 shrink-0 text-center text-xs text-primary-foreground/70">
                    {historyPhotoViewer.index + 1} /{" "}
                    {historyPhotoViewer.images.length}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={showNextHistoryPhoto}
                    disabled={
                      historyPhotoViewer.index >=
                      historyPhotoViewer.images.length - 1
                    }
                    className="h-8 w-8 shrink-0 text-primary-foreground hover:bg-card/20 disabled:opacity-30"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <div className="mx-1 h-4 w-px shrink-0 bg-card/20" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={closeHistoryPhotoViewer}
                    className="h-8 w-8 shrink-0 text-primary-foreground hover:bg-card/20"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {historyPhotoViewer.images.length > 1 && (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={showPrevHistoryPhoto}
                    disabled={historyPhotoViewer.index === 0}
                    className="absolute bottom-8 left-6 z-20 h-12 w-12 rounded-full border border-white/10 bg-primary/80 text-primary-foreground hover:bg-card/20 disabled:opacity-30 md:top-1/2 md:bottom-auto md:-translate-y-1/2"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={showNextHistoryPhoto}
                    disabled={
                      historyPhotoViewer.index >=
                      historyPhotoViewer.images.length - 1
                    }
                    className="absolute bottom-8 right-6 z-20 h-12 w-12 rounded-full border border-white/10 bg-primary/80 text-primary-foreground hover:bg-card/20 disabled:opacity-30 md:top-1/2 md:bottom-auto md:-translate-y-1/2"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </Button>
                </>
              )}

              <div className="flex min-h-0 flex-1 items-center justify-center p-4 md:p-8">
                <img
                  src={historyPhotoViewer.images[historyPhotoViewer.index]}
                  alt="Фото из истории оборудования"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Component Dialog */}
      <Dialog
        open={isAddComponentDialogOpen}
        onOpenChange={setIsAddComponentDialogOpen}
      >
        <DialogContent className="max-w-2xl overflow-hidden p-0">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle>Добавить комплектующее</DialogTitle>
            <DialogDescription>
              Выберите деталь из тех, что сейчас на складе, или создайте новую
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col h-[500px]">
            <div className="flex-1 overflow-y-auto p-6 pt-2">
              <div className="space-y-3">
                {availableComponents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                    <Layers className="mb-2 h-8 w-8 opacity-20" />
                    <p>На складе нет свободных деталей</p>
                  </div>
                ) : (
                  availableComponents.map((comp) => (
                    <div
                      key={comp.id}
                      className="flex items-center justify-between rounded-xl border p-4 transition-colors hover:bg-slate-50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                          {comp.type === "CPU" && (
                            <Cpu className="h-5 w-5 text-primary" />
                          )}
                          {comp.type === "GPU" && (
                            <CircuitBoard className="h-5 w-5 text-primary" />
                          )}
                          {comp.type === "RAM" && (
                            <Layers className="h-5 w-5 text-primary" />
                          )}
                          {comp.type === "PSU" && (
                            <Zap className="h-5 w-5 text-primary" />
                          )}
                          {comp.type === "STORAGE" && (
                            <HardDrive className="h-5 w-5 text-primary" />
                          )}
                          {comp.type === "COOLING" && (
                            <Fan className="h-5 w-5 text-primary" />
                          )}
                          {![
                            "CPU",
                            "GPU",
                            "RAM",
                            "PSU",
                            "STORAGE",
                            "COOLING",
                          ].includes(comp.type) && (
                            <Settings className="h-5 w-5 text-primary" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{comp.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {comp.type_name} • {comp.identifier || "Без SN"}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleLinkComponent(comp.id)}
                        disabled={isLinkingComponent}
                      >
                        {isLinkingComponent ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Выбрать"
                        )}
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="border-t bg-slate-50 p-6 flex justify-between items-center">
              <Button
                variant="ghost"
                onClick={() => setIsAddComponentDialogOpen(false)}
              >
                Отмена
              </Button>
              <Button asChild className="bg-slate-900 hover:bg-slate-800">
                <Link
                  href={`/clubs/${clubId}/equipment/inventory?action=new&parent_id=${equipment?.id}`}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Создать новую деталь
                </Link>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur supports-backdrop-filter:bg-background/80 md:hidden">
        <div className="mx-auto flex max-w-7xl gap-2">
          <Button asChild variant="outline" className="h-11 flex-1">
            <Link href={`/clubs/${clubId}/equipment/inventory`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Назад
            </Link>
          </Button>
          <Button
            form="equipment-page-form"
            type="submit"
            disabled={isSaving || isDeleting || activeTab === "history"}
            className="h-11 flex-1"
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Сохранить
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={isDeleting}
            className="h-11 flex-1"
            onClick={handleDelete}
          >
            {isDeleting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Удалить
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
