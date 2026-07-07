"use client";

import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { Evaluation, EvaluationDetail } from "../types";

export function useChecklists(clubId: string) {
  const [history, setHistory] = useState<Evaluation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEvaluation, setSelectedEvaluation] =
    useState<EvaluationDetail | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [reviewItems, setReviewItems] = useState<
    Record<number, { is_accepted: boolean; admin_comment: string }>
  >({});
  const [reviewerNote, setReviewerNote] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [deletingChecklistId, setDeletingChecklistId] = useState<number | null>(
    null,
  );
  const [deleteChecklistTarget, setDeleteChecklistTarget] =
    useState<Evaluation | null>(null);
  const [restoringChecklistId, setRestoringChecklistId] = useState<
    number | null
  >(null);
  const [restoreChecklistTarget, setRestoreChecklistTarget] =
    useState<Evaluation | null>(null);
  const [checklistsTab, setChecklistsTab] = useState<"active" | "history">(
    "active",
  );
  const [filterChecklistEmployee, setFilterChecklistEmployee] =
    useState<string>("all");
  const [filterChecklistStatus, setFilterChecklistStatus] =
    useState<string>("all");
  const [filterChecklistMonth, setFilterChecklistMonth] = useState<string>(() =>
    format(new Date(), "yyyy-MM"),
  );

  const fetchChecklists = async (
    id: string,
    status: "active" | "history" = "active",
  ) => {
    setIsLoading(true);
    try {
      const query = status === "history" ? "?status=history" : "?status=active";
      const res = await fetch(`/api/clubs/${id}/evaluations${query}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setHistory(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (clubId) {
      fetchChecklists(clubId, checklistsTab);
    }
  }, [checklistsTab, clubId]);

  // Computed
  const filteredChecklists = useMemo(() => {
    return history.filter((item) => {
      if (filterChecklistStatus !== "all") {
        if (filterChecklistStatus === "approved" && item.status !== "approved")
          return false;
        if (filterChecklistStatus === "rejected" && item.status !== "rejected")
          return false;
        if (filterChecklistStatus === "pending" && item.status !== "pending")
          return false;
      }
      if (filterChecklistEmployee !== "all") {
        if (item.employee_name !== filterChecklistEmployee) return false;
      }
      if (checklistsTab === "history" && filterChecklistMonth !== "all") {
        const date = item.evaluation_date || item.created_at;
        if (!date) return false;
        const itemMonth = format(new Date(date), "yyyy-MM");
        if (itemMonth !== filterChecklistMonth) return false;
      }
      return true;
    });
  }, [history, filterChecklistStatus, filterChecklistEmployee, filterChecklistMonth, checklistsTab]);

  const checklistMonths = useMemo(() => {
    const months = Array.from(
      new Set(
        history
          .map((t) => {
            const date = t.evaluation_date || t.created_at;
            return date ? format(new Date(date), "yyyy-MM") : null;
          })
          .filter(Boolean) as string[],
      ),
    );
    const currentMonth = format(new Date(), "yyyy-MM");
    if (!months.includes(currentMonth)) months.push(currentMonth);
    return months.sort((a, b) => b.localeCompare(a));
  }, [history]);

  const checklistMonthIndex = checklistMonths.indexOf(filterChecklistMonth);

  useEffect(() => {
    if (
      checklistsTab === "history" &&
      checklistMonths.length > 0 &&
      !checklistMonths.includes(filterChecklistMonth)
    ) {
      setFilterChecklistMonth(checklistMonths[0]);
    }
  }, [checklistMonths, filterChecklistMonth, checklistsTab]);

  const pendingEvaluations = history.filter(
    (h) => h.status === "pending" || !h.status,
  ).length;

  // Handlers
  const handleReviewItemChange = (
    responseId: number,
    field: "is_accepted" | "admin_comment",
    value: any,
  ) => {
    setReviewItems((prev) => ({
      ...prev,
      [responseId]: {
        ...prev[responseId],
        [field]: value,
      },
    }));
  };

  const submitReview = async (status: "approved" | "rejected") => {
    if (!selectedEvaluation) return;
    setIsSubmittingReview(true);
    try {
      const itemsToUpdate = Object.entries(reviewItems).map(([id, data]) => ({
        response_id: parseInt(id),
        is_accepted: data.is_accepted,
        admin_comment: data.admin_comment,
      }));

      const res = await fetch(
        `/api/clubs/${clubId}/evaluations/${selectedEvaluation.id}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, reviewer_note: reviewerNote, items: itemsToUpdate }),
        },
      );

      if (res.ok) {
        const result = await res.json();
        setHistory((prev) =>
          prev.map((item) =>
            item.id === selectedEvaluation.id
              ? { ...item, status, total_score: result.new_score, reviewer_note: reviewerNote }
              : item,
          ),
        );
        setSelectedEvaluation(null);
        setIsReviewMode(false);
      } else {
        alert("Ошибка сохранения проверки");
      }
    } catch (error) {
      console.error(error);
      alert("Ошибка сервера");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleDeleteChecklist = (evaluation: Evaluation, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDeleteChecklistTarget(evaluation);
  };

  const handleRestoreChecklist = (evaluation: Evaluation, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setRestoreChecklistTarget(evaluation);
  };

  const confirmDeleteChecklist = async () => {
    if (!deleteChecklistTarget) return;
    setDeletingChecklistId(deleteChecklistTarget.id);
    try {
      const res = await fetch(
        `/api/clubs/${clubId}/evaluations/${deleteChecklistTarget.id}`,
        { method: "DELETE" },
      );
      if (res.ok) {
        setHistory((prev) =>
          prev.filter((item) => item.id !== deleteChecklistTarget.id),
        );
        if (selectedEvaluation?.id === deleteChecklistTarget.id) {
          setSelectedEvaluation(null);
          setIsReviewMode(false);
        }
        setDeleteChecklistTarget(null);
      } else {
        alert("Ошибка при удалении");
      }
    } catch (error) {
      console.error("Error deleting checklist:", error);
      alert("Произошла ошибка");
    } finally {
      setDeletingChecklistId(null);
    }
  };

  const confirmRestoreChecklist = async () => {
    if (!restoreChecklistTarget) return;
    setRestoringChecklistId(restoreChecklistTarget.id);
    try {
      const res = await fetch(
        `/api/clubs/${clubId}/evaluations/${restoreChecklistTarget.id}/restore`,
        { method: "POST" },
      );
      if (res.ok) {
        setHistory((prev) =>
          prev.filter((item) => item.id !== restoreChecklistTarget.id),
        );
        if (selectedEvaluation?.id === restoreChecklistTarget.id) {
          setSelectedEvaluation(null);
          setIsReviewMode(false);
        }
        setRestoreChecklistTarget(null);
      } else {
        alert("Ошибка при возврате");
      }
    } catch (error) {
      console.error("Error restoring checklist:", error);
      alert("Произошла ошибка");
    } finally {
      setRestoringChecklistId(null);
    }
  };

  return {
    // State
    history,
    isLoading,
    selectedEvaluation,
    setSelectedEvaluation,
    photoPreviewUrl,
    setPhotoPreviewUrl,
    isReviewMode,
    setIsReviewMode,
    reviewItems,
    reviewerNote,
    setReviewerNote,
    isSubmittingReview,
    deletingChecklistId,
    deleteChecklistTarget,
    setDeleteChecklistTarget,
    restoringChecklistId,
    restoreChecklistTarget,
    setRestoreChecklistTarget,
    checklistsTab,
    setChecklistsTab,
    filterChecklistEmployee,
    setFilterChecklistEmployee,
    filterChecklistStatus,
    setFilterChecklistStatus,
    filterChecklistMonth,
    setFilterChecklistMonth,
    // Computed
    filteredChecklists,
    checklistMonths,
    checklistMonthIndex,
    pendingEvaluations,
    // Handlers
    fetchChecklists,
    handleReviewItemChange,
    submitReview,
    handleDeleteChecklist,
    handleRestoreChecklist,
    confirmDeleteChecklist,
    confirmRestoreChecklist,
  };
}

export type UseChecklistsReturn = ReturnType<typeof useChecklists>;
