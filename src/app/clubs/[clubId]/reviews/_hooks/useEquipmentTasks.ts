"use client";

import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { VerificationTask } from "../types";

export function useEquipmentTasks(clubId: string) {
  const [tasks, setTasks] = useState<VerificationTask[]>([]);
  const [isTasksLoading, setIsTasksLoading] = useState(true);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [reworkPhotos, setReworkPhotos] = useState<File[]>([]);
  const [reworkPhotosPreviews, setReworkPhotosPreviews] = useState<string[]>([]);
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);
  const [isSubmittingBatch, setIsSubmittingBatch] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerImage, setViewerImage] = useState("");
  const [currentTaskPhotos, setCurrentTaskPhotos] = useState<string[]>([]);
  const [filterZone, setFilterZone] = useState<string>("all");
  const [filterEmployee, setFilterEmployee] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterMonth, setFilterMonth] = useState<string>(() =>
    format(new Date(), "yyyy-MM"),
  );
  const [equipmentTab, setEquipmentTab] = useState<"active" | "history">(
    "active",
  );
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);

  // Reset filters when tab changes
  useEffect(() => {
    setFilterStatus("all");
    setFilterZone("all");
    setFilterEmployee("all");
  }, [equipmentTab]);

  const fetchTasks = async (
    id: string,
    status: "active" | "history" = "active",
    silent = false,
  ) => {
    if (!silent) setIsTasksLoading(true);
    try {
      const query = status === "history" ? "?status=history" : "";
      const res = await fetch(
        `/api/clubs/${id}/equipment/verification/list${query}`,
      );
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
        setSelectedTaskIds([]);
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      if (!silent) setIsTasksLoading(false);
    }
  };

  useEffect(() => {
    if (clubId) {
      fetchTasks(clubId, equipmentTab);
    }
  }, [equipmentTab, clubId]);

  // Computed values
  const zones = useMemo(() => {
    const unique = new Set(tasks.map((t) => t.zone_name || "Без зоны"));
    return Array.from(unique).sort();
  }, [tasks]);

  const employees = useMemo(() => {
    const unique = new Set(
      tasks.map((t) => {
        const name =
          t.completed_by_name ||
          (t.verification_status === "REJECTED" ? "На доработке" : "Неизвестный");
        return name;
      }),
    );
    return Array.from(unique).sort();
  }, [tasks]);

  const months = useMemo(() => {
    const currentMonth = format(new Date(), "yyyy-MM");
    const unique = new Set(
      tasks
        .map((t) => t.completed_at || t.due_date)
        .filter(Boolean)
        .map((date) => format(new Date(date), "yyyy-MM")),
    );
    unique.add(currentMonth);
    return Array.from(unique).sort((a, b) => b.localeCompare(a));
  }, [tasks]);

  const currentMonthIndex = useMemo(() => {
    return months.findIndex((m) => m === filterMonth);
  }, [months, filterMonth]);

  useEffect(() => {
    if (equipmentTab !== "history") return;
    if (!months.includes(filterMonth)) {
      const currentMonth = format(new Date(), "yyyy-MM");
      setFilterMonth(
        months.includes(currentMonth) ? currentMonth : months[0] || "all",
      );
    }
  }, [equipmentTab, months, filterMonth]);

  const groupedTasks = useMemo(() => {
    const filtered = tasks.filter((t) => {
      if (filterZone !== "all" && (t.zone_name || "Без зоны") !== filterZone)
        return false;
      if (
        filterEmployee !== "all" &&
        (t.completed_by_name || "Неизвестный") !== filterEmployee
      )
        return false;
      if (filterStatus !== "all" && t.verification_status !== filterStatus)
        return false;
      if (equipmentTab === "history" && filterMonth !== "all") {
        const dateValue = t.completed_at || t.due_date;
        if (!dateValue) return false;
        const monthKey = format(new Date(dateValue), "yyyy-MM");
        if (monthKey !== filterMonth) return false;
      }
      return true;
    });

    const groups: Record<string, VerificationTask[]> = {};
    filtered.forEach((task) => {
      const zone = task.zone_name || "Общая зона";
      if (!groups[zone]) groups[zone] = [];
      groups[zone].push(task);
    });

    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [tasks, filterZone, filterEmployee, filterStatus, filterMonth, equipmentTab]);

  // Handlers
  const handleVerifyTask = async (
    task: VerificationTask,
    action: "APPROVE" | "REJECT",
  ) => {
    if (action === "REJECT" && !comment.trim()) {
      alert("Пожалуйста, укажите причину возврата на доработку");
      return;
    }

    if (typeof window !== "undefined") {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    }
    const scrollY = typeof window !== "undefined" ? window.scrollY : 0;

    setIsSubmittingTask(true);
    try {
      let uploadedUrls: string[] = [];
      if (action === "REJECT" && reworkPhotos.length > 0) {
        const results = await Promise.all(
          reworkPhotos.map(async (file) => {
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
        );
        uploadedUrls = results.filter(Boolean) as string[];
      }

      const res = await fetch(
        `/api/clubs/${clubId}/equipment/maintenance/${task.id}/verify`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, comment, photos: uploadedUrls }),
        },
      );

      if (res.ok) {
        setTasks((prev) => prev.filter((t) => t.id !== task.id));
        if (expandedTaskId === task.id) {
          setExpandedTaskId(null);
          setComment("");
          setReworkPhotos([]);
          setReworkPhotosPreviews([]);
        }
        if (typeof window !== "undefined") {
          setTimeout(() => {
            window.scrollTo(0, scrollY);
          }, 0);
        }
      } else {
        alert("Ошибка при сохранении решения");
      }
    } catch (error) {
      console.error("Error verifying task:", error);
      alert("Произошла ошибка");
    } finally {
      setIsSubmittingTask(false);
    }
  };

  const handleRevertTask = async (task: VerificationTask) => {
    if (!clubId) return;
    if (
      !confirm(
        "Вернуть задачу на проверку? Она снова появится в списке 'Ожидают проверки'.",
      )
    )
      return;

    if (typeof window !== "undefined") {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    }
    const scrollY = typeof window !== "undefined" ? window.scrollY : 0;

    setIsSubmittingTask(true);
    try {
      const res = await fetch(
        `/api/clubs/${clubId}/equipment/maintenance/${task.id}/revert`,
        { method: "POST" },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Не удалось вернуть задачу на проверку");
        return;
      }
      await fetchTasks(clubId, equipmentTab, true);
      if (typeof window !== "undefined") {
        setTimeout(() => {
          window.scrollTo(0, scrollY);
        }, 0);
      }
    } catch (error) {
      console.error(error);
      alert("Ошибка сервера");
    } finally {
      setIsSubmittingTask(false);
    }
  };

  const handleSendToLaundry = async (task: VerificationTask) => {
    setIsSubmittingTask(true);
    try {
      const decisionComment = comment.trim() || "Направлено в стирку";
      const laundryRes = await fetch(`/api/clubs/${clubId}/laundry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          equipment_id: task.equipment_id,
          maintenance_task_id: task.id,
          title: comment.trim() || "Требует стирки",
          description: decisionComment,
          photos: task.photos || [],
          source: "INSPECTION_CENTER",
        }),
      });

      if (!laundryRes.ok) {
        alert("Не удалось отправить коврик в стирку");
        return;
      }

      const verifyRes = await fetch(
        `/api/clubs/${clubId}/equipment/maintenance/${task.id}/verify`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "APPROVE", comment: decisionComment }),
        },
      );

      if (!verifyRes.ok) {
        alert("Стирка создана, но не удалось закрыть проверку");
        fetchTasks(clubId, equipmentTab, true);
        return;
      }

      setTasks((prev) => prev.filter((t) => t.id !== task.id));
      if (expandedTaskId === task.id) {
        setExpandedTaskId(null);
        setComment("");
      }
    } catch (error) {
      console.error("Error sending to laundry:", error);
      alert("Произошла ошибка");
    } finally {
      setIsSubmittingTask(false);
    }
  };

  const openImage = (src: string, photos: string[], e: React.MouseEvent) => {
    e.stopPropagation();
    setViewerImage(src);
    setCurrentTaskPhotos(photos);
    setViewerOpen(true);
  };

  const handleNextImage = () => {
    const currentIndex = currentTaskPhotos.indexOf(viewerImage);
    if (currentIndex < currentTaskPhotos.length - 1) {
      setViewerImage(currentTaskPhotos[currentIndex + 1]);
    }
  };

  const handlePrevImage = () => {
    const currentIndex = currentTaskPhotos.indexOf(viewerImage);
    if (currentIndex > 0) {
      setViewerImage(currentTaskPhotos[currentIndex - 1]);
    }
  };

  const toggleExpand = (taskId: string) => {
    if (expandedTaskId === taskId) {
      setExpandedTaskId(null);
      setComment("");
    } else {
      setExpandedTaskId(taskId);
      setComment("");
    }
  };

  return {
    // State
    tasks,
    setTasks,
    isTasksLoading,
    expandedTaskId,
    comment,
    setComment,
    reworkPhotos,
    setReworkPhotos,
    reworkPhotosPreviews,
    setReworkPhotosPreviews,
    isSubmittingTask,
    isSubmittingBatch,
    setIsSubmittingBatch,
    viewerOpen,
    setViewerOpen,
    viewerImage,
    currentTaskPhotos,
    filterZone,
    setFilterZone,
    filterEmployee,
    setFilterEmployee,
    filterStatus,
    setFilterStatus,
    filterMonth,
    setFilterMonth,
    equipmentTab,
    setEquipmentTab,
    selectedTaskIds,
    setSelectedTaskIds,
    // Computed
    zones,
    employees,
    months,
    currentMonthIndex,
    groupedTasks,
    // Handlers
    fetchTasks,
    handleVerifyTask,
    handleRevertTask,
    handleSendToLaundry,
    openImage,
    handleNextImage,
    handlePrevImage,
    toggleExpand,
  };
}

export type UseEquipmentTasksReturn = ReturnType<typeof useEquipmentTasks>;
