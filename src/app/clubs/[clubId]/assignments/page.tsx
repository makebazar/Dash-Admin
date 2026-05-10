"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  Clock,
  CheckCircle2,
  Circle,
  AlertCircle,
  MessageSquare,
  User,
  Calendar,
  ArrowRight,
  Loader2,
  Archive,
  LayoutDashboard,
} from "lucide-react";
import { PageShell, PageHeader } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { format, differenceInHours } from "date-fns";
import { ru } from "date-fns/locale";

import { AssignmentModal } from "./_components/AssignmentModal";
import { CreateAssignmentModal } from "./_components/CreateAssignmentModal";

interface Task {
  id: string;
  title: string;
  description: string;
  status: "OPEN" | "IN_PROGRESS" | "REVIEW" | "DONE" | "CANCELLED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  assigned_to: string | null;
  assigned_to_name: string | null;
  created_by: string;
  created_by_name: string;
  due_date: string | null;
  linked_issue_id: string | null;
  comments_count: number;
  created_at: string;
  updated_at?: string;
  report_text?: string;
}

const statusConfig = {
  OPEN: {
    label: "К выполнению",
    color: "bg-slate-100 text-slate-700 border-slate-200",
    icon: <Circle className="h-3 w-3" />,
  },
  IN_PROGRESS: {
    label: "В работе",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    icon: <Clock className="h-3 w-3" />,
  },
  REVIEW: {
    label: "Проверка",
    color: "bg-amber-100 text-amber-700 border-amber-200",
    icon: <AlertCircle className="h-3 w-3" />,
  },
  DONE: {
    label: "Готово",
    color: "bg-green-100 text-green-700 border-green-200",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  CANCELLED: {
    label: "Отменено",
    color: "bg-slate-100 text-slate-400 border-slate-200",
    icon: <Circle className="h-3 w-3" />,
  },
};

const priorityConfig = {
  LOW: { label: "Низкий", color: "bg-slate-50 text-slate-600" },
  MEDIUM: { label: "Средний", color: "bg-blue-50 text-blue-600" },
  HIGH: { label: "Высокий", color: "bg-orange-50 text-orange-600" },
  CRITICAL: { label: "Критический", color: "bg-red-50 text-red-600" },
};

export default function AssignmentsPage() {
  const { clubId } = useParams();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"board" | "archive">("board");

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  const fetchTasks = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/clubs/${clubId}/employee-tasks`);
      const data = await res.json();
      if (res.ok) {
        setTasks(data.tasks || []);
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setIsLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsTaskModalOpen(true);
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter(
      (task) =>
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.assigned_to_name
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase()),
    );
  }, [tasks, searchQuery]);

  const { boardTasks, archiveTasks } = useMemo(() => {
    const now = new Date();
    const board: Task[] = [];
    const archive: Task[] = [];

    filteredTasks.forEach((task) => {
      if (task.status === "DONE" || task.status === "CANCELLED") {
        const updateDate = new Date(task.updated_at || task.created_at);
        const hoursSinceUpdate = differenceInHours(now, updateDate);

        // Show in board if updated within 48 hours, otherwise archive
        if (hoursSinceUpdate <= 48) {
          board.push(task);
        } else {
          archive.push(task);
        }
      } else {
        board.push(task);
      }
    });

    return { boardTasks: board, archiveTasks: archive };
  }, [filteredTasks]);

  const columns = [
    { id: "OPEN", title: "К выполнению", status: "OPEN" },
    { id: "IN_PROGRESS", title: "В работе", status: "IN_PROGRESS" },
    { id: "REVIEW", title: "На проверке", status: "REVIEW" },
    { id: "DONE", title: "Выполнено", status: "DONE" },
  ];

  return (
    <PageShell>
      <PageHeader
        title="Поручения сотрудникам"
        description="Управление задачами, контроль выполнения и отчетность"
      >
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex items-center bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode("board")}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                viewMode === "board"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
              )}
            >
              <LayoutDashboard className="h-4 w-4" />
              Доска
            </button>
            <button
              onClick={() => setViewMode("archive")}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                viewMode === "archive"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
              )}
            >
              <Archive className="h-4 w-4" />
              Архив ({archiveTasks.length})
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Поиск задач..."
              className="pl-9 bg-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button
            onClick={() => setIsCreateModalOpen(true)}
            className="gap-2 w-full sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            Новое поручение
          </Button>
        </div>
      </PageHeader>

      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : viewMode === "board" ? (
          <div className="flex h-[calc(100vh-200px)] gap-4 overflow-x-auto pb-4 px-1">
            {columns.map((column) => (
              <div
                key={column.id}
                className="flex flex-col w-80 shrink-0 bg-slate-50/50 rounded-xl border border-slate-100 p-3"
              >
                <div className="flex items-center justify-between mb-4 px-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-700">
                      {column.title}
                    </h3>
                    <Badge
                      variant="secondary"
                      className="bg-white text-slate-500 border-slate-100"
                    >
                      {
                        boardTasks.filter((t) => t.status === column.status)
                          .length
                      }
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-400"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex-1 flex flex-col gap-3 overflow-y-auto min-h-0 pr-1">
                  {boardTasks
                    .filter((t) => t.status === column.status)
                    .map((task) => (
                      <Card
                        key={task.id}
                        onClick={() => handleTaskClick(task)}
                        className="group hover:shadow-md transition-shadow cursor-pointer border-slate-200/60 overflow-hidden"
                      >
                        <CardContent className="p-3 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <Badge
                              className={cn(
                                "text-[10px] px-1.5 h-5",
                                priorityConfig[task.priority].color,
                              )}
                              variant="outline"
                            >
                              {priorityConfig[task.priority].label}
                            </Badge>
                            {task.linked_issue_id && (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 h-5 bg-amber-50 text-amber-600 border-amber-100"
                              >
                                Инцидент
                              </Badge>
                            )}
                          </div>

                          <h4 className="text-sm font-medium text-slate-900 leading-snug group-hover:text-blue-600 transition-colors">
                            {task.title}
                          </h4>

                          {task.description && (
                            <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                              {task.description}
                            </p>
                          )}

                          <div className="pt-2 flex items-center justify-between border-t border-slate-50 mt-2">
                            <div className="flex items-center gap-1.5 text-slate-500">
                              <User className="h-3 w-3" />
                              <span className="text-[11px]">
                                {task.assigned_to_name || "Не назначен"}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 text-slate-400">
                              {task.comments_count > 0 && (
                                <div className="flex items-center gap-1">
                                  <MessageSquare className="h-3 w-3" />
                                  <span className="text-[10px]">
                                    {task.comments_count}
                                  </span>
                                </div>
                              )}
                              {task.due_date && (
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  <span className="text-[10px]">
                                    {format(new Date(task.due_date), "d MMM", {
                                      locale: ru,
                                    })}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-1 overflow-y-auto max-h-[calc(100vh-200px)] custom-scrollbar">
            {archiveTasks.length === 0 ? (
              <div className="col-span-full h-64 flex flex-col items-center justify-center text-slate-400">
                <Archive className="h-12 w-12 mb-4 opacity-20" />
                <p>В архиве нет задач</p>
              </div>
            ) : (
              archiveTasks.map((task) => (
                <Card
                  key={task.id}
                  onClick={() => handleTaskClick(task)}
                  className="group hover:shadow-md transition-shadow cursor-pointer border-slate-200/60 overflow-hidden opacity-80 hover:opacity-100"
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex gap-2">
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-[10px] px-1.5 h-5",
                            task.status === "CANCELLED"
                              ? "bg-slate-100 text-slate-500"
                              : "bg-green-100 text-green-700",
                          )}
                        >
                          {task.status === "CANCELLED" ? "Отменено" : "Готово"}
                        </Badge>
                        {task.linked_issue_id && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 h-5 bg-amber-50 text-amber-600 border-amber-100"
                          >
                            Инцидент
                          </Badge>
                        )}
                      </div>
                    </div>

                    <h4 className="text-sm font-medium text-slate-900 leading-snug group-hover:text-blue-600 transition-colors">
                      {task.title}
                    </h4>

                    <div className="pt-2 flex items-center justify-between border-t border-slate-50 mt-2">
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <User className="h-3 w-3" />
                        <span className="text-[11px]">
                          {task.assigned_to_name || "Не назначен"}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {format(
                          new Date(task.updated_at || task.created_at),
                          "d MMM yyyy",
                          { locale: ru },
                        )}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </div>

      <CreateAssignmentModal
        isOpen={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        clubId={clubId as string}
        onCreated={fetchTasks}
        isLight={true}
      />

      <AssignmentModal
        isOpen={isTaskModalOpen}
        onOpenChange={setIsTaskModalOpen}
        task={selectedTask}
        clubId={clubId as string}
        onUpdate={fetchTasks}
        isLight={true}
      />
    </PageShell>
  );
}
