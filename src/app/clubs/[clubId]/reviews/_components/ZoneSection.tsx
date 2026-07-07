"use client";

import { Loader2, CheckCircle2, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { VerificationTask } from "../types";
import { EquipmentTaskCard } from "./EquipmentTaskCard";

interface ZoneSectionProps {
  zoneName: string;
  zoneTasks: VerificationTask[];
  clubId: string;
  equipmentTab: "active" | "history";
  expandedTaskId: string | null;
  comment: string;
  setComment: (v: string) => void;
  reworkPhotos: File[];
  setReworkPhotos: React.Dispatch<React.SetStateAction<File[]>>;
  reworkPhotosPreviews: string[];
  setReworkPhotosPreviews: React.Dispatch<React.SetStateAction<string[]>>;
  isSubmittingTask: boolean;
  isSubmittingBatch: boolean;
  setIsSubmittingBatch: (v: boolean) => void;
  selectedTaskIds: string[];
  setSelectedTaskIds: React.Dispatch<React.SetStateAction<string[]>>;
  setTasks: React.Dispatch<React.SetStateAction<VerificationTask[]>>;
  openImage: (src: string, photos: string[], e: React.MouseEvent) => void;
  toggleExpand: (taskId: string) => void;
  handleVerifyTask: (task: VerificationTask, action: "APPROVE" | "REJECT") => void;
  handleRevertTask: (task: VerificationTask) => void;
  handleSendToLaundry: (task: VerificationTask) => void;
}

export function ZoneSection({
  zoneName,
  zoneTasks,
  clubId,
  equipmentTab,
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
  selectedTaskIds,
  setSelectedTaskIds,
  setTasks,
  openImage,
  toggleExpand,
  handleVerifyTask,
  handleRevertTask,
  handleSendToLaundry,
}: ZoneSectionProps) {
  return (
    <div className="space-y-4 pb-24">
      {/* Zone header */}
      <div className="flex items-center justify-between gap-3 pb-2 border-b">
        <div className="flex items-center gap-2 min-w-0">
          <Layers className="h-4 w-4 sm:h-5 sm:w-5 text-slate-500 shrink-0" />
          <h2 className="text-base sm:text-xl font-semibold text-slate-800 truncate">{zoneName}</h2>
          <Badge variant="secondary" className="shrink-0">
            {zoneTasks.length}
          </Badge>
        </div>

        {equipmentTab === "active" && zoneTasks.length > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            {(() => {
              const zoneTaskIds = zoneTasks.map((t) => t.id);
              const selectedZoneTaskIds = selectedTaskIds.filter((id) =>
                zoneTaskIds.includes(id),
              );
              const isAllSelected =
                selectedZoneTaskIds.length === zoneTasks.length &&
                zoneTasks.length > 0;

              const handleSelectAllInZone = (checked: boolean) => {
                if (checked) {
                  setSelectedTaskIds((prev) =>
                    Array.from(new Set([...prev, ...zoneTaskIds])),
                  );
                } else {
                  setSelectedTaskIds((prev) =>
                    prev.filter((id) => !zoneTaskIds.includes(id)),
                  );
                }
              };

              const handleVerifySelectedInZone = async () => {
                if (selectedZoneTaskIds.length === 0) return;
                if (
                  !confirm(
                    `Вы уверены, что хотите одобрить все выбранные задачи в зоне "${zoneName}" (${selectedZoneTaskIds.length} шт.)?`,
                  )
                ) {
                  return;
                }

                setIsSubmittingBatch(true);
                try {
                  const res = await fetch(
                    `/api/clubs/${clubId}/equipment/maintenance/verify-batch`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        action: "APPROVE",
                        taskIds: selectedZoneTaskIds,
                        comment: `Пакетное одобрение проверок в зоне "${zoneName}"`,
                      }),
                    },
                  );

                  if (res.ok) {
                    setTasks((prev) =>
                      prev.filter((t) => !selectedZoneTaskIds.includes(t.id)),
                    );
                    setSelectedTaskIds((prev) =>
                      prev.filter((id) => !selectedZoneTaskIds.includes(id)),
                    );
                  } else {
                    const errData = await res.json();
                    alert(
                      `Ошибка при одобрении: ${errData.error || "Неизвестная ошибка"}`,
                    );
                  }
                } catch (error) {
                  console.error("Error in batch verification:", error);
                  alert("Произошла ошибка при выполнении операции");
                } finally {
                  setIsSubmittingBatch(false);
                }
              };

              return (
                <div className="flex items-center gap-1.5">
                  {/* Compact select-all toggle */}
                  <button
                    type="button"
                    onClick={() => handleSelectAllInZone(!isAllSelected)}
                    className={`flex items-center gap-1.5 rounded-lg border h-8 px-2 text-xs font-medium transition-colors select-none ${
                      isAllSelected
                        ? "bg-slate-900 border-slate-900 text-white"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Checkbox
                      checked={isAllSelected}
                      className="h-3.5 w-3.5 pointer-events-none"
                      tabIndex={-1}
                    />
                    <span className="hidden sm:inline whitespace-nowrap">Все в зоне</span>
                    <span className="sm:hidden">Все</span>
                  </button>

                  {/* Approve button — compact with count badge */}
                  {selectedZoneTaskIds.length > 0 && (
                    <button
                      type="button"
                      onClick={handleVerifySelectedInZone}
                      disabled={isSubmittingBatch}
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white h-8 px-2 text-xs font-semibold transition-colors shadow-sm"
                    >
                      {isSubmittingBatch ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      )}
                      <span className="hidden sm:inline whitespace-nowrap">Одобрить</span>
                      <span className="inline-flex items-center justify-center bg-white/25 rounded px-1 min-w-[18px] h-5 text-[11px] font-bold tabular-nums">
                        {selectedZoneTaskIds.length}
                      </span>
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Task list */}
      <div className="flex flex-col gap-3 sm:gap-3">
        {zoneTasks.map((task) => (
          <EquipmentTaskCard
            key={task.id}
            task={task}
            isExpanded={expandedTaskId === task.id}
            isSelected={selectedTaskIds.includes(task.id)}
            onToggleSelect={(checked) => {
              if (checked) {
                setSelectedTaskIds((prev) => [...prev, task.id]);
              } else {
                setSelectedTaskIds((prev) =>
                  prev.filter((id) => id !== task.id),
                );
              }
            }}
            onToggleExpand={() => toggleExpand(task.id)}
            equipmentTab={equipmentTab}
            comment={comment}
            setComment={setComment}
            reworkPhotos={reworkPhotos}
            setReworkPhotos={setReworkPhotos}
            reworkPhotosPreviews={reworkPhotosPreviews}
            setReworkPhotosPreviews={setReworkPhotosPreviews}
            isSubmittingTask={isSubmittingTask}
            openImage={openImage}
            onVerify={handleVerifyTask}
            onRevert={handleRevertTask}
            onSendToLaundry={handleSendToLaundry}
          />
        ))}
      </div>
    </div>
  );
}
