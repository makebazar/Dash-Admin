"use client";

import { useEffect, useState, useCallback, useMemo, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Monitor,
  Play,
  Check,
  MapPin,
  Smartphone,
  ChevronRight,
  RefreshCcw,
  X,
  Info,
  QrCode as QrIcon,
  Undo2,
  Upload,
  Trash2,
  AlertTriangle,
  Image as ImageIcon,
  MessageSquare,
  Wrench,
} from "lucide-react";

import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  cn,
  formatDateKeyInTimezone,
  getMonthRangeInTimezone,
  isLaundryEquipmentType,
  uploadOptimizedImages,
} from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { QRCode } from "@/components/qr/QRCode";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { MaintenanceSegmentedBar } from "@/components/equipment/MaintenanceSegmentedBar";
import { getMaintenanceProgress } from "@/lib/maintenance-progress";

interface MaintenanceTask {
  id: string;
  equipment_id: string;
  equipment_name: string;
  equipment_type: string;
  equipment_type_name: string;
  workstation_name?: string;
  workstation_assigned_to_name?: string | null;
  workstation_is_available_to_all?: boolean;
  due_date: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED" | "REWORK";
  kpi_points: number;
  last_cleaned_at?: string;
  verification_status?: string;
  rejection_reason?: string;
  verified_by_name?: string;
  session_id?: string;
  latest_rejection?: {
    note: string;
    photos: string[];
    rejected_by_name?: string;
  };
  cleaning_time_minutes?: number | null;
  cleaning_interval_days?: number | null;
  overdue_tolerance_days?: number | null;
  maintenance_enabled?: boolean;
  parent_equipment_id?: string | null;
}

const normalizeDateKey = (value?: string | null) => {
  if (!value) return "";
  const normalized = String(value).trim();
  const match = normalized.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : normalized;
};

const normalizeStatus = (value?: string | null) =>
  String(value || "")
    .trim()
    .toUpperCase();

const normalizeTask = (task: any): MaintenanceTask => ({
  ...task,
  workstation_assigned_to_name: task?.workstation_assigned_to_name,
  workstation_is_available_to_all: task?.workstation_is_available_to_all,
  due_date: normalizeDateKey(task?.due_date),
  status: normalizeStatus(task?.status) as MaintenanceTask["status"],
  verification_status: task?.verification_status
    ? normalizeStatus(task.verification_status)
    : task?.verification_status,
  session_id: task?.session_id,
  verified_by_name: task?.verified_by_name,
  cleaning_time_minutes: task?.cleaning_time_minutes !== undefined && task?.cleaning_time_minutes !== null ? Number(task.cleaning_time_minutes) : null,
  cleaning_interval_days: task?.cleaning_interval_days !== undefined && task?.cleaning_interval_days !== null ? Number(task.cleaning_interval_days) : null,
  overdue_tolerance_days: task?.overdue_tolerance_days !== undefined && task?.overdue_tolerance_days !== null ? Number(task.overdue_tolerance_days) : null,
  maintenance_enabled: task?.maintenance_enabled !== undefined ? Boolean(task.maintenance_enabled) : true,
});

function EmployeeTasksContent() {
  const { clubId } = useParams();
  const searchParams = useSearchParams();
  const isSuccess = searchParams.get("success") === "true";

  const [clubTimezone, setClubTimezone] = useState("Europe/Moscow");
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [freeTasks, setFreeTasks] = useState<MaintenanceTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [apiStats, setApiStats] = useState<{
    overdue_count: number;
    due_today_count: number;
    upcoming_count: number;
    completed_count: number;
    in_progress_count: number;
    rework_count: number;
    stale_rework_count: number;
    month_plan_count: number;
    month_completed_count: number;
    old_debt_closed_count: number;
    quality_penalty_units: number;
    adjusted_month_completed_count: number;
    raw_efficiency: number;
    adjusted_efficiency: number;
  } | null>(null);
  const [filterMode, setFilterMode] = useState<"current" | "all">("current");
  const [statusFilter, setStatusFilter] = useState<"all" | "overdue" | "today" | "in_progress" | "completed">("all");
  const [activeCategory, setActiveCategory] = useState<"equipment" | "components">("equipment");

  // Mobile Terminal State
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  // Modal completion mode state
  const [maintenanceSettings, setMaintenanceSettings] = useState<any>(null);
  const [selectedTaskForModal, setSelectedTaskForModal] = useState<string | null>(null);
  const [modalTaskDetails, setModalTaskDetails] = useState<any>(null);
  const [isModalDetailsLoading, setIsModalDetailsLoading] = useState(false);
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);

  // Form states
  const [photosBefore, setPhotosBefore] = useState<string[]>([]);
  const [photosAfter, setPhotosAfter] = useState<string[]>([]);
  const [isUploadingBefore, setIsUploadingBefore] = useState(false);
  const [isUploadingAfter, setIsUploadingAfter] = useState(false);
  const [completionNotes, setCompletionNotes] = useState("");
  const [completionStatus, setCompletionStatus] = useState<"OK" | "ISSUE" | "LAUNDRY">("OK");
  const [issueTitle, setIssueTitle] = useState("");
  const [issueDescription, setIssueDescription] = useState("");

  // Toast notification state
  const [successToast, setSuccessToast] = useState<{ show: boolean; message: string }>({
    show: false,
    message: "",
  });

  const showSuccessToast = (message: string) => {
    setSuccessToast({ show: true, message });
    setTimeout(() => {
      setSuccessToast((prev) => ({ ...prev, show: false }));
    }, 4000);
  };

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const inProgressTaskIds = useMemo(
    () =>
      tasks
        .filter((t) => t.status === "IN_PROGRESS" || t.status === "REWORK")
        .map((t) => t.id),
    [tasks],
  );

  const selectedTotalTime = useMemo(() => {
    return tasks
      .filter((t) => selectedTaskIds.includes(t.id))
      .reduce((sum, t) => sum + (t.cleaning_time_minutes || 0), 0);
  }, [tasks, selectedTaskIds]);

  const inProgressTotalTime = useMemo(() => {
    return tasks
      .filter((t) => inProgressTaskIds.includes(t.id))
      .reduce((sum, t) => sum + (t.cleaning_time_minutes || 0), 0);
  }, [tasks, inProgressTaskIds]);

  const toggleTaskSelection = (taskId: string) => {
    // Reset session if selection changes
    // setSessionId(null); // REMOVED: Keep session if selection changes
    setSelectedTaskIds((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId],
    );
  };

  const ensurePlan = useCallback(
    async (date: Date) => {
      try {
        const { firstDay, lastDay } = getMonthRangeInTimezone(
          date,
          clubTimezone,
        );

        await fetch(`/api/clubs/${clubId}/equipment/maintenance`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date_from: firstDay,
            date_to: lastDay,
            task_type: "CLEANING",
          }),
        });
      } catch (error) {
        console.error("Error ensuring plan:", error);
      }
    },
    [clubId, clubTimezone],
  );

  const fetchData = useCallback(
    async (withPlan = true) => {
      setIsLoading(true);
      try {
        const today = formatDateKeyInTimezone(new Date(), clubTimezone);
        const { firstDay: monthStart, lastDay: monthEnd } =
          getMonthRangeInTimezone(new Date(), clubTimezone);

        if (withPlan) {
          await ensurePlan(new Date());
        }

        const [assignedRes, freeRes, sessionsRes] = await Promise.all([
          fetch(
            `/api/clubs/${clubId}/equipment/maintenance?assigned=me&date_from=${monthStart}&date_to=${monthEnd}&include_overdue=true`,
          ),
          fetch(
            `/api/clubs/${clubId}/equipment/maintenance?assigned=unassigned&status=PENDING,REWORK&date_to=${today}&include_overdue=true`,
          ),
          fetch(`/api/clubs/${clubId}/equipment/maintenance/sessions`),
        ]);

        const assignedData = await assignedRes.json();
        const freeData = await freeRes.json();
        const sessionsData = await sessionsRes.json();

        if (sessionsRes.ok && Array.isArray(sessionsData)) {
          const activeSession = sessionsData.find(
            (s) =>
              s.status !== "COMPLETED" && parseInt(s.task_count || "0") > 0,
          );
          if (activeSession) {
            setSessionId(activeSession.id);
          } else {
            setSessionId(null);
          }
        }

        if (assignedRes.ok) {
          setTasks(
            Array.isArray(assignedData.tasks)
              ? assignedData.tasks.map(normalizeTask)
              : [],
          );
          if (assignedData.stats) {
            setApiStats({
              overdue_count: parseInt(assignedData.stats.overdue_count || "0"),
              due_today_count: parseInt(
                assignedData.stats.due_today_count || "0",
              ),
              upcoming_count: parseInt(
                assignedData.stats.upcoming_count || "0",
              ),
              completed_count: parseInt(
                assignedData.stats.completed_count || "0",
              ),
              in_progress_count: parseInt(
                assignedData.stats.in_progress_count || "0",
              ),
              rework_count: parseInt(assignedData.stats.rework_count || "0"),
              stale_rework_count: parseInt(
                assignedData.stats.stale_rework_count || "0",
              ),
              month_plan_count: parseInt(
                assignedData.stats.month_plan_count || "0",
              ),
              month_completed_count: parseInt(
                assignedData.stats.month_completed_count || "0",
              ),
              old_debt_closed_count: parseInt(
                assignedData.stats.old_debt_closed_count || "0",
              ),
              quality_penalty_units: parseInt(
                assignedData.stats.quality_penalty_units || "0",
              ),
              adjusted_month_completed_count: parseInt(
                assignedData.stats.adjusted_month_completed_count || "0",
              ),
              raw_efficiency: parseFloat(
                assignedData.stats.raw_efficiency || "0",
              ),
              adjusted_efficiency: parseFloat(
                assignedData.stats.adjusted_efficiency || "0",
              ),
            });
          }
        }
        if (freeRes.ok)
          setFreeTasks(
            Array.isArray(freeData.tasks)
              ? freeData.tasks.map(normalizeTask)
              : [],
          );
      } catch (error) {
        console.error("Error fetching tasks:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [clubId, ensurePlan, clubTimezone],
  );

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        const currentClub = Array.isArray(data.employeeClubs)
          ? data.employeeClubs.find(
              (item: any) => String(item.id) === String(clubId),
            )
          : null;
        if (currentClub?.timezone) {
          setClubTimezone(currentClub.timezone);
        }
      })
      .catch((error) => {
        console.error("Error fetching club timezone:", error);
      });
  }, [clubId]);

  useEffect(() => {
    fetchData();
  }, [fetchData, clubTimezone]);

  // Load maintenance settings
  useEffect(() => {
    if (!clubId) return;
    fetch(`/api/clubs/${clubId}/settings/maintenance`)
      .then((res) => res.json())
      .then((data) => {
        setMaintenanceSettings(data);
      })
      .catch((err) => console.error("Error fetching maintenance settings:", err));
  }, [clubId]);

  const isModalMode = useMemo(() => {
    return maintenanceSettings?.desktop_completion_mode === "MODAL";
  }, [maintenanceSettings]);

  // Load single task details when selected for modal
  useEffect(() => {
    if (!selectedTaskForModal) {
      setModalTaskDetails(null);
      setPhotosBefore([]);
      setPhotosAfter([]);
      setCompletionNotes("");
      setCompletionStatus("OK");
      setIssueTitle("");
      setIssueDescription("");
      return;
    }

    const fetchDetails = async () => {
      setIsModalDetailsLoading(true);
      try {
        const res = await fetch(`/api/clubs/${clubId}/equipment/maintenance/${selectedTaskForModal}`);
        if (res.ok) {
          const data = await res.json();
          setModalTaskDetails(data);
          setPhotosBefore(data.task.photos_before || []);
          setPhotosAfter(data.task.photos_after || []);
          setCompletionNotes("");
        } else {
          alert("Не удалось загрузить детали задачи");
          setSelectedTaskForModal(null);
        }
      } catch (err) {
        console.error(err);
        setSelectedTaskForModal(null);
      } finally {
        setIsModalDetailsLoading(false);
      }
    };

    fetchDetails();
  }, [selectedTaskForModal, clubId]);

  // Handle file uploads with image optimization
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: "BEFORE" | "AFTER") => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;

    if (type === "BEFORE") setIsUploadingBefore(true);
    else setIsUploadingAfter(true);

    try {
      const validUrls = await uploadOptimizedImages(files, {
        maxDimension: 1200,
        quality: 0.82,
      });
      if (type === "BEFORE") {
        setPhotosBefore((prev) => [...prev, ...validUrls]);
      } else {
        setPhotosAfter((prev) => [...prev, ...validUrls]);
      }
    } catch (err) {
      console.error(err);
      alert("Ошибка при загрузке фото");
    } finally {
      if (type === "BEFORE") setIsUploadingBefore(false);
      else setIsUploadingAfter(false);
    }
  };

  const removePhoto = (index: number, type: "BEFORE" | "AFTER") => {
    if (type === "BEFORE") {
      setPhotosBefore((prev) => prev.filter((_, i) => i !== index));
    } else {
      setPhotosAfter((prev) => prev.filter((_, i) => i !== index));
    }
  };

  // Start task in modal (IN_PROGRESS)
  const handleStartTask = async () => {
    if (!selectedTaskForModal) return;
    setIsModalDetailsLoading(true);
    try {
      const isFreeTask = freeTasks.some((t) => t.id === selectedTaskForModal);
      const body = isFreeTask ? { claim: true } : { status: "IN_PROGRESS" };

      const res = await fetch(`/api/clubs/${clubId}/equipment/maintenance/${selectedTaskForModal}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        // Fetch updated details
        const detailsRes = await fetch(`/api/clubs/${clubId}/equipment/maintenance/${selectedTaskForModal}`);
        if (detailsRes.ok) {
          const data = await detailsRes.json();
          setModalTaskDetails(data);
          setPhotosBefore(data.task.photos_before || []);
          setPhotosAfter(data.task.photos_after || []);
        }
        fetchData(false);
      } else {
        const data = await res.json();
        alert(data.error || "Не удалось начать обслуживание");
      }
    } catch (err) {
      console.error(err);
      alert("Ошибка при начале обслуживания");
    } finally {
      setIsModalDetailsLoading(false);
    }
  };

  // Complete task in modal (COMPLETED)
  const handleCompleteTask = async () => {
    if (!selectedTaskForModal || !modalTaskDetails) return;

    const taskSettings = modalTaskDetails.settings;
    
    // Validations
    if (taskSettings.require_photo_before && photosBefore.length < taskSettings.min_photos_before) {
      alert(`Необходимо приложить фото "ДО" (минимум: ${taskSettings.min_photos_before})`);
      return;
    }

    if (taskSettings.require_photo_after && photosAfter.length < taskSettings.min_photos_after) {
      alert(`Необходимо приложить фото "ПОСЛЕ" (минимум: ${taskSettings.min_photos_after})`);
      return;
    }

    if (taskSettings.require_notes_on_completion && !completionNotes.trim()) {
      alert("Комментарий к обслуживанию обязателен");
      return;
    }

    if ((completionStatus === "ISSUE" || completionStatus === "LAUNDRY") && !issueTitle.trim()) {
      alert("Необходимо указать название инцидента / причину стирки");
      return;
    }

    setIsSubmittingTask(true);
    try {
      const completeRes = await fetch(`/api/clubs/${clubId}/equipment/maintenance/${selectedTaskForModal}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photos_before: photosBefore,
          photos_after: photosAfter,
          photos: [...photosBefore, ...photosAfter],
          notes: completionNotes,
          status_mode: completionStatus,
          issue_title: issueTitle.trim() || null,
          issue_description: issueDescription.trim() || null,
        }),
      });

      if (!completeRes.ok) {
        const errData = await completeRes.json();
        throw new Error(errData.error || "Ошибка при завершении задачи");
      }

      // Successful completion
      setSelectedTaskForModal(null);
      fetchData(false);
      if (isModalMode) {
        showSuccessToast("Обслуживание успешно завершено!");
      } else {
        alert("Обслуживание успешно завершено!");
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Ошибка при завершении обслуживания");
    } finally {
      setIsSubmittingTask(false);
    }
  };

  useEffect(() => {
    if (isSuccess) {
      if (isModalMode) {
        showSuccessToast("Обслуживание успешно завершено");
      } else {
        alert("Обслуживание успешно завершено");
      }
      setSelectedTaskIds([]);
      setSessionId(null);
    }
  }, [isSuccess, isModalMode]);

  const createSession = async (taskIds: string[]) => {
    if (taskIds.length === 0) return;
    setIsCreatingSession(true);
    // setSessionId(null); // REMOVED: Keep session if adding to it

    try {
      const url = sessionId
        ? `/api/clubs/${clubId}/equipment/maintenance/sessions/${sessionId}`
        : `/api/clubs/${clubId}/equipment/maintenance/sessions`;

      const method = sessionId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskIds }),
      });
      const data = await res.json();
      if (res.ok) {
        const sid = sessionId || data.sessionId;
        if (!sessionId) setSessionId(sid);
        setSelectedTaskIds([]);
        if (isMobile) {
          const terminalUrl = `${window.location.origin}/employee/terminal/maintenance/${sid}?clubId=${clubId}`;
          window.open(terminalUrl, "_self");
        } else {
          fetchData(false);
        }
      } else {
        alert(data.error || "Ошибка при создании сессии");
      }
    } catch (error) {
      console.error(error);
      alert("Ошибка при создании сессии");
    } finally {
      setIsCreatingSession(false);
    }
  };

  const handleAction = async (taskId: string, action: "START" | "COMPLETE") => {
    if (sessionId) {
      await createSession([taskId]);
      return;
    }

    setIsUpdating(taskId);
    try {
      const res = await fetch(
        `/api/clubs/${clubId}/equipment/maintenance/${taskId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "IN_PROGRESS" }),
        },
      );

      if (res.ok) {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId ? { ...t, status: "IN_PROGRESS" } : t,
          ),
        );
        // Automatically create session for all tasks currently in progress or rework
        const allInProgress = tasks
          .map((t) => (t.id === taskId ? { ...t, status: "IN_PROGRESS" } : t))
          .filter((t) => t.status === "IN_PROGRESS" || t.status === "REWORK")
          .map((t) => t.id);
        await createSession(allInProgress);
      }
    } catch (error) {
      console.error("Error updating task status:", error);
    } finally {
      setIsUpdating(null);
    }
  };

  const handleClaim = async (taskId: string) => {
    setIsUpdating(taskId);
    try {
      const res = await fetch(
        `/api/clubs/${clubId}/equipment/maintenance/${taskId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ claim: true }),
        },
      );

      if (res.ok) {
        setFreeTasks((prev) => prev.filter((t) => t.id !== taskId));
        fetchData(false);
      }
    } catch (error) {
      console.error("Error claiming task:", error);
    } finally {
      setIsUpdating(null);
    }
  };

  const handleReturnFromWork = async (taskId: string) => {
    setIsUpdating(taskId);
    try {
      const res = await fetch(
        `/api/clubs/${clubId}/equipment/maintenance/${taskId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "PENDING" }),
        },
      );

      if (res.ok) {
        fetchData(false);
      }
    } catch (error) {
      console.error("Error returning task from work:", error);
    } finally {
      setIsUpdating(null);
    }
  };

  const handleBulkStart = async () => {
    if (selectedTaskIds.length === 0) return;
    setIsBulkUpdating(true);
    try {
      const promises = selectedTaskIds.map(async (taskId) => {
        const isFree = freeTasks.some((t) => t.id === taskId);
        const url = `/api/clubs/${clubId}/equipment/maintenance/${taskId}`;
        const body = isFree ? { claim: true } : { status: "IN_PROGRESS" };

        const res = await fetch(url, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        return { taskId, ok: res.ok };
      });

      const results = await Promise.all(promises);
      const failedCount = results.filter((r) => !r.ok).length;

      if (failedCount > 0) {
        alert(`Не удалось взять в работу ${failedCount} задач из ${selectedTaskIds.length}`);
      } else {
        setSelectedTaskIds([]);
      }
      await fetchData(false);
    } catch (error) {
      console.error("Error bulk updating tasks:", error);
      alert("Ошибка при массовом взятии задач в работу");
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleCreateTerminalSession = () => {
    const idsToStart =
      selectedTaskIds.length > 0 ? selectedTaskIds : inProgressTaskIds;
    createSession(idsToStart);
  };

  const hasComponentTasks = useMemo(() => {
    return tasks.some((t) => !!t.parent_equipment_id) || freeTasks.some((t) => !!t.parent_equipment_id);
  }, [tasks, freeTasks]);

  useEffect(() => {
    if (!hasComponentTasks && activeCategory !== "equipment") {
      setActiveCategory("equipment");
    }
  }, [hasComponentTasks, activeCategory]);

  const filteredFreeTasksCount = useMemo(() => {
    return freeTasks.filter((t) => {
      if (activeCategory === "equipment") return !t.parent_equipment_id;
      return !!t.parent_equipment_id;
    }).length;
  }, [freeTasks, activeCategory]);

  const groupedTasks = useMemo(() => {
    const groups: Record<string, MaintenanceTask[]> = {};
    const todayStr = formatDateKeyInTimezone(new Date(), clubTimezone);

    tasks.forEach((task) => {
      if (activeCategory === "equipment" && task.parent_equipment_id) return;
      if (activeCategory === "components" && !task.parent_equipment_id) return;

      const tolerance = task.overdue_tolerance_days ?? 3;
      const taskDueStr = formatDateKeyInTimezone(new Date(task.due_date), clubTimezone);
      const diffMs = new Date(todayStr).getTime() - new Date(taskDueStr).getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

      const isPastTolerance = task.status === "PENDING" && diffDays > tolerance;
      const isDueTodayOrGrace = task.status === "PENDING" && diffDays >= 0 && diffDays <= tolerance;
      const isInProgress = task.status === "IN_PROGRESS";
      const isRework = task.status === "REWORK";
      const isCompleted = task.status === "COMPLETED";

      if (statusFilter === "overdue") {
        if (!isPastTolerance) return;
      } else if (statusFilter === "today") {
        if (!isDueTodayOrGrace) return;
      } else if (statusFilter === "in_progress") {
        if (!isInProgress && !isRework) return;
      } else if (statusFilter === "completed") {
        if (!isCompleted) return;
      } else if (filterMode === "current") {
        if (!isPastTolerance && !isDueTodayOrGrace && !isInProgress && !isRework) return;
      }

      const location = task.workstation_name || "Склад";
      if (!groups[location]) groups[location] = [];
      groups[location].push(task);
    });

    return Object.entries(groups).sort(([a], [b]) => {
      if (a === "Склад") return -1;
      if (b === "Склад") return 1;
      return a.localeCompare(b);
    });
  }, [tasks, filterMode, clubTimezone, activeCategory, statusFilter]);

  const groupedFreeTasks = useMemo(() => {
    const groups: Record<string, MaintenanceTask[]> = {};
    const todayStr = formatDateKeyInTimezone(new Date(), clubTimezone);

    freeTasks.forEach((task) => {
      if (activeCategory === "equipment" && task.parent_equipment_id) return;
      if (activeCategory === "components" && !task.parent_equipment_id) return;

      const tolerance = task.overdue_tolerance_days ?? 3;
      const taskDueStr = formatDateKeyInTimezone(new Date(task.due_date), clubTimezone);
      const diffMs = new Date(todayStr).getTime() - new Date(taskDueStr).getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

      const isPastTolerance = task.status === "PENDING" && diffDays > tolerance;
      const isDueTodayOrGrace = task.status === "PENDING" && diffDays >= 0 && diffDays <= tolerance;
      const isInProgress = task.status === "IN_PROGRESS";
      const isRework = task.status === "REWORK";
      const isCompleted = task.status === "COMPLETED";

      if (statusFilter === "overdue") {
        if (!isPastTolerance) return;
      } else if (statusFilter === "today") {
        if (!isDueTodayOrGrace) return;
      } else if (statusFilter === "in_progress") {
        if (!isInProgress && !isRework) return;
      } else if (statusFilter === "completed") {
        if (!isCompleted) return;
      }

      const location = task.workstation_name || "Склад";
      if (!groups[location]) groups[location] = [];
      groups[location].push(task);
    });

    return Object.entries(groups).sort(([a], [b]) => {
      if (a === "Склад") return -1;
      if (b === "Склад") return 1;
      return a.localeCompare(b);
    });
  }, [freeTasks, activeCategory, statusFilter, clubTimezone]);

  const renderTaskCard = (
    task: MaintenanceTask,
    isFree: boolean = false,
    hideLocation: boolean = false,
  ) => {
    const todayStr = formatDateKeyInTimezone(new Date(), clubTimezone);
    const isFuture = task.status === "PENDING" && task.due_date > todayStr;
    const isOverdue = task.status === "PENDING" && task.due_date < todayStr;
    const isInProgress = task.status === "IN_PROGRESS";
    const isCompleted = task.status === "COMPLETED";
    const isRework = task.status === "REWORK";
    const isRejected = task.verification_status === "REJECTED" || isRework;
    const showAsCompleted = isCompleted || isFuture;
    const isSelected = selectedTaskIds.includes(task.id);
    const isInCurrentSession =
      sessionId &&
      task.session_id &&
      String(task.session_id) === String(sessionId);

    const taskProgress = getMaintenanceProgress({
      maintenance_enabled: task.maintenance_enabled,
      cleaning_interval_days: task.cleaning_interval_days,
      last_cleaned_at: task.last_cleaned_at,
      due_date: task.due_date,
      overdue_tolerance_days: task.overdue_tolerance_days,
    });

    return (
      <Card
        key={task.id}
        className={cn(
          "border-none shadow-sm overflow-hidden transition-all cursor-pointer relative",
          isInProgress || isRework
            ? "ring-1 ring-primary/30 bg-primary/[0.02]"
            : "bg-card hover:shadow-md",
          isSelected &&
            (isMobile
              ? "ring-2 ring-white bg-white/[0.05]"
              : "ring-2 ring-primary bg-primary/[0.05]"),
          (isFree || showAsCompleted) && "opacity-80 hover:opacity-100",
          showAsCompleted && "bg-accent/30",
          isRejected && "ring-1 ring-rose-500/30 bg-rose-500/[0.02]",
        )}
        onClick={() => {
          if (showAsCompleted) return;
          if (isModalMode) {
            setSelectedTaskForModal(task.id);
          } else {
            toggleTaskSelection(task.id);
          }
        }}
      >
        <CardContent className="p-3.5 sm:p-4">
          <div className="flex items-start justify-between gap-3 min-w-0">
            {/* Left side: Checkbox + (Name & Progress) */}
            <div className="flex items-start gap-3 min-w-0 flex-1">
              {/* Selection Checkbox */}
              {!showAsCompleted && !isInCurrentSession && (
                <div
                  className="shrink-0 pt-0.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleTaskSelection(task.id);
                  }}
                >
                  <div
                    className={cn(
                      "h-5 w-5 rounded-md border transition-all flex items-center justify-center cursor-pointer",
                      isSelected
                        ? "bg-primary border-primary text-primary-foreground shadow-sm scale-105"
                        : "border-muted-foreground/30 bg-background hover:border-muted-foreground/60",
                    )}
                  >
                    {isSelected && (
                      <Check className="h-3 w-3 stroke-[3]" />
                    )}
                  </div>
                </div>
              )}

              {/* Title & Progress Bar */}
              <div className="min-w-0 flex-1 flex flex-col gap-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4
                    className={cn(
                      "font-bold text-sm sm:text-[15px] leading-tight tracking-tight truncate",
                      showAsCompleted
                        ? "text-muted-foreground"
                        : "text-foreground",
                    )}
                  >
                    {task.equipment_name}
                  </h4>
                  {isFree && task.workstation_assigned_to_name && (
                    <Badge
                      variant="outline"
                      className="h-5 px-1.5 text-[9px] font-medium border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 whitespace-nowrap"
                      title="Место доступно всем, ответственный закреплён"
                    >
                      Ответственный: {task.workstation_assigned_to_name}
                    </Badge>
                  )}
                  {isRejected && (
                    <Badge
                      variant="destructive"
                      className="h-5 px-2 text-[9px] font-bold bg-rose-500 hover:bg-rose-600 uppercase tracking-tighter"
                    >
                      На доработку
                    </Badge>
                  )}
                </div>

                {!showAsCompleted && (
                  <MaintenanceSegmentedBar
                    progress={taskProgress}
                    className="mt-0.5"
                  />
                )}
              </div>
            </div>

            {/* Right side: Type (top) + Time & Action (bottom) */}
            <div className="flex flex-col items-end justify-between self-stretch shrink-0 gap-2 min-h-[52px]">
              {/* Device Type on top right (no container) */}
              <div className="flex items-center gap-1.5 text-right">
                <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/75">
                  {task.equipment_type_name}
                </span>
                {!hideLocation && task.workstation_name && (
                  <span className="text-[10px] sm:text-[11px] text-muted-foreground/50">
                    • {task.workstation_name}
                  </span>
                )}
              </div>

              {/* Time & Action Button on bottom right */}
              {!(isMobile && selectedTaskIds.length >= 2 && isSelected) && (
                <div className="flex items-center gap-2.5">
                  {task.cleaning_time_minutes && !showAsCompleted && (
                    <span className="text-xs font-medium text-muted-foreground flex items-center gap-1 shrink-0">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground/70" />
                      {task.cleaning_time_minutes} мин.
                    </span>
                  )}

                  {isFree ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-8 px-3 rounded-lg text-xs font-semibold bg-accent hover:bg-accent/80 text-foreground transition-all shadow-sm active:scale-95"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClaim(task.id);
                      }}
                      disabled={isUpdating === task.id}
                    >
                      {isUpdating === task.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        "Взять"
                      )}
                    </Button>
                  ) : showAsCompleted ? (
                    <div className="flex flex-col items-end justify-center">
                      <span className="text-[9px] font-semibold text-muted-foreground/50 uppercase tracking-wider">
                        След.
                      </span>
                      <span className="text-xs font-bold text-muted-foreground/80">
                        {format(new Date(task.due_date), "dd.MM")}
                      </span>
                    </div>
                  ) : isInCurrentSession && !isModalMode ? (
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground active:scale-95 transition-all"
                        title="Вернуть из работы"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReturnFromWork(task.id);
                        }}
                        disabled={isUpdating === task.id}
                      >
                        {isUpdating === task.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-500" />
                        ) : (
                          <Undo2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        className="h-8 px-3 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isMobile) {
                            window.open(terminalUrl, "_self");
                          }
                        }}
                      >
                        В работе
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      {(isInProgress || isRework) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground active:scale-95 transition-all"
                          title="Вернуть из работы"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReturnFromWork(task.id);
                          }}
                          disabled={isUpdating === task.id}
                        >
                          {isUpdating === task.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-500" />
                          ) : (
                            <Undo2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        className={cn(
                          "h-8 px-3.5 rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 active:scale-95",
                          isInProgress || isRework
                            ? isRejected
                              ? "bg-rose-500 hover:bg-rose-600 text-white"
                              : "bg-primary text-primary-foreground hover:bg-primary/90"
                            : "bg-primary text-primary-foreground hover:bg-primary/90",
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isModalMode) {
                            setSelectedTaskForModal(task.id);
                          } else if (isInProgress || isRework) {
                            if (isMobile && sessionId) {
                              window.open(terminalUrl, "_self");
                            } else {
                              createSession([task.id]);
                            }
                          } else {
                            if (sessionId) {
                              createSession([task.id]);
                            } else {
                              handleAction(task.id, "START");
                            }
                          }
                        }}
                        disabled={isUpdating === task.id || isCreatingSession}
                      >
                        {isUpdating === task.id ||
                        (isCreatingSession &&
                          selectedTaskIds.includes(task.id)) ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <>
                            {isModalMode
                              ? isRework
                                ? "Исправить"
                                : isInProgress
                                  ? "Продолжить"
                                  : "Обслужить"
                              : sessionId
                                ? "Добавить"
                                : isInProgress || isRework
                                  ? isMobile
                                    ? "Открыть"
                                    : "QR-код"
                                  : "Начать"}
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Rework Comment Box */}
          {isRejected &&
            (task.rejection_reason || task.latest_rejection?.note) && (
              <div className="mt-3 bg-rose-500/[0.03] border border-rose-500/10 rounded-lg p-3 animate-in fade-in slide-in-from-top-1 duration-300">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] font-black text-rose-500/60 uppercase tracking-widest">
                    {task.latest_rejection?.rejected_by_name ||
                      task.verified_by_name ||
                      "Управляющий"}
                  </span>
                  <p className="text-[12px] text-rose-500/90 font-bold leading-tight italic">
                    "{task.latest_rejection?.note || task.rejection_reason}"
                  </p>
                </div>
              </div>
            )}
        </CardContent>
      </Card>
    );
  };

  const terminalUrl = sessionId
    ? `${window.location.origin}/employee/terminal/maintenance/${sessionId}?clubId=${clubId}`
    : "";

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8 md:px-8 md:py-12 space-y-8 relative z-0">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Задачи
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Техобслуживание оборудования
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="h-9 w-9 p-0 rounded-lg text-muted-foreground"
            onClick={() => fetchData()}
            disabled={isLoading}
          >
            <RefreshCcw
              className={cn("h-4 w-4", isLoading && "animate-spin")}
            />
          </Button>
          <div className="flex items-center gap-1 bg-accent p-1 rounded-lg border border-border">
            <Button
              size="sm"
              variant={filterMode === "current" && statusFilter === "all" ? "default" : "ghost"}
              className={cn(
                "h-7 px-4 text-xs font-medium rounded-md",
                filterMode === "current" && statusFilter === "all"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground",
              )}
              onClick={() => {
                setFilterMode("current");
                setStatusFilter("all");
              }}
            >
              Актуальные
            </Button>
            <Button
              size="sm"
              variant={filterMode === "all" && statusFilter === "all" ? "default" : "ghost"}
              className={cn(
                "h-7 px-4 text-xs font-medium rounded-md",
                filterMode === "all" && statusFilter === "all"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground",
              )}
              onClick={() => {
                setFilterMode("all");
                setStatusFilter("all");
              }}
            >
              План месяца
            </Button>
          </div>
        </div>
      </div>

      {hasComponentTasks && (
        <div className="flex items-center gap-1 bg-accent p-1 rounded-lg border border-border w-fit">
          <Button
            size="sm"
            variant={activeCategory === "equipment" ? "default" : "ghost"}
            className={cn(
              "h-8 px-4 text-xs font-semibold rounded-md",
              activeCategory === "equipment"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setActiveCategory("equipment")}
          >
            Оборудование
          </Button>
          <Button
            size="sm"
            variant={activeCategory === "components" ? "default" : "ghost"}
            className={cn(
              "h-8 px-4 text-xs font-semibold rounded-md",
              activeCategory === "components"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setActiveCategory("components")}
          >
            Комплектующие
          </Button>
        </div>
      )}

      {apiStats && (
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 bg-accent/10">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                  План на месяц
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Выполнено по плану текущего месяца
                </p>
              </div>
              <div className="flex flex-col items-start md:items-end gap-1.5">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-emerald-500">
                    {apiStats.month_completed_count}
                  </span>
                  <span className="text-sm font-medium text-muted-foreground">
                    / {apiStats.month_plan_count}
                  </span>
                  <span className="text-sm font-bold text-emerald-500 ml-1.5">
                    {Math.round(apiStats.raw_efficiency || 0)}%
                  </span>
                </div>
                <Progress
                  value={apiStats.raw_efficiency || 0}
                  className="h-1.5 w-36 bg-muted rounded-full overflow-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-border">
              <div
                className={cn(
                  "p-4 md:p-5 transition-all cursor-pointer select-none",
                  statusFilter === "overdue"
                    ? "bg-rose-500/15 ring-2 ring-inset ring-rose-500"
                    : (apiStats?.overdue_count || 0) > 0
                      ? "bg-rose-500/5 hover:bg-rose-500/10"
                      : "bg-transparent hover:bg-accent/20",
                )}
                onClick={() => setStatusFilter((prev) => (prev === "overdue" ? "all" : "overdue"))}
                title="Нажмите, чтобы отфильтровать просроченные задачи"
              >
                <div className="flex items-center justify-between mb-2">
                  <p
                    className={cn(
                      "text-[10px] font-semibold uppercase tracking-widest",
                      (apiStats?.overdue_count || 0) > 0 || statusFilter === "overdue"
                        ? "text-rose-500"
                        : "text-muted-foreground",
                    )}
                  >
                    Просрочено
                  </p>
                  <AlertCircle
                    className={cn(
                      "h-4 w-4",
                      (apiStats?.overdue_count || 0) > 0 || statusFilter === "overdue"
                        ? "text-rose-500 opacity-70"
                        : "text-muted-foreground opacity-30",
                    )}
                  />
                </div>
                <p
                  className={cn(
                    "text-2xl font-bold",
                    (apiStats?.overdue_count || 0) > 0 || statusFilter === "overdue"
                      ? "text-rose-500"
                      : "text-foreground",
                  )}
                >
                  {apiStats?.overdue_count || 0}
                </p>
              </div>

              <div
                className={cn(
                  "p-4 md:p-5 transition-all cursor-pointer select-none",
                  statusFilter === "today"
                    ? "bg-blue-500/15 ring-2 ring-inset ring-blue-500"
                    : (apiStats?.due_today_count || 0) > 0
                      ? "bg-blue-500/5 hover:bg-blue-500/10"
                      : "bg-transparent hover:bg-accent/20",
                )}
                onClick={() => setStatusFilter((prev) => (prev === "today" ? "all" : "today"))}
                title="Нажмите, чтобы отфильтровать задачи на сегодня"
              >
                <div className="flex items-center justify-between mb-2">
                  <p
                    className={cn(
                      "text-[10px] font-semibold uppercase tracking-widest",
                      (apiStats?.due_today_count || 0) > 0 || statusFilter === "today"
                        ? "text-blue-500"
                        : "text-muted-foreground",
                    )}
                  >
                    На сегодня
                  </p>
                  <Clock
                    className={cn(
                      "h-4 w-4",
                      (apiStats?.due_today_count || 0) > 0 || statusFilter === "today"
                        ? "text-blue-500 opacity-70"
                        : "text-muted-foreground opacity-30",
                    )}
                  />
                </div>
                <p
                  className={cn(
                    "text-2xl font-bold",
                    (apiStats?.due_today_count || 0) > 0 || statusFilter === "today"
                      ? "text-blue-500"
                      : "text-foreground",
                  )}
                >
                  {apiStats?.due_today_count || 0}
                </p>
              </div>

              <div
                className={cn(
                  "p-4 md:p-5 transition-all cursor-pointer select-none",
                  statusFilter === "in_progress"
                    ? "bg-primary/15 ring-2 ring-inset ring-primary"
                    : (apiStats?.in_progress_count || 0) > 0
                      ? "bg-primary/5 hover:bg-primary/10"
                      : "bg-transparent hover:bg-accent/20",
                )}
                onClick={() => setStatusFilter((prev) => (prev === "in_progress" ? "all" : "in_progress"))}
                title="Нажмите, чтобы отфильтровать задачи в работе"
              >
                <div className="flex items-center justify-between mb-2">
                  <p
                    className={cn(
                      "text-[10px] font-semibold uppercase tracking-widest",
                      (apiStats?.in_progress_count || 0) > 0 || statusFilter === "in_progress"
                        ? "text-primary"
                        : "text-muted-foreground",
                    )}
                  >
                    В работе
                  </p>
                  <Play
                    className={cn(
                      "h-4 w-4 ml-0.5",
                      (apiStats?.in_progress_count || 0) > 0 || statusFilter === "in_progress"
                        ? "text-primary opacity-70"
                        : "text-muted-foreground opacity-30",
                    )}
                  />
                </div>
                <div className="flex flex-col gap-1 items-start">
                  <p
                    className={cn(
                      "text-2xl font-bold leading-none",
                      (apiStats?.in_progress_count || 0) > 0 || statusFilter === "in_progress"
                        ? "text-primary"
                        : "text-foreground",
                    )}
                  >
                    {apiStats?.in_progress_count || 0}
                  </p>
                  {(apiStats?.rework_count || 0) > 0 && (
                    <span className="text-[11px] font-semibold text-rose-500">
                      Доработка: {apiStats?.rework_count}
                    </span>
                  )}
                </div>
              </div>

              <div
                className={cn(
                  "p-4 md:p-5 transition-all cursor-pointer select-none",
                  statusFilter === "completed"
                    ? "bg-emerald-500/15 ring-2 ring-inset ring-emerald-500"
                    : "bg-emerald-500/5 hover:bg-emerald-500/10",
                )}
                onClick={() => setStatusFilter((prev) => (prev === "completed" ? "all" : "completed"))}
                title="Нажмите, чтобы отфильтровать выполненные задачи"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-500">
                    Закрыто
                  </p>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 opacity-70" />
                </div>
                <div className="flex flex-col gap-1 items-start">
                  <p className="text-2xl font-bold text-emerald-500 leading-none">
                    {apiStats?.month_completed_count || 0}
                  </p>
                  {(apiStats?.old_debt_closed_count || 0) > 0 && (
                    <span
                      className="text-[11px] font-semibold text-emerald-600"
                      title="Закрыт старый долг"
                    >
                      +{apiStats?.old_debt_closed_count} долг
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {statusFilter !== "all" && (
            <div className="flex items-center justify-between h-9 px-3.5 rounded-lg bg-accent/40 border border-border/70 text-xs">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full shrink-0",
                    statusFilter === "overdue" && "bg-rose-500",
                    statusFilter === "today" && "bg-blue-500",
                    statusFilter === "in_progress" && "bg-primary",
                    statusFilter === "completed" && "bg-emerald-500",
                  )}
                />
                <span className="text-muted-foreground">Фильтр:</span>
                <span className="font-semibold text-foreground">
                  {statusFilter === "overdue" && "Просрочено"}
                  {statusFilter === "today" && "На сегодня"}
                  {statusFilter === "in_progress" && "В работе"}
                  {statusFilter === "completed" && "Закрыто"}
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-background/80 rounded flex items-center gap-1.5"
                onClick={() => setStatusFilter("all")}
              >
                <span>Сбросить</span>
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className={cn(
          "grid gap-8 items-start",
          isModalMode ? "grid-cols-1 max-w-4xl mx-auto" : "grid-cols-1 lg:grid-cols-[1fr_320px]"
        )}>
          <div className="space-y-10">
            {groupedTasks.length === 0 ? (
              <div className="text-center py-20 bg-card rounded-xl border border-border">
                <div className="h-20 w-20 bg-accent rounded-xl flex items-center justify-center mx-auto mb-4 text-emerald-500">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
                <h3 className="text-lg font-bold">
                  {statusFilter === "today"
                    ? "Нет задач на сегодня"
                    : statusFilter === "overdue"
                      ? "Нет просроченных задач"
                      : statusFilter === "in_progress"
                        ? "Нет задач в работе"
                        : statusFilter === "completed"
                          ? "Нет выполненных задач"
                          : filterMode === "current"
                            ? "Нет актуальных задач"
                            : "Нет задач на месяц"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {statusFilter !== "all"
                    ? "По выбранному фильтру задачи не найдены. Вы можете сбросить фильтр."
                    : filterMode === "current"
                      ? "Все текущие задачи выполнены. Можно отдохнуть или взять свободную задачу."
                      : "На данный момент у вас нет назначенных задач."}
                </p>
                {statusFilter !== "all" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 text-xs font-medium"
                    onClick={() => setStatusFilter("all")}
                  >
                    Показать все актуальные
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid gap-10">
                {groupedTasks.map(([location, groupTasks]) => (
                  <div key={location} className="space-y-4">
                    <div className="flex items-center justify-between border-b border-border/60 pb-2">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                        {location}
                      </h3>
                      <span className="text-sm font-bold text-muted-foreground/80">
                        {groupTasks.length}
                      </span>
                    </div>
                    <div className="grid gap-3">
                      {groupTasks.map((task) =>
                        renderTaskCard(task, false, true),
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {groupedFreeTasks.length > 0 && (
              <div className="space-y-10 pt-8 border-t border-border mt-12">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold tracking-tight text-muted-foreground">
                    Свободные задачи
                  </h2>
                  <Badge
                    variant="outline"
                    className="text-muted-foreground border-border"
                  >
                    {filteredFreeTasksCount} доступно
                  </Badge>
                </div>
                <div className="grid gap-10">
                  {groupedFreeTasks.map(([location, groupTasks]) => (
                    <div
                      key={`free-${location}`}
                      className="space-y-4 opacity-80 hover:opacity-100 transition-opacity"
                    >
                      <div className="flex items-center justify-between border-b border-border/60 pb-2">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                          {location}
                        </h3>
                        <span className="text-sm font-bold text-muted-foreground/70">
                          {groupTasks.length}
                        </span>
                      </div>
                      <div className="grid gap-3">
                        {groupTasks.map((task) =>
                          renderTaskCard(task, true, true),
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Terminal Sidebar */}
          {!isModalMode && (
            <div className="hidden lg:block sticky top-24 space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <Card className="bg-zinc-950 border-zinc-800 shadow-2xl overflow-hidden rounded-xl">
                <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
                  <div className="flex items-center gap-4">
                    <div>
                      <h3 className="text-sm font-bold text-white tracking-tight">
                        Обслуживание
                      </h3>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black">
                        Сессия через QR
                      </p>
                    </div>
                  </div>
                </div>
                <CardContent className="p-8">
                  <div className="space-y-8">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">
                        Выбрано устройств:
                      </span>
                      <span className="text-xs font-mono font-black text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
                        {String(inProgressTaskIds.length).padStart(2, "0")}
                      </span>
                    </div>

                    {inProgressTotalTime > 0 && (
                      <div className="flex items-center justify-between px-1">
                        <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">
                          Общее время:
                        </span>
                        <span className="text-xs font-mono font-black text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
                          {inProgressTotalTime} мин.
                        </span>
                      </div>
                    )}

                    {sessionId ? (
                      <div className="space-y-8 py-2 animate-in zoom-in-95 duration-500">
                        <div className="bg-white p-5 rounded-xl flex items-center justify-center shadow-[0_0_50px_rgba(16,185,129,0.1)] border-4 border-zinc-900">
                          <QRCode value={terminalUrl} size={180} />
                        </div>
                        <div className="text-center space-y-3">
                          <p className="text-xs font-black text-emerald-500 uppercase tracking-widest italic">
                            Готов к сканированию
                          </p>
                          <p className="text-[11px] text-zinc-500 leading-relaxed font-medium">
                            Отсканируйте камерой телефона для запуска пошагового
                            мастера обслуживания
                          </p>
                        </div>

                        {selectedTaskIds.length > 0 && (
                          <Button
                            className="w-full h-12 rounded-lg bg-primary text-primary-foreground font-black uppercase italic tracking-tighter shadow-lg transition-all active:scale-[0.98]"
                            onClick={() => createSession(selectedTaskIds)}
                            disabled={isCreatingSession}
                          >
                            {isCreatingSession ? (
                              <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                              <>
                                Добавить выбранные ({selectedTaskIds.length})
                                <ChevronRight className="ml-2 h-5 w-5" />
                              </>
                            )}
                          </Button>
                        )}

                        <Button
                          className="w-full h-12 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase italic tracking-tighter shadow-lg transition-all active:scale-[0.98]"
                          onClick={() => window.open(terminalUrl, "_blank")}
                        >
                          Открыть в браузере
                          <ChevronRight className="ml-2 h-5 w-5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="py-4 text-center space-y-8">
                        <div className="h-20 w-20 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center mx-auto text-zinc-600 shadow-inner">
                          <QrIcon className="h-10 w-10" />
                        </div>
                        <div className="space-y-3 px-2">
                          <p className="text-xs text-zinc-400 font-bold leading-relaxed">
                            Нажмите кнопку ниже, чтобы сгенерировать QR-код для
                            продолжения на телефоне
                          </p>
                        </div>
                        <Button
                          className="w-full h-12 rounded-lg bg-zinc-100 text-zinc-950 hover:bg-white font-black uppercase italic tracking-tighter shadow-2xl transition-all active:scale-[0.98]"
                          onClick={handleCreateTerminalSession}
                          disabled={
                            (selectedTaskIds.length === 0 &&
                              inProgressTaskIds.length === 0) ||
                            isCreatingSession
                          }
                        >
                          {isCreatingSession ? (
                            <Loader2 className="h-6 w-6 animate-spin" />
                          ) : (
                            <>
                              {selectedTaskIds.length > 0
                                ? "Начать обслуживание"
                                : "Создать QR-код"}
                              <ChevronRight className="ml-2 h-6 w-6" />
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="p-4 sm:p-5 rounded-xl bg-zinc-900/50 border border-zinc-800 shadow-sm">
                <p className="text-[11px] text-zinc-500 leading-relaxed font-medium">
                  Мобильный терминал позволяет загружать фотографии и отчеты
                  <span className="text-zinc-300 font-bold ml-1">
                    прямо с места обслуживания
                  </span>
                  . Рекомендуется использовать смартфон.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Floating Bulk Action Bar */}
      {selectedTaskIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4 animate-in slide-in-from-bottom-5 duration-300">
          <div className="bg-zinc-950/95 backdrop-blur-xl border border-zinc-800 rounded-xl p-3.5 sm:px-5 flex flex-col sm:flex-row items-center gap-4 justify-between shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <div className="flex flex-col text-center sm:text-left shrink-0">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                Массовые действия
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm font-bold text-white">
                  Выбрано задач: {selectedTaskIds.length}
                </span>
                {selectedTotalTime > 0 && (
                  <span className="text-xs text-zinc-400 font-medium">
                    • {selectedTotalTime} мин.
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center justify-center sm:justify-end gap-2 w-full sm:w-auto flex-wrap sm:flex-nowrap shrink-0">
              <Button
                variant="outline"
                className="h-9 px-3.5 rounded-lg border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900 text-xs font-semibold transition-all"
                onClick={() => setSelectedTaskIds([])}
              >
                Отмена
              </Button>
              
              <Button
                className="h-9 px-4 rounded-lg bg-primary hover:bg-primary/95 text-primary-foreground text-xs font-semibold transition-all flex items-center gap-1.5 shadow-md active:scale-[0.98]"
                onClick={handleBulkStart}
                disabled={isBulkUpdating}
              >
                {isBulkUpdating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5 fill-current" />
                    Взять в работу
                  </>
                )}
              </Button>
              
              {!isModalMode && (
                <Button
                  className="h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all flex items-center gap-1.5 shadow-md active:scale-[0.98]"
                  onClick={() => createSession(selectedTaskIds)}
                  disabled={isCreatingSession}
                >
                  {isCreatingSession ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <QrIcon className="h-3.5 w-3.5" />
                      QR-обслуживание
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {!isModalMode && isMobile && selectedTaskIds.length === 0 && sessionId && (
        <div className="fixed bottom-6 left-4 right-4 z-50 animate-in slide-in-from-bottom-10 duration-500">
          <Button
            className="w-full h-12 rounded-lg bg-primary text-primary-foreground font-black uppercase italic tracking-tighter shadow-[0_20px_50px_rgba(0,0,0,0.5)] active:scale-[0.98] transition-all border border-white/10"
            onClick={() => {
              if (sessionId) {
                window.open(terminalUrl, "_self");
              }
            }}
            disabled={isCreatingSession}
          >
            Продолжить обслуживание
            <ChevronRight className="ml-2 h-6 w-6" />
          </Button>
        </div>
      )}

      {/* Premium Inline Task Completion Dialog Modal */}
      <Dialog
        open={!!selectedTaskForModal}
        onOpenChange={(open) => {
          if (!open && !isSubmittingTask) setSelectedTaskForModal(null);
        }}
      >
        <DialogContent className="max-w-4xl bg-zinc-950 border-zinc-900 text-zinc-100 p-0 overflow-hidden rounded-xl shadow-2xl">
          <DialogTitle className="sr-only">
            Выполнение задачи {modalTaskDetails?.equipment?.name || ""}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Детальная информация о задаче обслуживания оборудования с инструкцией и формой загрузки отчета.
          </DialogDescription>
          {isModalDetailsLoading ? (
            <div className="h-[550px] flex flex-col items-center justify-center gap-4 bg-zinc-950">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-zinc-400 font-black text-xs uppercase tracking-widest animate-pulse">
                Загрузка деталей задачи...
              </p>
            </div>
          ) : modalTaskDetails ? (
            <div className="flex flex-col h-[650px] max-h-[85vh] overflow-hidden">
              {/* Modal Header */}
              <div className="p-6 border-b border-zinc-900 bg-zinc-900/30 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black tracking-tight text-white">
                      {modalTaskDetails.equipment.name}
                    </h3>
                    <Badge className="bg-primary/10 text-primary border-primary/20 font-black uppercase text-[9px] tracking-tighter">
                      {modalTaskDetails.equipment.type_name || modalTaskDetails.equipment.type}
                    </Badge>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1.5 font-bold">
                    <MapPin className="h-3 w-3 text-zinc-500" />
                    {modalTaskDetails.equipment.workstation_name || "Склад"}
                  </p>
                </div>
              </div>

              {/* Modal Two-Column Body */}
              <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-zinc-900">
                {/* Left Column: Metadata and Instructions */}
                <div className="p-6 space-y-6 overflow-y-auto">
                  {/* Equipment Metadata */}
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Информация об устройстве</h4>
                    <div className={cn(
                      "grid gap-3 bg-zinc-900/20 border border-zinc-900 rounded-xl p-4",
                      modalTaskDetails.equipment.cleaning_time_minutes ? "grid-cols-3" : "grid-cols-2"
                    )}>
                      <div>
                        <span className="text-[9px] font-bold text-zinc-500 block uppercase">Бренд / Модель</span>
                        <span className="text-sm font-extrabold text-zinc-200 truncate block" title={`${modalTaskDetails.equipment.brand || "—"} / ${modalTaskDetails.equipment.model || "—"}`}>
                          {modalTaskDetails.equipment.brand || "—"} / {modalTaskDetails.equipment.model || "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-zinc-500 block uppercase">Идентификатор</span>
                        <span className="text-sm font-mono font-extrabold text-zinc-200 truncate block">
                          {modalTaskDetails.equipment.identifier || "—"}
                        </span>
                      </div>
                      {modalTaskDetails.equipment.cleaning_time_minutes && (
                        <div>
                          <span className="text-[9px] font-bold text-zinc-500 block uppercase">Время на чистку</span>
                          <span className="text-sm font-extrabold text-emerald-500 flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {modalTaskDetails.equipment.cleaning_time_minutes} мин.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Rejection comment if status is REWORK */}
                  {modalTaskDetails.task.status === "REWORK" && (
                    <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 space-y-2">
                      <div className="flex items-center gap-2 text-rose-400">
                        <AlertTriangle className="h-4 w-4" />
                        <h5 className="text-[10px] font-black uppercase tracking-widest">Причина возврата</h5>
                      </div>
                      <p className="text-xs text-rose-300 font-medium italic leading-relaxed">
                        "{modalTaskDetails.task.rejection_reason || modalTaskDetails.task.latest_rejection?.note || "Требуется доработка"}"
                      </p>
                    </div>
                  )}

                  {/* Instructions */}
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                      <Info className="h-3.5 w-3.5" />
                      Инструкция по обслуживанию
                    </h4>
                    <div className="bg-zinc-900/20 border border-zinc-900 rounded-xl p-5 space-y-4">
                      {(() => {
                        const instData = modalTaskDetails.instructions?.instructions !== undefined 
                          ? modalTaskDetails.instructions.instructions 
                          : modalTaskDetails.instructions;
                        
                        if (Array.isArray(instData) && instData.length > 0) {
                          return (
                            <ol className="space-y-3 list-decimal list-inside text-xs text-zinc-300 font-medium">
                              {instData.map((step: any, idx: number) => (
                                <li key={idx} className="leading-relaxed">
                                  {typeof step === "string" ? step : step.text || step.description}
                                </li>
                              ))}
                            </ol>
                          );
                        }
                        
                        if (typeof instData === "string" && instData.trim()) {
                          try {
                            const parsed = JSON.parse(instData);
                            if (Array.isArray(parsed) && parsed.length > 0) {
                              return (
                                <ol className="space-y-3 list-decimal list-inside text-xs text-zinc-300 font-medium">
                                  {parsed.map((step: any, idx: number) => (
                                    <li key={idx} className="leading-relaxed">
                                      {typeof step === "string" ? step : step.text || step.description}
                                    </li>
                                  ))}
                                </ol>
                              );
                            }
                          } catch (e) {
                            // not json, just text
                          }
                          return (
                            <div 
                              className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed font-medium prose prose-invert prose-p:my-1 prose-strong:text-zinc-200"
                              dangerouslySetInnerHTML={{ __html: instData }}
                            />
                          );
                        }
                        
                        return (
                          <p className="text-xs text-zinc-500 italic">
                            Инструкции по регламенту отсутствуют для данного типа устройств.
                          </p>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Right Column: Execution Form */}
                <div className="p-6 space-y-6 overflow-y-auto bg-zinc-950/40">
                  {modalTaskDetails.task.status === "PENDING" ? (
                    /* Initial Pending Screen: Start Button */
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-6 py-12">
                      <div className="h-16 w-16 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-center text-primary shadow-[0_0_30px_rgba(235,94,40,0.05)]">
                        <Wrench className="h-8 w-8 animate-pulse" />
                      </div>
                      <div className="space-y-2 max-w-sm">
                        <h4 className="text-sm font-black text-white uppercase tracking-tight">Обслуживание не начато</h4>
                        <p className="text-xs text-zinc-400 leading-relaxed font-medium">
                          Нажмите кнопку ниже, чтобы перевести задачу в статус выполнения. Это закрепит задачу за вами.
                        </p>
                      </div>
                      <Button
                        className="w-full max-w-xs h-12 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-tight shadow-lg transition-all active:scale-[0.98] text-xs flex items-center justify-center gap-2"
                        onClick={handleStartTask}
                      >
                        <Play className="h-4 w-4 fill-current" />
                        Взять в работу
                      </Button>
                    </div>
                  ) : (
                    /* In Progress Form */
                    <div className="space-y-6">
                      {/* Photo Before Upload */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                            Фото "ДО" {modalTaskDetails.settings.require_photo_before && <span className="text-rose-500">*</span>}
                          </label>
                          <span className="text-[10px] text-zinc-500 font-bold">
                            мин: {modalTaskDetails.settings.min_photos_before}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2">
                          {photosBefore.map((url, idx) => (
                            <div key={idx} className="relative group aspect-square bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-inner">
                              <img src={url} alt="ДО" className="w-full h-full object-cover" />
                              <button
                                type="button"
                                className="absolute top-1 right-1 h-6 w-6 bg-zinc-950/80 border border-zinc-800 rounded-full flex items-center justify-center text-rose-500 hover:bg-zinc-950 transition-all opacity-0 group-hover:opacity-100 shadow-md"
                                onClick={() => removePhoto(idx, "BEFORE")}
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                          
                          {photosBefore.length < 3 && (
                            <label className="relative flex flex-col items-center justify-center aspect-square border border-dashed border-zinc-800 hover:border-zinc-700 bg-zinc-900/20 hover:bg-zinc-900/40 rounded-xl cursor-pointer transition-all group">
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={(e) => handlePhotoUpload(e, "BEFORE")}
                                disabled={isUploadingBefore}
                              />
                              {isUploadingBefore ? (
                                <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
                              ) : (
                                <>
                                  <Upload className="h-5 w-5 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                                  <span className="text-[9px] text-zinc-600 font-black uppercase mt-2 group-hover:text-zinc-400 transition-colors">Загрузить</span>
                                </>
                              )}
                            </label>
                          )}
                        </div>
                      </div>

                      {/* Photo After Upload */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                            Фото "ПОСЛЕ" {modalTaskDetails.settings.require_photo_after && <span className="text-rose-500">*</span>}
                          </label>
                          <span className="text-[10px] text-zinc-500 font-bold">
                            мин: {modalTaskDetails.settings.min_photos_after}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2">
                          {photosAfter.map((url, idx) => (
                            <div key={idx} className="relative group aspect-square bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-inner">
                              <img src={url} alt="ПОСЛЕ" className="w-full h-full object-cover" />
                              <button
                                type="button"
                                className="absolute top-1 right-1 h-6 w-6 bg-zinc-950/80 border border-zinc-800 rounded-full flex items-center justify-center text-rose-500 hover:bg-zinc-950 transition-all opacity-0 group-hover:opacity-100 shadow-md"
                                onClick={() => removePhoto(idx, "AFTER")}
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                          
                          {photosAfter.length < 3 && (
                            <label className="relative flex flex-col items-center justify-center aspect-square border border-dashed border-zinc-800 hover:border-zinc-700 bg-zinc-900/20 hover:bg-zinc-900/40 rounded-xl cursor-pointer transition-all group">
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={(e) => handlePhotoUpload(e, "AFTER")}
                                disabled={isUploadingAfter}
                              />
                              {isUploadingAfter ? (
                                <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
                              ) : (
                                <>
                                  <Upload className="h-5 w-5 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                                  <span className="text-[9px] text-zinc-600 font-black uppercase mt-2 group-hover:text-zinc-400 transition-colors">Загрузить</span>
                                </>
                              )}
                            </label>
                          )}
                        </div>
                      </div>

                      {/* Status Selector */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Результат проверки</label>
                        <div className="grid grid-cols-3 gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={completionStatus === "OK" ? "default" : "outline"}
                            className={cn(
                              "h-11 rounded-xl text-xs font-black uppercase tracking-tight transition-all",
                              completionStatus === "OK" 
                                ? "bg-emerald-600 hover:bg-emerald-500 text-white border-none shadow-md" 
                                : "border-zinc-800 text-zinc-400 hover:bg-zinc-900"
                            )}
                            onClick={() => setCompletionStatus("OK")}
                          >
                            <Check className="h-3.5 w-3.5 mr-1" />
                            ОК
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={completionStatus === "ISSUE" ? "default" : "outline"}
                            className={cn(
                              "h-11 rounded-xl text-xs font-black uppercase tracking-tight transition-all",
                              completionStatus === "ISSUE" 
                                ? "bg-rose-600 hover:bg-rose-500 text-white border-none shadow-md" 
                                : "border-zinc-800 text-zinc-400 hover:bg-zinc-900"
                            )}
                            onClick={() => setCompletionStatus("ISSUE")}
                          >
                            <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                            Поломка
                          </Button>
                          {isLaundryEquipmentType(modalTaskDetails.equipment.type) && (
                            <Button
                              type="button"
                              size="sm"
                              variant={completionStatus === "LAUNDRY" ? "default" : "outline"}
                              className={cn(
                                "h-11 rounded-xl text-xs font-black uppercase tracking-tight transition-all",
                                completionStatus === "LAUNDRY" 
                                  ? "bg-blue-600 hover:bg-blue-500 text-white border-none shadow-md" 
                                  : "border-zinc-800 text-zinc-400 hover:bg-zinc-900"
                              )}
                              onClick={() => setCompletionStatus("LAUNDRY")}
                            >
                              <Wrench className="h-3.5 w-3.5 mr-1" />
                              Стирка
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Incident / Laundry Details */}
                      {(completionStatus === "ISSUE" || completionStatus === "LAUNDRY") && (
                        <div className="space-y-3 p-4 bg-zinc-900/30 border border-zinc-900 rounded-xl animate-in slide-in-from-top-2 duration-300">
                          <div className="space-y-2">
                            <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block">
                              Тема {completionStatus === "LAUNDRY" ? "стирки" : "инцидента"} <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={issueTitle}
                              onChange={(e) => setIssueTitle(e.target.value)}
                              placeholder={completionStatus === "LAUNDRY" ? "Грязный / С пятнами" : "Залипает левый Shift"}
                              className="w-full h-11 px-4 bg-zinc-900/80 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-600 focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all font-semibold outline-none"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block">Описание (необязательно)</label>
                            <textarea
                              value={issueDescription}
                              onChange={(e) => setIssueDescription(e.target.value)}
                              placeholder="Опишите детали неисправности..."
                              rows={2}
                              className="w-full p-4 bg-zinc-900/80 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-600 focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all font-medium outline-none resize-none"
                            />
                          </div>
                        </div>
                      )}

                      {/* Comment Input */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                          Комментарий {modalTaskDetails.settings.require_notes_on_completion && <span className="text-rose-500">*</span>}
                        </label>
                        <textarea
                          value={completionNotes}
                          onChange={(e) => setCompletionNotes(e.target.value)}
                          placeholder="Что было сделано или замечено при чистке..."
                          rows={3}
                          className="w-full p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-600 focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all font-medium outline-none resize-none"
                        />
                      </div>

                      {/* Complete Submit Button */}
                      <Button
                        className="w-full h-12 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase text-xs tracking-wider shadow-lg shadow-emerald-950/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 border-none mt-2"
                        onClick={handleCompleteTask}
                        disabled={isSubmittingTask}
                      >
                        {isSubmittingTask ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Сохранение...
                          </>
                        ) : (
                          <>
                            <Check className="h-4 w-4 stroke-[3px]" />
                            Завершить обслуживание
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Toast Notification */}
      {successToast.show && (
        <div className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-[100] animate-in fade-in slide-in-from-bottom-5 duration-300 flex items-center gap-3 w-80 md:w-96 p-4 rounded-xl bg-zinc-950/90 backdrop-blur-xl border border-emerald-500/20 shadow-2xl shadow-emerald-950/10">
          <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 animate-bounce" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-white">Успешно!</h4>
            <p className="text-xs text-zinc-400 mt-0.5">{successToast.message}</p>
          </div>
          <button 
            onClick={() => setSuccessToast((prev) => ({ ...prev, show: false }))}
            className="flex-shrink-0 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 rounded-lg p-1.5 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function EmployeeTasksPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center">
          <Loader2 className="animate-spin" />
        </div>
      }
    >
      <EmployeeTasksContent />
    </Suspense>
  );
}
