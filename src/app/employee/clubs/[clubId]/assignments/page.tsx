"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Clock,
  CheckCircle2,
  Circle,
  AlertCircle,
  MessageSquare,
  Calendar,
  ChevronLeft,
  Loader2,
  Briefcase,
  RefreshCcw,
  User,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { AssignmentModal } from "@/app/clubs/[clubId]/assignments/_components/AssignmentModal";

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
}

const statusConfig = {
  OPEN: {
    label: "Новое",
    color: "bg-slate-100 text-slate-700 border-none",
    icon: <Circle className="h-3 w-3" />,
  },
  IN_PROGRESS: {
    label: "В работе",
    color: "bg-blue-500 text-white border-none",
    icon: <Clock className="h-3 w-3" />,
  },
  REVIEW: {
    label: "На проверке",
    color: "bg-amber-500 text-white border-none",
    icon: <AlertCircle className="h-3 w-3" />,
  },
  DONE: {
    label: "Готово",
    color: "bg-emerald-500 text-white border-none",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  CANCELLED: {
    label: "Отменено",
    color: "bg-slate-200 text-slate-500 border-none",
    icon: <Circle className="h-3 w-3" />,
  },
};

const priorityConfig = {
  LOW: { label: "Низкий", color: "bg-slate-50 text-slate-600" },
  MEDIUM: { label: "Средний", color: "bg-blue-50 text-blue-600" },
  HIGH: { label: "Высокий", color: "bg-orange-50 text-orange-600" },
  CRITICAL: { label: "Критический", color: "bg-red-50 text-red-600" },
};

export default function EmployeeAssignmentsPage() {
  const { clubId } = useParams();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col pb-24">
      {/* Header Section */}
      <div className="px-6 pt-12 pb-6 space-y-2">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tighter text-foreground uppercase">
            Поручения
          </h1>
          <p className="text-sm font-medium text-muted-foreground">
            Задачи от руководства и системы
          </p>
        </div>
      </div>

      <div className="px-6 space-y-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
              Загрузка...
            </p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-6 text-center">
            <div className="w-20 h-20 bg-card rounded-3xl flex items-center justify-center border border-border shadow-sm">
              <Briefcase className="h-10 w-10 text-muted-foreground/20" />
            </div>
            <div className="space-y-2">
              <p className="font-black text-lg uppercase tracking-tight text-foreground">
                Задач пока нет
              </p>
              <p className="text-xs font-medium text-muted-foreground max-w-[200px] mx-auto leading-relaxed">
                Когда вам назначат поручение, оно появится в этом списке
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-500 rounded-2xl p-4 text-white shadow-lg shadow-blue-500/10">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-60">
                  В работе
                </p>
                <p className="text-3xl font-black mt-1">
                  {
                    tasks.filter(
                      (t) =>
                        t.status === "IN_PROGRESS" || t.status === "REVIEW",
                    ).length
                  }
                </p>
              </div>
              <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Новые
                </p>
                <p className="text-3xl font-black mt-1 text-foreground">
                  {tasks.filter((t) => t.status === "OPEN").length}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {tasks.map((task) => (
                <Card
                  key={task.id}
                  className={cn(
                    "rounded-2xl border border-border bg-card shadow-sm active:scale-[0.97] transition-all cursor-pointer overflow-hidden",
                    task.status === "DONE" && "opacity-50 grayscale-[0.5]",
                  )}
                  onClick={() => handleTaskClick(task)}
                >
                  <CardContent className="p-0">
                    <div className="p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <Badge
                          className={cn(
                            "text-[10px] font-black uppercase tracking-tighter px-2.5 h-6",
                            statusConfig[task.status].color,
                          )}
                        >
                          {statusConfig[task.status].label}
                        </Badge>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span className="text-[10px] font-bold text-muted-foreground">
                            {task.due_date
                              ? format(new Date(task.due_date), "d MMM", {
                                  locale: ru,
                                })
                              : "Без срока"}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <h3 className="text-lg font-bold leading-tight text-foreground">
                          {task.title}
                        </h3>
                        {task.description && (
                          <p className="text-xs font-medium text-muted-foreground line-clamp-2 leading-relaxed">
                            {task.description}
                          </p>
                        )}
                      </div>

                      <div className="pt-4 flex items-center justify-between border-t border-border/50">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-accent flex items-center justify-center">
                            <User className="h-3 w-3 text-muted-foreground" />
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-tight text-muted-foreground">
                            {task.created_by_name}
                          </span>
                        </div>

                        <div className="flex items-center gap-4">
                          {task.comments_count > 0 && (
                            <div className="flex items-center gap-1 text-primary">
                              <MessageSquare className="h-3.5 w-3.5" />
                              <span className="text-[11px] font-black">
                                {task.comments_count}
                              </span>
                            </div>
                          )}
                          <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center text-muted-foreground">
                            <ArrowRight className="h-4 w-4" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>

      <AssignmentModal
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        task={selectedTask}
        clubId={clubId as string}
        onUpdate={fetchTasks}
      />
    </div>
  );
}
