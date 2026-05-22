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
  optimizeFileBeforeUpload,
} from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { QRCode } from "@/components/qr/QRCode";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface MaintenanceTask {
  id: string;
  equipment_id: string;
  equipment_name: string;
  equipment_type: string;
  equipment_type_name: string;
  workstation_name?: string;
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
  due_date: normalizeDateKey(task?.due_date),
  status: normalizeStatus(task?.status) as MaintenanceTask["status"],
  verification_status: task?.verification_status
    ? normalizeStatus(task.verification_status)
    : task?.verification_status,
  session_id: task?.session_id,
  verified_by_name: task?.verified_by_name,
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

  // Mobile Terminal State
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

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
          setCompletionNotes(data.task.notes || "");
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
      const urls = await Promise.all(
        files.map(async (file) => {
          const optimized = await optimizeFileBeforeUpload(file, { maxDimension: 1200, quality: 0.82 });
          const formData = new FormData();
          formData.append("file", optimized);
          const res = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });
          if (res.ok) {
            const data = await res.json();
            return data.url;
          }
          return null;
        })
      );

      const validUrls = urls.filter(Boolean) as string[];
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
      const res = await fetch(`/api/clubs/${clubId}/equipment/maintenance/${selectedTaskForModal}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "IN_PROGRESS" }),
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
      // 1. Submit completion
      const completeRes = await fetch(`/api/clubs/${clubId}/equipment/maintenance/${selectedTaskForModal}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photos_before: photosBefore,
          photos_after: photosAfter,
          photos: [...photosBefore, ...photosAfter], // ensure standard photo lists are filled
          notes: completionNotes,
        }),
      });

      if (!completeRes.ok) {
        const errData = await completeRes.json();
        throw new Error(errData.error || "Ошибка при завершении задачи");
      }

      // 2. Submit issue or laundry if selected
      const equipmentId = modalTaskDetails.equipment.id;
      if (completionStatus === "ISSUE") {
        const issueRes = await fetch(`/api/clubs/${clubId}/equipment/${equipmentId}/issues`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: issueTitle,
            description: issueDescription || null,
            severity: "MEDIUM",
            maintenance_task_id: selectedTaskForModal,
          }),
        });
        if (!issueRes.ok) {
          console.error("Failed to create issue automatically");
        }
      } else if (completionStatus === "LAUNDRY") {
        const laundryRes = await fetch(`/api/clubs/${clubId}/laundry`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            equipment_id: equipmentId,
            maintenance_task_id: selectedTaskForModal,
            title: issueTitle,
            description: issueDescription || null,
            photos: photosAfter,
            source: "EMPLOYEE_SERVICE",
          }),
        });
        if (!laundryRes.ok) {
          console.error("Failed to create laundry request automatically");
        }
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

  const handleCreateTerminalSession = () => {
    const idsToStart =
      selectedTaskIds.length > 0 ? selectedTaskIds : inProgressTaskIds;
    createSession(idsToStart);
  };

  const groupedTasks = useMemo(() => {
    const groups: Record<string, MaintenanceTask[]> = {};
    const todayStr = formatDateKeyInTimezone(new Date(), clubTimezone);

    tasks.forEach((task) => {
      if (filterMode === "current") {
        const isOverdue = task.status === "PENDING" && task.due_date < todayStr;
        const isTodayTask =
          task.status === "PENDING" && task.due_date === todayStr;
        const isInProgress = task.status === "IN_PROGRESS";
        const isRework = task.status === "REWORK";
        if (!isOverdue && !isTodayTask && !isInProgress && !isRework) return;
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
  }, [tasks, filterMode, clubTimezone]);

  const groupedFreeTasks = useMemo(() => {
    const groups: Record<string, MaintenanceTask[]> = {};

    freeTasks.forEach((task) => {
      const location = task.workstation_name || "Склад";
      if (!groups[location]) groups[location] = [];
      groups[location].push(task);
    });

    return Object.entries(groups).sort(([a], [b]) => {
      if (a === "Склад") return -1;
      if (b === "Склад") return 1;
      return a.localeCompare(b);
    });
  }, [freeTasks]);

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
          if (isFree || showAsCompleted) return;
          if (isModalMode) {
            setSelectedTaskForModal(task.id);
          } else {
            toggleTaskSelection(task.id);
          }
        }}
      >
        <CardContent className="p-0">
          <div className="flex items-stretch min-h-[72px]">
            {/* Status Indicator Bar */}
            <div
              className={cn(
                "w-1.5 transition-all shrink-0",
                isSelected
                  ? isMobile
                    ? "bg-white w-2"
                    : "bg-primary w-2"
                  : isRejected
                    ? "bg-rose-500"
                    : isCompleted
                      ? "bg-emerald-500"
                      : isFuture
                        ? "bg-blue-400"
                        : isFree
                          ? "bg-muted-foreground/30"
                          : isOverdue
                            ? "bg-rose-500"
                            : isInProgress
                              ? "bg-primary"
                              : "bg-muted-foreground/20",
              )}
            />

            <div className="flex-1 p-4 flex flex-col gap-3 min-w-0">
              <div className="flex items-start justify-between gap-3 min-w-0">
                <div className="flex items-start gap-4 min-w-0 flex-1">
                  {/* Selection Checkbox - Desktop Only */}
                  {!isMobile &&
                    !isFree &&
                    !showAsCompleted &&
                    !isInCurrentSession &&
                    !isModalMode && (
                      <div className="shrink-0 pt-1">
                        <div
                          className={cn(
                            "h-6 w-6 rounded-md border transition-all flex items-center justify-center",
                            isSelected
                              ? "bg-primary border-primary text-primary-foreground shadow-sm scale-110"
                              : "border-muted-foreground/30 bg-background",
                          )}
                        >
                          {isSelected && (
                            <Check className="h-3.5 w-3.5 stroke-3" />
                          )}
                        </div>
                      </div>
                    )}

                  {/* Text Content */}
                  <div className="min-w-0 flex-1 flex flex-col gap-1 mt-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4
                        className={cn(
                          "font-black text-[15px] leading-tight tracking-tight",
                          showAsCompleted
                            ? "text-muted-foreground"
                            : "text-foreground",
                        )}
                      >
                        {task.equipment_name}
                      </h4>
                      {isRejected && (
                        <Badge
                          variant="destructive"
                          className="h-5 px-2 text-[9px] font-black bg-rose-500 hover:bg-rose-600 uppercase tracking-tighter"
                        >
                          На доработку
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                      <span className="bg-accent/50 text-foreground/70 px-1.5 py-0.5 rounded leading-none">
                        {task.equipment_type_name}
                      </span>
                      {!hideLocation && (
                        <span className="opacity-70">
                          {task.workstation_name || "Склад"}
                        </span>
                      )}
                      {task.last_cleaned_at && (
                        <span className="text-emerald-500 flex items-center gap-1">
                          <Check className="h-3 w-3" />
                          {format(new Date(task.last_cleaned_at), "dd.MM")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Individual Action Button - Hidden only when bulk selection (2+) on mobile */}
                {!(isMobile && selectedTaskIds.length >= 2 && isSelected) && (
                  <div className="shrink-0 self-start pt-1">
                    {isFree ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-9 px-4 rounded-xl font-black bg-accent hover:bg-accent/80 text-foreground text-[11px] transition-all uppercase tracking-tighter"
                        onClick={() => handleClaim(task.id)}
                        disabled={isUpdating === task.id}
                      >
                        {isUpdating === task.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          "Взять"
                        )}
                      </Button>
                    ) : showAsCompleted ? (
                      <div className="flex flex-col items-end justify-center px-2">
                        <span className="text-[9px] font-black text-muted-foreground/50 uppercase tracking-widest">
                          След.
                        </span>
                        <span className="text-sm font-black text-muted-foreground/80">
                          {format(new Date(task.due_date), "dd.MM")}
                        </span>
                      </div>
                    ) : isInCurrentSession && !isModalMode ? (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-10 w-10 p-0 rounded-xl border-zinc-800 hover:bg-zinc-900 text-zinc-400 active:scale-95 transition-all shadow-sm"
                          title="Вернуть из работы"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReturnFromWork(task.id);
                          }}
                          disabled={isUpdating === task.id}
                        >
                          {isUpdating === task.id ? (
                            <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
                          ) : (
                            <Undo2 className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="default"
                          className="h-10 px-4 rounded-xl font-black text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white uppercase tracking-tighter shadow-sm"
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
                      <div className="flex items-center gap-2">
                        {(isInProgress || isRework) && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-10 w-10 p-0 rounded-xl border-zinc-800 hover:bg-zinc-900 text-zinc-400 active:scale-95 transition-all shadow-sm"
                            title="Вернуть из работы"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReturnFromWork(task.id);
                            }}
                            disabled={isUpdating === task.id}
                          >
                            {isUpdating === task.id ? (
                              <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
                            ) : (
                              <Undo2 className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant={
                            isInProgress || isRework ? "default" : "outline"
                          }
                          className={cn(
                            "h-10 px-4 rounded-xl font-black text-[11px] transition-all flex items-center gap-2 uppercase tracking-tighter shadow-sm",
                            isInProgress || isRework
                              ? isRejected
                                ? "bg-rose-500 hover:bg-rose-600 text-white border-none"
                                : "bg-primary text-primary-foreground border-none"
                              : "border-primary/20 text-primary hover:bg-primary/5",
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
                              {sessionId
                                ? "Добавить"
                                : isInProgress || isRework
                                  ? isModalMode
                                    ? "Продолжить"
                                    : isMobile
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

              {/* Rework Comment Box */}
              {isRejected &&
                (task.rejection_reason || task.latest_rejection?.note) && (
                  <div className="bg-rose-500/[0.03] border border-rose-500/10 rounded-2xl p-3 animate-in fade-in slide-in-from-top-1 duration-300">
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
            </div>
          </div>
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
              variant={filterMode === "current" ? "default" : "ghost"}
              className={cn(
                "h-7 px-4 text-xs font-medium rounded-md",
                filterMode === "current"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground",
              )}
              onClick={() => setFilterMode("current")}
            >
              Актуальные
            </Button>
            <Button
              size="sm"
              variant={filterMode === "all" ? "default" : "ghost"}
              className={cn(
                "h-7 px-4 text-xs font-medium rounded-md",
                filterMode === "all"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground",
              )}
              onClick={() => setFilterMode("all")}
            >
              План месяца
            </Button>
          </div>
        </div>
      </div>

      {apiStats && (
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 bg-accent/10">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                План на месяц
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Выполнено по плану текущего месяца
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="text-2xl font-bold text-emerald-500">
                  {apiStats.month_completed_count}
                </span>
                <span className="text-sm font-medium text-muted-foreground ml-1">
                  / {apiStats.month_plan_count}
                </span>
              </div>
              <div className="h-8 w-px bg-border mx-1" />
              <div className="text-right">
                <Badge
                  variant="secondary"
                  className="bg-emerald-500/10 text-emerald-500 font-bold mb-1"
                >
                  {Math.round(apiStats.raw_efficiency || 0)}%
                </Badge>
              </div>
            </div>
          </div>
          <Progress
            value={apiStats.raw_efficiency || 0}
            className="h-1 rounded-none bg-accent"
          />

          <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-border">
            <div
              className={cn(
                "p-4 md:p-5 transition-colors",
                (apiStats?.overdue_count || 0) > 0
                  ? "bg-rose-500/5"
                  : "bg-transparent",
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <p
                  className={cn(
                    "text-[10px] font-semibold uppercase tracking-widest",
                    (apiStats?.overdue_count || 0) > 0
                      ? "text-rose-500"
                      : "text-muted-foreground",
                  )}
                >
                  Просрочено
                </p>
                <AlertCircle
                  className={cn(
                    "h-4 w-4",
                    (apiStats?.overdue_count || 0) > 0
                      ? "text-rose-500 opacity-70"
                      : "text-muted-foreground opacity-30",
                  )}
                />
              </div>
              <p
                className={cn(
                  "text-2xl font-bold",
                  (apiStats?.overdue_count || 0) > 0
                    ? "text-rose-500"
                    : "text-foreground",
                )}
              >
                {apiStats?.overdue_count || 0}
              </p>
            </div>

            <div
              className={cn(
                "p-4 md:p-5 transition-colors",
                (apiStats?.due_today_count || 0) > 0
                  ? "bg-blue-500/5"
                  : "bg-transparent",
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <p
                  className={cn(
                    "text-[10px] font-semibold uppercase tracking-widest",
                    (apiStats?.due_today_count || 0) > 0
                      ? "text-blue-500"
                      : "text-muted-foreground",
                  )}
                >
                  На сегодня
                </p>
                <Clock
                  className={cn(
                    "h-4 w-4",
                    (apiStats?.due_today_count || 0) > 0
                      ? "text-blue-500 opacity-70"
                      : "text-muted-foreground opacity-30",
                  )}
                />
              </div>
              <p
                className={cn(
                  "text-2xl font-bold",
                  (apiStats?.due_today_count || 0) > 0
                    ? "text-blue-500"
                    : "text-foreground",
                )}
              >
                {apiStats?.due_today_count || 0}
              </p>
            </div>

            <div
              className={cn(
                "p-4 md:p-5 transition-colors",
                (apiStats?.in_progress_count || 0) > 0
                  ? "bg-primary/5"
                  : "bg-transparent",
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <p
                  className={cn(
                    "text-[10px] font-semibold uppercase tracking-widest",
                    (apiStats?.in_progress_count || 0) > 0
                      ? "text-primary"
                      : "text-muted-foreground",
                  )}
                >
                  В работе
                </p>
                <Play
                  className={cn(
                    "h-4 w-4 ml-0.5",
                    (apiStats?.in_progress_count || 0) > 0
                      ? "text-primary opacity-70"
                      : "text-muted-foreground opacity-30",
                  )}
                />
              </div>
              <div className="flex flex-col gap-1 items-start">
                <p
                  className={cn(
                    "text-2xl font-bold leading-none",
                    (apiStats?.in_progress_count || 0) > 0
                      ? "text-primary"
                      : "text-foreground",
                  )}
                >
                  {apiStats?.in_progress_count || 0}
                </p>
                {(apiStats?.rework_count || 0) > 0 && (
                  <span className="text-[10px] font-bold text-rose-500 bg-rose-500/10 px-1.5 py-0.5 rounded">
                    Доработка: {apiStats?.rework_count}
                  </span>
                )}
              </div>
            </div>

            <div className="p-4 md:p-5 bg-emerald-500/5">
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
                    className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded"
                    title="Закрыт старый долг"
                  >
                    +{apiStats?.old_debt_closed_count} долг
                  </span>
                )}
              </div>
            </div>
          </div>
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
              <div className="text-center py-20 bg-card rounded-2xl border border-border">
                <div className="h-20 w-20 bg-accent rounded-3xl flex items-center justify-center mx-auto mb-4 text-emerald-500">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
                <h3 className="text-lg font-bold">
                  {filterMode === "current"
                    ? "Нет актуальных задач"
                    : "Нет задач на месяц"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {filterMode === "current"
                    ? "Все текущие задачи выполнены. Можно отдохнуть или взять свободную задачу."
                    : "На данный момент у вас нет назначенных задач."}
                </p>
              </div>
            ) : (
              <div className="grid gap-10">
                {groupedTasks.map(([location, groupTasks]) => (
                  <div key={location} className="space-y-4">
                    <div className="flex items-center gap-3 border-b border-border pb-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                        {location}
                      </h3>
                      <span className="text-xs font-bold text-muted-foreground bg-accent px-2 py-0.5 rounded-full">
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
                    {freeTasks.length} доступно
                  </Badge>
                </div>
                <div className="grid gap-10">
                  {groupedFreeTasks.map(([location, groupTasks]) => (
                    <div
                      key={`free-${location}`}
                      className="space-y-4 opacity-80 hover:opacity-100 transition-opacity"
                    >
                      <div className="flex items-center gap-3 border-b border-border pb-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                          {location}
                        </h3>
                        <span className="text-xs font-bold text-muted-foreground bg-accent px-2 py-0.5 rounded-full">
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
              <Card className="bg-zinc-950 border-zinc-800 shadow-2xl overflow-hidden rounded-[2rem]">
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

                    {sessionId ? (
                      <div className="space-y-8 py-2 animate-in zoom-in-95 duration-500">
                        <div className="bg-white p-5 rounded-[2rem] flex items-center justify-center shadow-[0_0_50px_rgba(16,185,129,0.1)] border-4 border-zinc-900">
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
                            className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-black uppercase italic tracking-tighter shadow-lg transition-all active:scale-[0.98]"
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
                          className="w-full h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase italic tracking-tighter shadow-lg transition-all active:scale-[0.98]"
                          onClick={() => window.open(terminalUrl, "_blank")}
                        >
                          Открыть в браузере
                          <ChevronRight className="ml-2 h-5 w-5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="py-4 text-center space-y-8">
                        <div className="h-20 w-20 bg-zinc-900 border border-zinc-800 rounded-3xl flex items-center justify-center mx-auto text-zinc-600 shadow-inner">
                          <QrIcon className="h-10 w-10" />
                        </div>
                        <div className="space-y-3 px-2">
                          <p className="text-xs text-zinc-400 font-bold leading-relaxed">
                            Нажмите кнопку ниже, чтобы сгенерировать QR-код для
                            продолжения на телефоне
                          </p>
                        </div>
                        <Button
                          className="w-full h-16 rounded-[2rem] bg-zinc-100 text-zinc-950 hover:bg-white font-black uppercase italic tracking-tighter shadow-2xl transition-all active:scale-[0.98]"
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

              <div className="p-6 rounded-[2rem] bg-zinc-900/50 border border-zinc-800 flex gap-4 items-start shadow-sm">
                <div className="h-8 w-8 rounded-2xl bg-zinc-950 border border-zinc-800 text-zinc-400 flex items-center justify-center shrink-0">
                  <Info className="h-4 w-4" />
                </div>
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

      {!isModalMode && isMobile && (selectedTaskIds.length >= 2 || sessionId) && (
        <div className="fixed bottom-6 left-4 right-4 z-50 animate-in slide-in-from-bottom-10 duration-500">
          <Button
            className="w-full h-16 rounded-[2rem] bg-primary text-primary-foreground font-black uppercase italic tracking-tighter shadow-[0_20px_50px_rgba(0,0,0,0.5)] active:scale-[0.98] transition-all border border-white/10"
            onClick={() => {
              if (selectedTaskIds.length > 0) {
                createSession(selectedTaskIds);
              } else if (sessionId) {
                window.open(terminalUrl, "_self");
              }
            }}
            disabled={isCreatingSession}
          >
            {isCreatingSession ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <>
                {selectedTaskIds.length > 0
                  ? sessionId
                    ? "Добавить в обслуживание"
                    : "Начать обслуживание"
                  : "Продолжить обслуживание"}
                <ChevronRight className="ml-2 h-6 w-6" />
              </>
            )}
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
        <DialogContent className="max-w-4xl bg-zinc-950 border-zinc-900 text-zinc-100 p-0 overflow-hidden rounded-[2rem] shadow-2xl">
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
                    <div className="grid grid-cols-2 gap-3 bg-zinc-900/20 border border-zinc-900 rounded-2xl p-4">
                      <div>
                        <span className="text-[9px] font-bold text-zinc-500 block uppercase">Бренд / Модель</span>
                        <span className="text-sm font-extrabold text-zinc-200">
                          {modalTaskDetails.equipment.brand || "—"} / {modalTaskDetails.equipment.model || "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-zinc-500 block uppercase">Идентификатор</span>
                        <span className="text-sm font-mono font-extrabold text-zinc-200">
                          {modalTaskDetails.equipment.identifier || "—"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Rejection comment if status is REWORK */}
                  {modalTaskDetails.task.status === "REWORK" && (
                    <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 space-y-2">
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
                    <div className="bg-zinc-900/20 border border-zinc-900 rounded-2xl p-5 space-y-4">
                      {Array.isArray(modalTaskDetails.instructions) ? (
                        <ol className="space-y-3 list-decimal list-inside text-xs text-zinc-300 font-medium">
                          {modalTaskDetails.instructions.map((step: any, idx: number) => (
                            <li key={idx} className="leading-relaxed">
                              {typeof step === "string" ? step : step.text || step.description}
                            </li>
                          ))}
                        </ol>
                      ) : typeof modalTaskDetails.instructions === "string" && modalTaskDetails.instructions.trim() ? (
                        <p className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed font-medium">
                          {modalTaskDetails.instructions}
                        </p>
                      ) : (
                        <p className="text-xs text-zinc-500 italic">
                          Инструкции по регламенту отсутствуют для данного типа устройств.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column: Execution Form */}
                <div className="p-6 space-y-6 overflow-y-auto bg-zinc-950/40">
                  {modalTaskDetails.task.status === "PENDING" ? (
                    /* Initial Pending Screen: Start Button */
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-6 py-12">
                      <div className="h-16 w-16 bg-primary/10 border border-primary/20 rounded-3xl flex items-center justify-center text-primary shadow-[0_0_30px_rgba(235,94,40,0.05)]">
                        <Wrench className="h-8 w-8 animate-pulse" />
                      </div>
                      <div className="space-y-2 max-w-sm">
                        <h4 className="text-sm font-black text-white uppercase tracking-tight">Обслуживание не начато</h4>
                        <p className="text-xs text-zinc-400 leading-relaxed font-medium">
                          Нажмите кнопку ниже, чтобы перевести задачу в статус выполнения. Это закрепит задачу за вами.
                        </p>
                      </div>
                      <Button
                        className="w-full max-w-xs h-14 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-tight shadow-lg transition-all active:scale-[0.98] text-xs flex items-center justify-center gap-2"
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
                        <div className="space-y-3 p-4 bg-zinc-900/30 border border-zinc-900 rounded-2xl animate-in slide-in-from-top-2 duration-300">
                          <div className="space-y-2">
                            <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block">
                              Тема {completionStatus === "LAUNDRY" ? "стирки" : "инцидента"} <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={issueTitle}
                              onChange={(e) => setIssueTitle(e.target.value)}
                              placeholder={completionStatus === "LAUNDRY" ? "Грязный / С пятнами" : "Залипает левый Shift"}
                              className="w-full h-11 px-4 bg-zinc-900/80 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-600 focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all font-semibold outline-none"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block">Описание (необязательно)</label>
                            <textarea
                              value={issueDescription}
                              onChange={(e) => setIssueDescription(e.target.value)}
                              placeholder="Опишите детали неисправности..."
                              rows={2}
                              className="w-full p-4 bg-zinc-900/80 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-600 focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all font-medium outline-none resize-none"
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
                          className="w-full p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl text-xs text-white placeholder-zinc-600 focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all font-medium outline-none resize-none"
                        />
                      </div>

                      {/* Complete Submit Button */}
                      <Button
                        className="w-full h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase text-xs tracking-wider shadow-lg shadow-emerald-950/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 border-none mt-2"
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
        <div className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-[100] animate-in fade-in slide-in-from-bottom-5 duration-300 flex items-center gap-3 w-80 md:w-96 p-4 rounded-2xl bg-zinc-950/90 backdrop-blur-xl border border-emerald-500/20 shadow-2xl shadow-emerald-950/10">
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
