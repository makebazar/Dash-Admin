"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Camera,
  ChevronRight,
  ChevronLeft,
  X,
  Info,
  Monitor,
  Check,
  List,
  ClipboardList,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ImageViewer } from "@/components/ui/image-viewer";
import { QRCode } from "@/components/qr/QRCode";
import {
  cn,
  optimizeFileBeforeUpload,
  isLaundryEquipmentType,
} from "@/lib/utils";

interface Task {
  id: string;
  equipment_id: string;
  equipment_name: string;
  equipment_type: string;
  equipment_type_name: string;
  equipment_icon: string;
  workstation_name?: string;
  workstation_zone?: string;
  require_photo_before: boolean;
  min_photos_before: number;
  require_photo_after: boolean;
  min_photos_after: number;
  require_comment_mode: "ALWAYS" | "ON_ISSUE" | "NEVER";
  instructions?: string;
  performance_instructions?: string;
  task_type?:
    | "CLEANING"
    | "REPAIR"
    | "INSPECTION"
    | "REPLACEMENT"
    | "PERFORMANCE_CHECK";
  performance_metrics?: Array<{
    id: string;
    name: string;
    unit: string;
  }>;
  status?: string;
  verified_by_name?: string;
  latest_rejection?: {
    note: string;
    photos: string[];
    rejected_by_name?: string;
  };
}

type Step =
  | "PLAN"
  | "BEFORE"
  | "INFO"
  | "PERFORMANCE"
  | "AFTER"
  | "REPORT"
  | "SUMMARY"
  | "REWORK";

export default function MaintenanceTerminalPage() {
  const { sessionId } = useParams();
  const searchParams = useSearchParams();
  const clubId = searchParams.get("clubId");
  const router = useRouter();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentTaskIdx, setCurrentTaskIdx] = useState(0);
  const [currentStep, setCurrentStep] = useState<Step>("PLAN");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [blockDesktopAccess, setBlockDesktopAccess] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [submitStatus, setSubmitStatus] = useState<
    "idle" | "success" | "error"
  >("idle");

  const reorderTask = (index: number, direction: "UP" | "DOWN") => {
    const newTasks = [...tasks];
    const targetIdx = direction === "UP" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= tasks.length) return;

    const [movedTask] = newTasks.splice(index, 1);
    newTasks.splice(targetIdx, 0, movedTask);
    setTasks(newTasks);
  };

  const openViewer = (images: string[], index: number) => {
    setViewerImages(images);
    setViewerIndex(index);
    setViewerOpen(true);
  };

  const nextImage = () => {
    setViewerIndex((prev) => (prev + 1) % viewerImages.length);
  };

  const prevImage = () => {
    setViewerIndex(
      (prev) => (prev - 1 + viewerImages.length) % viewerImages.length,
    );
  };
  const [countdown, setCountdown] = useState(5);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Persistence Logic
  const [reports, setReports] = useState<
    Record<
      string,
      {
        photos_before: string[];
        photos_after: string[];
        notes: string;
        issue_title?: string;
        issue_description?: string;
        status: "OK" | "ISSUE" | "LAUNDRY" | "SKIPPED";
        performance_data?: Record<string, string>;
      }
    >
  >({});

  // Persistence Logic
  const storageKey = `maintenance_session_${sessionId}`;

  // Save to localStorage whenever reports change
  useEffect(() => {
    if (Object.keys(reports).length === 0) return;

    const timeout = setTimeout(() => {
      try {
        const serialized: any = {};
        for (const [taskId, report] of Object.entries(reports)) {
          serialized[taskId] = {
            ...report,
            // Saving URLs to localStorage is memory-safe as they are just short strings.
            photos_before: report.photos_before,
            photos_after: report.photos_after,
          };
        }
        localStorage.setItem(storageKey, JSON.stringify(serialized));
      } catch (e) {
        console.error("Failed to save session to storage", e);
      }
    }, 1000);

    return () => clearTimeout(timeout);
  }, [reports, storageKey]);

  const fetchData = useCallback(async () => {
    if (!clubId || !sessionId) return;
    setIsLoading(true);
    try {
      const [res, settingsRes] = await Promise.all([
        fetch(
          `/api/clubs/${clubId}/equipment/maintenance/sessions/${sessionId}`,
        ),
        fetch(`/api/clubs/${clubId}/settings/maintenance`),
      ]);

      const data = await res.json();
      const settingsData = await settingsRes.json();

      if (settingsRes.ok) {
        setBlockDesktopAccess(!!settingsData.block_desktop_access);
      }

      if (res.ok) {
        setTasks(data.tasks);

        // Determine initial step for the first task
        const firstTask = data.tasks[0];

        // Try to load from localStorage
        const saved = localStorage.getItem(storageKey);
        const initialReports: any = {};

        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            // Ensure all current tasks have a report entry
            data.tasks.forEach((t: Task) => {
              if (!parsed[t.id]) {
                parsed[t.id] = {
                  photos_before: [],
                  photos_after: [],
                  notes: "",
                  issue_title: "",
                  issue_description: "",
                  status: "OK",
                  performance_data: {},
                };
              }
            });
            setReports(parsed);
          } catch (e) {
            console.error("Failed to parse saved session", e);
          }
        } else {
          data.tasks.forEach((t: Task) => {
            initialReports[t.id] = {
              photos_before: [],
              photos_after: [],
              notes: "",
              issue_title: "",
              issue_description: "",
              status: "OK",
              performance_data: {},
            };
          });
          setReports(initialReports);
        }

        setCurrentStep("PLAN");
      } else {
        alert(data.error || "Ошибка загрузки сессии");
      }
    } catch (error) {
      console.error(error);
      alert("Ошибка сети или сервера");
    } finally {
      setIsLoading(false);
    }
  }, [clubId, sessionId, storageKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const checkIsDesktop = () => {
      setIsDesktop(window.innerWidth > 1024);
    };
    checkIsDesktop();
    window.addEventListener("resize", checkIsDesktop);
    return () => window.removeEventListener("resize", checkIsDesktop);
  }, []);

  const currentTask = tasks[currentTaskIdx];
  const currentReport = currentTask ? reports[currentTask.id] : null;

  const isFirstStepOfTask = currentTask
    ? currentTask.status === "REWORK" ||
      currentTask.verification_status === "REJECTED"
      ? currentStep === "REWORK"
      : currentTask.require_photo_before
        ? currentStep === "BEFORE"
        : currentStep === "INFO"
    : false;

  const handlePhoto = async (
    type: "before" | "after",
    files: FileList | null,
  ) => {
    if (!files || !currentTask) return;

    setIsUploadingPhoto(true);
    try {
      const newFiles = Array.from(files);
      const optimized = await Promise.all(
        newFiles.map((f) =>
          optimizeFileBeforeUpload(f, { maxDimension: 1000 }),
        ),
      );

      const urls = await uploadPhotos(optimized);

      setReports((prev) => {
        const existing = prev[currentTask.id] || {
          photos_before: [],
          photos_after: [],
          notes: "",
          issue_title: "",
          issue_description: "",
          status: "OK",
        };
        return {
          ...prev,
          [currentTask.id]: {
            ...existing,
            [type === "before" ? "photos_before" : "photos_after"]: [
              ...existing[type === "before" ? "photos_before" : "photos_after"],
              ...urls,
            ],
          },
        };
      });
    } catch (e) {
      console.error("Failed to upload photos", e);
      alert("Ошибка при загрузке фото");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const skipCurrentTask = () => {
    if (!currentTask) return;
    setReports((prev) => {
      const existing = prev[currentTask.id] || {
        photos_before: [],
        photos_after: [],
        notes: "",
        issue_title: "",
        issue_description: "",
        status: "OK",
      };
      return {
        ...prev,
        [currentTask.id]: {
          ...existing,
          status: "SKIPPED",
        },
      };
    });

    setShowSkipConfirm(false);

    if (currentTaskIdx < tasks.length - 1) {
      const nextIdx = currentTaskIdx + 1;
      setCurrentTaskIdx(nextIdx);
      const nextIsRework =
        tasks[nextIdx]?.status === "REWORK" ||
        tasks[nextIdx]?.verification_status === "REJECTED";
      setCurrentStep(
        nextIsRework
          ? "REWORK"
          : tasks[nextIdx].require_photo_before
            ? "BEFORE"
            : "INFO",
      );
    } else {
      setCurrentStep("SUMMARY");
    }
  };

  const nextStep = () => {
    if (currentStep === "REWORK") {
      setCurrentStep(currentTask.require_photo_before ? "BEFORE" : "INFO");
    } else if (currentStep === "PLAN") {
      setCurrentTaskIdx(0);
      const isRework =
        tasks[0]?.status === "REWORK" ||
        tasks[0]?.verification_status === "REJECTED";
      setCurrentStep(
        isRework ? "REWORK" : tasks[0].require_photo_before ? "BEFORE" : "INFO",
      );
    } else if (currentStep === "BEFORE") setCurrentStep("INFO");
    else if (currentStep === "INFO") {
      if (
        currentTask?.performance_metrics &&
        currentTask.performance_metrics.length > 0
      ) {
        setCurrentStep("PERFORMANCE");
      } else if (currentTask?.require_photo_after) {
        setCurrentStep("AFTER");
      } else {
        setCurrentStep("REPORT");
      }
    } else if (currentStep === "PERFORMANCE") {
      if (currentTask?.require_photo_after) setCurrentStep("AFTER");
      else setCurrentStep("REPORT");
    } else if (currentStep === "AFTER") setCurrentStep("REPORT");
    else if (currentStep === "REPORT") {
      if (currentTaskIdx < tasks.length - 1) {
        const nextIdx = currentTaskIdx + 1;
        setCurrentTaskIdx(nextIdx);
        const nextIsRework =
          tasks[nextIdx]?.status === "REWORK" ||
          tasks[nextIdx]?.verification_status === "REJECTED";
        setCurrentStep(
          nextIsRework
            ? "REWORK"
            : tasks[nextIdx].require_photo_before
              ? "BEFORE"
              : "INFO",
        );
      } else {
        setCurrentStep("SUMMARY");
      }
    }
  };

  const prevStep = () => {
    if (currentStep === "SUMMARY") {
      setCurrentTaskIdx(tasks.length - 1);
      setCurrentStep("REPORT");
    } else if (currentStep === "REPORT") {
      if (currentTask?.require_photo_after) setCurrentStep("AFTER");
      else if (
        currentTask?.performance_metrics &&
        currentTask.performance_metrics.length > 0
      )
        setCurrentStep("PERFORMANCE");
      else setCurrentStep("INFO");
    } else if (currentStep === "AFTER") {
      if (
        currentTask?.performance_metrics &&
        currentTask.performance_metrics.length > 0
      )
        setCurrentStep("PERFORMANCE");
      else setCurrentStep("INFO");
    } else if (currentStep === "PERFORMANCE") {
      setCurrentStep("INFO");
    } else if (currentStep === "INFO") {
      if (currentTask?.require_photo_before) setCurrentStep("BEFORE");
      else if (
        currentTask.status === "REWORK" ||
        currentTask.verification_status === "REJECTED"
      ) {
        setCurrentStep("REWORK");
      } else if (currentTaskIdx > 0) {
        const prevIdx = currentTaskIdx - 1;
        setCurrentTaskIdx(prevIdx);
        setCurrentStep("REPORT");
      } else {
        setCurrentStep("PLAN");
      }
    } else if (currentStep === "BEFORE") {
      if (
        currentTask.status === "REWORK" ||
        currentTask.verification_status === "REJECTED"
      ) {
        setCurrentStep("REWORK");
      } else if (currentTaskIdx > 0) {
        const prevIdx = currentTaskIdx - 1;
        setCurrentTaskIdx(prevIdx);
        setCurrentStep("REPORT");
      } else {
        setCurrentStep("PLAN");
      }
    } else if (currentStep === "REWORK") {
      if (currentTaskIdx > 0) {
        const prevIdx = currentTaskIdx - 1;
        setCurrentTaskIdx(prevIdx);
        setCurrentStep("REPORT");
      } else {
        setCurrentStep("PLAN");
      }
    } else if (currentStep === "PLAN") {
      // Stay on plan
    }
  };

  const handleFinish = async () => {
    setIsSubmitting(true);
    try {
      const finalReports = [];
      for (const task of tasks) {
        const report = reports[task.id];

        const isLaundryReport = report.status === "LAUNDRY";
        const isIssueReport = report.status === "ISSUE";
        const hasDetails = isLaundryReport || isIssueReport;
        const reportPrefix = isLaundryReport
          ? "[СТИРКА]"
          : isIssueReport
            ? "[ИНЦИДЕНТ]"
            : null;

        finalReports.push({
          taskId: task.id,
          photos_before: report.photos_before,
          photos_after: report.photos_after,
          notes:
            hasDetails && report.issue_title
              ? `${reportPrefix} ${report.issue_title}: ${report.issue_description}`
              : report.notes,
          status_mode: report.status,
          issue_title: report.issue_title,
          issue_description: report.issue_description,
          performance_data: report.performance_data,
        });
      }

      const res = await fetch(
        `/api/clubs/${clubId}/equipment/maintenance/sessions/${sessionId}/complete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reports: finalReports }),
        },
      );

      if (res.ok) {
        localStorage.removeItem(storageKey);
        setSubmitStatus("success");

        let count = 5;
        const timer = setInterval(() => {
          count -= 1;
          setCountdown(count);
          if (count <= 0) {
            clearInterval(timer);
            window.close();
          }
        }, 1000);
      } else {
        setSubmitStatus("error");
      }
    } catch (error) {
      console.error(error);
      setSubmitStatus("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const uploadPhotos = async (files: File[]) => {
    if (files.length === 0) return [];

    return Promise.all(
      files.map(async (file) => {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        if (res.ok) {
          const data = await res.json();
          return data.url;
        }
        return null;
      }),
    ).then((urls) => urls.filter(Boolean) as string[]);
  };

  if (isLoading)
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );

  if (submitStatus !== "idle") {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-8 text-center font-sans">
        {submitStatus === "success" ? (
          <div className="space-y-8 animate-in fade-in zoom-in duration-500">
            <div className="h-24 w-24 rounded-[2.5rem] bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 mx-auto shadow-2xl shadow-emerald-500/10">
              <CheckCircle2 className="h-12 w-12" />
            </div>
            <div className="space-y-4">
              <h2 className="text-3xl font-black tracking-tight text-white uppercase italic">
                Все готово!
              </h2>
              <p className="text-zinc-500 font-medium">
                Отчет успешно отправлен. Хорошей смены!
              </p>
            </div>
            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono text-sm">
              <Clock className="h-4 w-4" />
              Закрытие через {countdown} сек...
            </div>
            <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">
              Вы также можете закрыть вкладку вручную
            </p>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in zoom-in duration-500">
            <div className="h-24 w-24 rounded-[2.5rem] bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 mx-auto shadow-2xl shadow-rose-500/10">
              <AlertCircle className="h-12 w-12" />
            </div>
            <div className="space-y-4">
              <h2 className="text-3xl font-black tracking-tight text-white uppercase italic">
                Ошибка сети
              </h2>
              <p className="text-zinc-500 font-medium max-w-xs mx-auto">
                Не удалось отправить отчет. Пожалуйста, проверьте подключение к
                интернету и попробуйте снова.
              </p>
            </div>
            <Button
              className="h-16 px-12 rounded-2xl bg-zinc-100 hover:bg-white text-black font-bold text-lg shadow-2xl active:scale-[0.98] transition-all"
              onClick={handleFinish}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-7 w-7 animate-spin" />
              ) : (
                "Повторить попытку"
              )}
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (!currentTask)
    return <div className="p-8 text-center">Сессия не найдена или пуста</div>;

  const isLastTask = currentTaskIdx === tasks.length - 1;
  const isStepComplete = () => {
    if (isUploadingPhoto) return false;
    if (!currentReport && currentStep !== "PLAN" && currentStep !== "SUMMARY")
      return false;

    if (currentStep === "INFO") return true;
    if (currentStep === "PERFORMANCE") {
      if (!currentTask?.performance_metrics) return true;
      const data = currentReport?.performance_data || {};
      return currentTask.performance_metrics.every(
        (m) => data[m.id] && data[m.id].trim() !== "",
      );
    }
    if (currentStep === "SUMMARY") return true;
    if (currentStep === "BEFORE")
      return (
        (currentReport?.photos_before.length || 0) >=
        currentTask.min_photos_before
      );
    if (currentStep === "AFTER")
      return (
        (currentReport?.photos_after.length || 0) >=
        currentTask.min_photos_after
      );
    if (currentStep === "REPORT") {
      if (
        currentTask.require_comment_mode === "ALWAYS" &&
        !currentReport?.notes.trim()
      )
        return false;
      if (
        currentTask.require_comment_mode === "ON_ISSUE" &&
        currentReport?.status !== "OK" &&
        !currentReport?.notes.trim() &&
        !currentReport?.issue_title?.trim()
      )
        return false;

      if (
        (currentReport?.status === "ISSUE" ||
          currentReport?.status === "LAUNDRY") &&
        !currentReport?.issue_title?.trim()
      ) {
        return false;
      }
      return true;
    }
    return true;
  };

  if (blockDesktopAccess && isDesktop) {
    const terminalUrl = `${window.location.origin}/employee/terminal/maintenance/${sessionId}?clubId=${clubId}`;

    return (
      <div className="h-screen bg-zinc-950 flex flex-col items-center justify-center p-8 text-center">
        <div className="h-20 w-20 rounded-3xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 mb-8 shadow-2xl">
          <Monitor className="h-10 w-10" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight mb-4 text-white uppercase italic">
          Доступ ограничен
        </h1>
        <p className="text-zinc-500 max-w-sm mb-8 leading-relaxed font-medium">
          Этот терминал предназначен только для мобильных устройств.
          Отсканируйте QR-код ниже, чтобы продолжить обслуживание со смартфона.
        </p>

        <div className="bg-white p-5 rounded-[2rem] flex items-center justify-center shadow-[0_0_50px_rgba(16,185,129,0.1)] border-4 border-zinc-900 mb-8 animate-in zoom-in-95 duration-500">
          <QRCode value={terminalUrl} size={180} />
        </div>

        <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl text-[10px] font-mono text-zinc-600 uppercase tracking-[0.2em] font-bold">
          Mobile interface required
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans overflow-hidden selection:bg-primary/30">
      {/* Header */}
      <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/80 backdrop-blur-xl sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-base font-bold tracking-tight leading-none">
              {currentStep === "PLAN"
                ? "План обслуживания"
                : currentStep === "SUMMARY"
                  ? "Итоговый отчет"
                  : currentTask.equipment_name}
            </h1>
            <div className="flex items-center gap-2 mt-1.5">
              <Badge
                variant="outline"
                className="bg-zinc-900 border-zinc-700 text-zinc-500 text-[9px] font-mono px-1.5 py-0 h-4 min-w-[40px] flex items-center justify-center"
              >
                {currentStep === "PLAN"
                  ? "ОБЗОР"
                  : currentStep === "SUMMARY"
                    ? "ГОТОВО"
                    : currentTask.workstation_name || "СИСТЕМА"}
              </Badge>
              <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider">
                {currentStep === "PLAN"
                  ? `${tasks.length} устройств`
                  : currentStep === "SUMMARY"
                    ? "Проверка"
                    : currentTask.workstation_zone}
              </span>
            </div>
          </div>
        </div>
        {currentStep !== "PLAN" && currentStep !== "SUMMARY" && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-right min-w-[80px]">
            <div className="text-[9px] font-bold text-zinc-500 uppercase leading-none mb-0.5 tracking-tight">
              Прогресс
            </div>
            <div className="text-sm font-mono font-bold text-emerald-500">
              {String(currentTaskIdx + 1).padStart(2, "0")}
              <span className="text-zinc-700 mx-0.5">/</span>
              {String(tasks.length).padStart(2, "0")}
            </div>
          </div>
        )}
      </div>

      {/* Steps Progress */}
      {currentStep !== "PLAN" && currentStep !== "SUMMARY" && (
        <div className="px-5 py-3 flex gap-1.5 bg-zinc-900/50 border-b border-zinc-800/50">
          {["BEFORE", "INFO", "AFTER", "REPORT"].map((s) => {
            const stepVisible =
              s === "BEFORE"
                ? currentTask.require_photo_before
                : s === "AFTER"
                  ? currentTask.require_photo_after
                  : true;
            if (!stepVisible) return null;
            return (
              <div
                key={s}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-all duration-500",
                  currentStep === s
                    ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]"
                    : "bg-zinc-800",
                )}
              />
            );
          })}
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-8 pb-40">
        {currentStep === "REWORK" && currentTask?.latest_rejection && (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-6">
              <div className="h-20 w-20 rounded-[2.5rem] bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 mx-auto shadow-lg shadow-rose-500/10">
                <AlertCircle className="h-10 w-10" />
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-black tracking-tight text-white uppercase italic">
                  На доработку
                </h2>
                <p className="text-sm text-zinc-500 font-medium px-4">
                  Менеджер отклонил предыдущий отчет. Пожалуйста, исправьте
                  замечания ниже.
                </p>
              </div>
            </div>

            <div className="space-y-8">
              <div className="p-6 rounded-[2rem] bg-zinc-900 border border-zinc-800 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20">
                    {currentTask.latest_rejection.rejected_by_name ||
                      currentTask.verified_by_name ||
                      "Управляющий"}
                  </span>
                </div>
                <p className="text-sm text-zinc-300 font-medium leading-relaxed italic">
                  "{currentTask.latest_rejection.note}"
                </p>
              </div>

              {currentTask.latest_rejection.photos &&
                currentTask.latest_rejection.photos.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 px-2">
                      <div className="h-px flex-1 bg-zinc-900" />
                      <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                        Фото замечаний
                      </span>
                      <div className="h-px flex-1 bg-zinc-900" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {currentTask.latest_rejection.photos.map((url, idx) => (
                        <div
                          key={idx}
                          className="aspect-square rounded-[1.5rem] overflow-hidden border border-zinc-800 bg-zinc-900 group relative"
                        >
                          <img
                            src={url}
                            alt="Rework proof"
                            className="h-full w-full object-cover transition-transform duration-500 group-active:scale-110 cursor-pointer"
                            onClick={() =>
                              openViewer(
                                currentTask.latest_rejection!.photos,
                                idx,
                              )
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          </div>
        )}

        {currentStep === "PLAN" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">
                Список устройств
              </h2>
              <p className="text-sm text-zinc-500 font-medium">
                Проверьте список оборудования перед началом сессии обслуживания.
              </p>
            </div>
            <div className="space-y-3">
              {tasks.map((task, i) => (
                <div
                  key={task.id}
                  className="p-5 rounded-3xl bg-zinc-900 border border-zinc-800 flex items-center justify-between group transition-all shadow-sm"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "h-8 w-8 rounded-full border border-zinc-800 text-zinc-500",
                          i === 0 && "opacity-20 pointer-events-none",
                        )}
                        onClick={() => reorderTask(i, "UP")}
                      >
                        <ChevronLeft className="h-4 w-4 rotate-90" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "h-8 w-8 rounded-full border border-zinc-800 text-zinc-500",
                          i === tasks.length - 1 &&
                            "opacity-20 pointer-events-none",
                        )}
                        onClick={() => reorderTask(i, "DOWN")}
                      >
                        <ChevronRight className="h-4 w-4 rotate-90" />
                      </Button>
                    </div>
                    <div>
                      <div className="text-sm font-bold tracking-tight flex items-center gap-2">
                        {task.equipment_name}
                        {(task.status === "REWORK" ||
                          task.verification_status === "REJECTED") && (
                          <Badge
                            variant="outline"
                            className="bg-rose-500/10 text-rose-500 border-rose-500/20 text-[9px] font-bold px-1.5 h-4"
                          >
                            ДОРАБОТКА
                          </Badge>
                        )}
                      </div>
                      <div className="text-[10px] text-zinc-500 font-mono font-bold mt-1">
                        Локация: {task.workstation_name || "СКЛАД"} //{" "}
                        {task.workstation_zone || "Н/Д"}
                      </div>
                      <div className="text-[9px] text-zinc-600 font-black uppercase tracking-widest mt-0.5 opacity-70">
                        {task.equipment_type_name}
                      </div>
                    </div>
                  </div>
                  <div className="h-8 w-8 rounded-full border border-zinc-800 flex items-center justify-center text-zinc-500 font-mono text-[10px] font-bold">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentStep === "BEFORE" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">
                Состояние до
              </h2>
              <p className="text-sm text-zinc-500 font-medium">
                Сфотографируйте устройство перед началом работ.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {currentReport?.photos_before.map((p, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-3xl border border-zinc-800 overflow-hidden relative group shadow-2xl"
                >
                  <img
                    src={typeof p === "string" ? p : URL.createObjectURL(p)}
                    className="h-full w-full object-cover transition-all cursor-pointer"
                    alt={`Фото ${i + 1}`}
                    onClick={() =>
                      openViewer(
                        currentReport.photos_before.map((img) =>
                          typeof img === "string"
                            ? img
                            : URL.createObjectURL(img),
                        ),
                        i,
                      )
                    }
                  />
                  <button
                    onClick={() =>
                      setReports((prev) => ({
                        ...prev,
                        [currentTask.id]: {
                          ...prev[currentTask.id],
                          photos_before: prev[
                            currentTask.id
                          ].photos_before.filter((_, idx) => idx !== i),
                        },
                      }))
                    }
                    className="absolute top-3 right-3 h-10 w-10 bg-black/60 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/10 active:scale-90 transition-transform"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              ))}
              <label
                className={cn(
                  "aspect-square rounded-3xl border-2 border-dashed border-zinc-800 flex flex-col items-center justify-center gap-3 bg-zinc-900 active:bg-zinc-800 transition-all group",
                  isUploadingPhoto && "opacity-50 pointer-events-none",
                )}
              >
                <div className="h-14 w-14 rounded-full bg-emerald-500/10 flex items-center justify-center group-active:scale-110 transition-transform">
                  {isUploadingPhoto ? (
                    <Loader2 className="h-7 w-7 text-emerald-500 animate-spin" />
                  ) : (
                    <Camera className="h-7 w-7 text-emerald-500" />
                  )}
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  {isUploadingPhoto ? "Загрузка..." : "Сделать фото"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  disabled={isUploadingPhoto}
                  onChange={(e) => handlePhoto("before", e.target.files)}
                />
              </label>
            </div>
            {currentTask.min_photos_before > 0 && (
              <div className="flex items-center justify-center gap-2">
                <div className="h-[1px] flex-1 bg-zinc-900" />
                <div className="px-4 py-1 rounded-full border border-zinc-800 bg-zinc-900 text-[10px] font-mono font-bold text-zinc-500 uppercase">
                  Нужно еще:{" "}
                  {Math.max(
                    0,
                    currentTask.min_photos_before -
                      (currentReport?.photos_before.length || 0),
                  )}
                </div>
                <div className="h-[1px] flex-1 bg-zinc-900" />
              </div>
            )}
          </div>
        )}

        {currentStep === "INFO" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">Инструкции</h2>
              <p className="text-sm text-zinc-500 font-medium">
                Выполните обслуживание согласно установленному регламенту.
              </p>
            </div>
            <div className="bg-zinc-900 rounded-3xl p-8 border border-zinc-800 shadow-inner relative overflow-hidden">
              <div className="prose prose-invert max-w-none prose-zinc prose-sm">
                {currentTask.instructions ? (
                  <div
                    dangerouslySetInnerHTML={{
                      __html: currentTask.instructions,
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                    <Info className="h-12 w-12 text-zinc-700" />
                    <p className="text-zinc-500 font-bold text-xs uppercase tracking-widest">
                      Инструкции отсутствуют. Проведите стандартную чистку.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {currentStep === "PERFORMANCE" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">
                Замеры производительности
              </h2>
              <p className="text-sm text-zinc-500 font-medium">
                Проведите тесты и зафиксируйте показатели.
              </p>
            </div>

            {currentTask.performance_instructions && (
              <div className="bg-zinc-900/50 rounded-3xl p-6 border border-zinc-800 shadow-inner mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <ClipboardList className="h-4 w-4 text-emerald-500" />
                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                    Как проверять
                  </span>
                </div>
                <div className="prose prose-invert max-w-none prose-zinc prose-xs">
                  <div
                    dangerouslySetInnerHTML={{
                      __html: currentTask.performance_instructions,
                    }}
                  />
                </div>
              </div>
            )}

            <div className="grid gap-4">
              {currentTask.performance_metrics?.map((metric) => (
                <div key={metric.id} className="space-y-2">
                  <div className="flex justify-between items-end px-1">
                    <Label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                      {metric.name}
                    </Label>
                    <span className="text-[10px] font-mono text-zinc-600 font-bold">
                      {metric.unit}
                    </span>
                  </div>
                  <div className="relative group">
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder={`Введите значение...`}
                      className="bg-zinc-900 border-zinc-800 rounded-2xl h-14 font-bold text-lg text-emerald-500 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all text-center"
                      value={currentReport?.performance_data?.[metric.id] || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setReports((prev) => ({
                          ...prev,
                          [currentTask.id]: {
                            ...prev[currentTask.id],
                            performance_data: {
                              ...(prev[currentTask.id].performance_data || {}),
                              [metric.id]: val,
                            },
                          },
                        }));
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentStep === "AFTER" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">
                Состояние после
              </h2>
              <p className="text-sm text-zinc-500 font-medium">
                Зафиксируйте результат выполненных работ.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {currentReport?.photos_after.map((p, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-3xl border border-zinc-800 overflow-hidden relative group shadow-2xl"
                >
                  <img
                    src={typeof p === "string" ? p : URL.createObjectURL(p)}
                    className="h-full w-full object-cover transition-all cursor-pointer"
                    alt={`Фото ${i + 1}`}
                    onClick={() =>
                      openViewer(
                        currentReport.photos_after.map((img) =>
                          typeof img === "string"
                            ? img
                            : URL.createObjectURL(img),
                        ),
                        i,
                      )
                    }
                  />
                  <button
                    onClick={() =>
                      setReports((prev) => ({
                        ...prev,
                        [currentTask.id]: {
                          ...prev[currentTask.id],
                          photos_after: prev[
                            currentTask.id
                          ].photos_after.filter((_, idx) => idx !== i),
                        },
                      }))
                    }
                    className="absolute top-3 right-3 h-10 w-10 bg-black/60 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/10 active:scale-90 transition-transform"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              ))}
              <label
                className={cn(
                  "aspect-square rounded-3xl border-2 border-dashed border-zinc-800 flex flex-col items-center justify-center gap-3 bg-zinc-900 active:bg-zinc-800 transition-all group",
                  isUploadingPhoto && "opacity-50 pointer-events-none",
                )}
              >
                <div className="h-14 w-14 rounded-full bg-emerald-500/10 flex items-center justify-center group-active:scale-110 transition-transform">
                  {isUploadingPhoto ? (
                    <Loader2 className="h-7 w-7 text-emerald-500 animate-spin" />
                  ) : (
                    <Camera className="h-7 w-7 text-emerald-500" />
                  )}
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  {isUploadingPhoto ? "Загрузка..." : "Сделать фото"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  disabled={isUploadingPhoto}
                  onChange={(e) => handlePhoto("after", e.target.files)}
                />
              </label>
            </div>
          </div>
        )}

        {currentStep === "REPORT" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">
                Отчет о состоянии
              </h2>
              <p className="text-sm text-zinc-500 font-medium">
                Выберите итоговый статус устройства и добавьте комментарий.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {[
                {
                  id: "OK",
                  label: "В порядке / Готово",
                  sub: "Все системы функционируют",
                  color: "emerald",
                  icon: CheckCircle2,
                  visible: true,
                },
                {
                  id: "ISSUE",
                  label: "Требует внимания",
                  sub: "Обнаружены технические проблемы",
                  color: "amber",
                  icon: AlertTriangle,
                  visible: true,
                },
                {
                  id: "LAUNDRY",
                  label: "Нужна стирка",
                  sub: "Сильное загрязнение текстиля",
                  color: "blue",
                  icon: Info,
                  visible: isLaundryEquipmentType(currentTask.equipment_type),
                },
              ]
                .filter((s) => s.visible)
                .map((s) => (
                  <button
                    key={s.id}
                    onClick={() =>
                      setReports((prev) => ({
                        ...prev,
                        [currentTask.id]: {
                          ...prev[currentTask.id],
                          status: s.id as any,
                        },
                      }))
                    }
                    className={cn(
                      "p-5 rounded-[2rem] border-2 transition-all flex items-center gap-4 text-left group",
                      currentReport?.status === s.id
                        ? `bg-${s.color}-500/5 border-${s.color}-500/60 shadow-[0_0_30px_rgba(0,0,0,0.2)]`
                        : "bg-zinc-900 border-zinc-800 text-zinc-500 grayscale opacity-60",
                    )}
                  >
                    <div
                      className={cn(
                        "h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-active:scale-95",
                        currentReport?.status === s.id
                          ? `bg-${s.color}-500 text-white shadow-[0_0_15px_rgba(var(--${s.color}-500-rgb),0.4)]`
                          : "bg-zinc-800",
                      )}
                    >
                      <s.icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <div
                        className={cn(
                          "text-sm font-bold tracking-tight",
                          currentReport?.status === s.id &&
                            `text-${s.color}-500`,
                        )}
                      >
                        {s.label}
                      </div>
                      <div className="text-[10px] font-medium opacity-60 uppercase tracking-wider mt-0.5">
                        {s.sub}
                      </div>
                    </div>
                    {currentReport?.status === s.id && (
                      <Check className="h-6 w-6 text-emerald-500" />
                    )}
                  </button>
                ))}
            </div>

            <div className="space-y-6 pt-4 border-t border-zinc-900">
              {currentReport?.status === "OK" ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 px-1">
                    <Label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                      Заметки
                    </Label>
                    <div className="h-[1px] flex-1 bg-zinc-900" />
                    <span className="text-[9px] font-mono text-zinc-700 uppercase">
                      Опционально
                    </span>
                  </div>
                  <Textarea
                    placeholder="Добавьте свои наблюдения (например, небольшой износ)..."
                    className="bg-zinc-900 border-zinc-800 rounded-3xl h-32 resize-none focus:ring-emerald-500/20 focus:border-emerald-500/50 text-sm font-medium transition-all"
                    value={currentReport?.notes}
                    onChange={(e) =>
                      setReports((prev) => ({
                        ...prev,
                        [currentTask.id]: {
                          ...prev[currentTask.id],
                          notes: e.target.value,
                        },
                      }))
                    }
                  />
                </div>
              ) : (
                <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 px-1">
                      <Label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                        Заголовок проблемы
                      </Label>
                      <div className="h-[1px] flex-1 bg-zinc-900" />
                      <span className="text-[9px] font-mono text-zinc-700 uppercase">
                        Обязательно
                      </span>
                    </div>
                    <Input
                      placeholder={
                        currentReport?.status === "LAUNDRY"
                          ? "Напр: Сильное загрязнение коврика"
                          : "Напр: Залипает левая кнопка"
                      }
                      className="bg-zinc-900 border-zinc-800 rounded-2xl h-14 focus:ring-emerald-500/20 focus:border-emerald-500/50 font-bold transition-all"
                      value={currentReport?.issue_title ?? ""}
                      onChange={(e) =>
                        setReports((prev) => ({
                          ...prev,
                          [currentTask.id]: {
                            ...prev[currentTask.id],
                            issue_title: e.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 px-1">
                      <Label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                        Подробное описание
                      </Label>
                      <div className="h-[1px] flex-1 bg-zinc-900" />
                    </div>
                    <Textarea
                      placeholder="Опишите проблему максимально подробно..."
                      className="bg-zinc-900 border-zinc-800 rounded-3xl h-32 resize-none focus:ring-emerald-500/20 focus:border-emerald-500/50 text-sm font-medium transition-all"
                      value={currentReport?.issue_description}
                      onChange={(e) =>
                        setReports((prev) => ({
                          ...prev,
                          [currentTask.id]: {
                            ...prev[currentTask.id],
                            issue_description: e.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {currentStep === "SUMMARY" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">
                Итоговая проверка
              </h2>
              <p className="text-sm text-zinc-500 font-medium">
                Проверьте результаты обслуживания всех устройств перед
                завершением.
              </p>
            </div>
            <div className="space-y-3">
              {tasks.map((task) => {
                const report = reports[task.id];
                return (
                  <div
                    key={task.id}
                    className="p-5 rounded-3xl bg-zinc-900 border border-zinc-800 flex items-center justify-between shadow-sm"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          "h-12 w-12 rounded-2xl flex items-center justify-center border",
                          report.status === "OK"
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                            : report.status === "ISSUE"
                              ? "bg-amber-500/10 border-amber-500/20 text-amber-500"
                              : report.status === "SKIPPED"
                                ? "bg-rose-500/10 border-rose-500/20 text-rose-500"
                                : "bg-blue-500/10 border-blue-500/20 text-blue-500",
                        )}
                      >
                        {report.status === "OK" ? (
                          <CheckCircle2 className="h-6 w-6" />
                        ) : report.status === "ISSUE" ? (
                          <AlertTriangle className="h-6 w-6" />
                        ) : report.status === "SKIPPED" ? (
                          <Clock className="h-6 w-6" />
                        ) : (
                          <Info className="h-6 w-6" />
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-bold tracking-tight">
                          {task.equipment_name}
                        </div>
                        <div
                          className={cn(
                            "text-[9px] font-mono font-bold uppercase mt-1",
                            report.status === "OK"
                              ? "text-emerald-500"
                              : report.status === "ISSUE"
                                ? "text-amber-500"
                                : report.status === "SKIPPED"
                                  ? "text-rose-500"
                                  : "text-blue-500",
                          )}
                        >
                          СТАТУС:{" "}
                          {report.status === "OK"
                            ? "В ПОРЯДКЕ"
                            : report.status === "ISSUE"
                              ? "ЕСТЬ ПРОБЛЕМА"
                              : report.status === "SKIPPED"
                                ? "ОТЛОЖЕНО"
                                : "НУЖНА СТИРКА"}
                        </div>
                      </div>
                    </div>
                    <div className="flex -space-x-3">
                      {report.photos_before.length > 0 && (
                        <div
                          className="h-8 w-8 rounded-full border-2 border-zinc-950 bg-zinc-800 flex items-center justify-center text-[9px] font-mono font-bold text-zinc-400 cursor-pointer hover:bg-zinc-700 transition-colors"
                          onClick={() =>
                            openViewer(
                              report.photos_before.map((img) =>
                                typeof img === "string"
                                  ? img
                                  : URL.createObjectURL(img),
                              ),
                              0,
                            )
                          }
                        >
                          Д{report.photos_before.length}
                        </div>
                      )}
                      {report.photos_after.length > 0 && (
                        <div
                          className="h-8 w-8 rounded-full border-2 border-zinc-950 bg-zinc-800 flex items-center justify-center text-[9px] font-mono font-bold text-emerald-500 cursor-pointer hover:bg-zinc-700 transition-colors"
                          onClick={() =>
                            openViewer(
                              report.photos_after.map((img) =>
                                typeof img === "string"
                                  ? img
                                  : URL.createObjectURL(img),
                              ),
                              0,
                            )
                          }
                        >
                          П{report.photos_after.length}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        .prose h1 {
          font-size: 1.5rem;
          font-weight: 800;
          margin-bottom: 1rem;
          color: white;
          letter-spacing: -0.02em;
        }
        .prose h2 {
          font-size: 1.25rem;
          font-weight: 700;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
          color: white;
        }
        .prose h3 {
          font-size: 1.1rem;
          font-weight: 700;
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
          color: white;
        }
        .prose p {
          margin-bottom: 1rem;
          line-height: 1.6;
          color: #a1a1aa;
        }
        .prose ul,
        .prose ol {
          margin-bottom: 1rem;
          padding-left: 1.25rem;
          color: #a1a1aa;
        }
        .prose li {
          margin-bottom: 0.5rem;
        }
        .prose strong {
          color: white;
          font-weight: 700;
        }
        .prose img {
          max-width: 100%;
          border-radius: 1.5rem;
          margin: 1.5rem 0;
          border: 1px solid #27272a;
        }
      `}</style>

      {/* Sticky Bottom Actions */}
      <div className="p-6 bg-zinc-950/80 backdrop-blur-xl border-t border-zinc-900 fixed bottom-0 left-0 right-0 z-40">
        <div className="flex gap-4">
          {isFirstStepOfTask && (
            <Button
              variant="outline"
              className="h-16 w-16 rounded-[2rem] border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-600 active:scale-95 transition-all"
              onClick={() => setShowSkipConfirm(true)}
            >
              <Clock className="h-8 w-8" />
            </Button>
          )}

          {currentStep !== "PLAN" && (
            <Button
              variant="outline"
              className="h-16 w-16 rounded-[2rem] border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 active:scale-95 transition-all"
              onClick={prevStep}
            >
              <ChevronLeft className="h-8 w-8" />
            </Button>
          )}

          {currentStep === "PLAN" ? (
            <Button
              className="flex-1 h-16 rounded-[2rem] bg-zinc-100 hover:bg-white text-black font-bold text-lg shadow-2xl active:scale-[0.98] transition-all"
              onClick={nextStep}
            >
              {tasks.length > 1 ? "Начать все" : "Начать"}
              <ChevronRight className="ml-2 h-7 w-7" />
            </Button>
          ) : currentStep === "SUMMARY" ? (
            <Button
              className="flex-1 h-16 rounded-[2rem] bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-lg shadow-[0_0_30px_rgba(16,185,129,0.3)] active:scale-[0.98] transition-all"
              onClick={handleFinish}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-7 w-7 animate-spin" />
              ) : (
                <>
                  Завершить работу
                  <Check className="ml-2 h-7 w-7" />
                </>
              )}
            </Button>
          ) : (
            <Button
              className={cn(
                "flex-1 h-16 rounded-[2rem] font-bold text-lg shadow-2xl transition-all active:scale-[0.98]",
                currentStep === "REPORT"
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                  : "bg-zinc-100 hover:bg-white text-black",
              )}
              onClick={nextStep}
              disabled={!isStepComplete()}
            >
              {currentStep === "REPORT"
                ? isLastTask
                  ? "К итогам"
                  : "Следующее устройство"
                : "Продолжить"}
              <ChevronRight className="ml-2 h-7 w-7" />
            </Button>
          )}
        </div>
        {currentStep !== "PLAN" && currentStep !== "SUMMARY" && (
          <div className="mt-4 flex justify-center gap-1.5">
            {tasks.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i === currentTaskIdx
                    ? "w-8 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                    : "w-1.5 bg-zinc-800",
                )}
              />
            ))}
          </div>
        )}
      </div>

      <ImageViewer
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        src={viewerImages[viewerIndex]}
        images={viewerImages}
        onNext={nextImage}
        onPrev={prevImage}
        hasNext={viewerIndex < viewerImages.length - 1}
        hasPrev={viewerIndex > 0}
      />

      {/* Confirmation Dialog Overlay */}
      {showSkipConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-[2.5rem] p-8 shadow-2xl space-y-8 animate-in zoom-in-95 duration-300">
            <div className="space-y-4 text-center">
              <div className="h-20 w-20 rounded-[2rem] bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 mx-auto">
                <Clock className="h-10 w-10" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-white uppercase italic tracking-tight">
                  Отложить задачу?
                </h3>
                <p className="text-sm text-zinc-500 font-medium leading-relaxed">
                  Задача вернется в общий список, и её сможет выполнить кто-то
                  другой или вы позже.
                </p>
              </div>
            </div>

            <div className="grid gap-3">
              <Button
                className="h-14 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black uppercase italic tracking-tighter shadow-lg transition-all active:scale-95"
                onClick={skipCurrentTask}
              >
                Да, отложить
              </Button>
              <Button
                variant="outline"
                className="h-14 rounded-2xl border-zinc-800 bg-zinc-900 text-zinc-400 font-black uppercase italic tracking-tighter transition-all active:scale-95"
                onClick={() => setShowSkipConfirm(false)}
              >
                Отмена
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
