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
} from "lucide-react";

import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  cn,
  formatDateKeyInTimezone,
  getMonthRangeInTimezone,
} from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { QRCode } from "@/components/qr/QRCode";

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
  session_id?: string;
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

  useEffect(() => {
    if (isSuccess) {
      alert("Обслуживание успешно завершено");
      setSelectedTaskIds([]);
      setSessionId(null);
    }
  }, [isSuccess]);

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
        onClick={() =>
          !isFree && !showAsCompleted && toggleTaskSelection(task.id)
        }
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
                    !isInCurrentSession && (
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
                            <Check className="h-3.5 w-3.5 stroke-[3]" />
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
                    ) : isInCurrentSession ? (
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
                    ) : (
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
                          if (isInProgress || isRework) {
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
                                ? isMobile
                                  ? "Открыть"
                                  : "QR-код"
                                : "Начать"}
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Rework Comment Box */}
              {isRejected && task.rejection_reason && (
                <div className="bg-rose-500/[0.03] border border-rose-500/10 rounded-2xl p-3 animate-in fade-in slide-in-from-top-1 duration-300">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] font-black text-rose-500/60 uppercase tracking-widest">
                      Замечание менеджера
                    </span>
                    <p className="text-[12px] text-rose-500/90 font-bold leading-tight italic">
                      "{task.rejection_reason}"
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
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 items-start">
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
        </div>
      )}

      {isMobile && (selectedTaskIds.length >= 2 || sessionId) && (
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
