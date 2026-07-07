"use client";

import { format } from "date-fns";
import { ru } from "date-fns/locale";
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Eye,
  Loader2,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { cn, isLaundryEquipmentType } from "@/lib/utils";
import { VerificationTask } from "../types";
import {
  getLaundryStatusLabel,
  getLatestTaskSubmission,
  getPreviousTaskSubmission,
  getLatestTaskRejection,
  formatTaskMessageStamp,
} from "../_utils/reviews-utils";

interface EquipmentTaskCardProps {
  task: VerificationTask;
  isExpanded: boolean;
  isSelected: boolean;
  onToggleSelect: (checked: boolean) => void;
  onToggleExpand: () => void;
  equipmentTab: "active" | "history";
  comment: string;
  setComment: (v: string) => void;
  reworkPhotos: File[];
  setReworkPhotos: React.Dispatch<React.SetStateAction<File[]>>;
  reworkPhotosPreviews: string[];
  setReworkPhotosPreviews: React.Dispatch<React.SetStateAction<string[]>>;
  isSubmittingTask: boolean;
  openImage: (src: string, photos: string[], e: React.MouseEvent) => void;
  onVerify: (task: VerificationTask, action: "APPROVE" | "REJECT") => void;
  onRevert: (task: VerificationTask) => void;
  onSendToLaundry: (task: VerificationTask) => void;
}

export function EquipmentTaskCard({
  task,
  isExpanded,
  isSelected,
  onToggleSelect,
  onToggleExpand,
  equipmentTab,
  comment,
  setComment,
  reworkPhotos,
  setReworkPhotos,
  reworkPhotosPreviews,
  setReworkPhotosPreviews,
  isSubmittingTask,
  openImage,
  onVerify,
  onRevert,
  onSendToLaundry,
}: EquipmentTaskCardProps) {
  const isLaundryItem = isLaundryEquipmentType(task.equipment_type);
  const latestSubmission = getLatestTaskSubmission(task);
  const previousSubmission = getPreviousTaskSubmission(task);
  const latestRejection = getLatestTaskRejection(task);
  const isResubmittedForReview =
    task.verification_status === "PENDING" &&
    latestSubmission?.event_type === "RESUBMITTED";

  return (
    <div
      className={cn(
        "bg-white transition-all overflow-hidden rounded-2xl border border-slate-200 shadow-sm",
        "sm:rounded-xl",
        isExpanded ? "border-slate-300 shadow-md" : "hover:border-slate-300",
      )}
    >
      {/* Summary Row */}
      <div
        className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors gap-4"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {equipmentTab === "active" && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={(checked) => onToggleSelect(!!checked)}
              onClick={(e) => e.stopPropagation()}
              className="h-5 w-5 rounded border-slate-300 text-primary focus:ring-primary shrink-0"
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2 mb-1 flex-wrap">
              <span className="font-semibold text-[17px] leading-6 text-slate-950 break-words">
                {task.equipment_name}
              </span>
              {isLaundryItem && (
                <Badge
                  variant="outline"
                  className="border-violet-200 bg-violet-50 text-violet-700"
                >
                  Коврик
                </Badge>
              )}
              {task.laundry_status && (
                <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-0">
                  {getLaundryStatusLabel(task.laundry_status)}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
              {task.workstation_name && (
                <span className="text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded-md font-medium">
                  {task.workstation_name}
                </span>
              )}
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs text-slate-500 uppercase tracking-wide font-medium">
                {task.equipment_type_name || task.equipment_type || "Устройство"}
              </span>
            </div>
          </div>
        </div>

        <div className="w-full border-t border-slate-100 pt-3 sm:mr-1 sm:w-auto sm:border-t-0 sm:pt-0">
          {/* Mobile layout */}
          <div className="sm:hidden">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex flex-col text-left">
                <span className="text-sm font-medium leading-5 text-slate-700">
                  {task.completed_by_name?.split(" ")[0] ||
                    (task.verification_status === "REJECTED"
                      ? "На доработке"
                      : "—")}
                </span>
                <span className="mt-1 text-xs leading-4 text-slate-400">
                  {task.completed_at
                    ? format(new Date(task.completed_at), "dd.MM в HH:mm", {
                        locale: ru,
                      })
                    : task.verified_at
                      ? `Отклонен ${format(new Date(task.verified_at), "dd.MM в HH:mm", { locale: ru })}`
                      : "-"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {task.photos && task.photos.length > 0 && (
                  <div className="inline-flex items-center gap-1.5 rounded-full px-1 text-blue-600">
                    <Camera className="h-3.5 w-3.5" />
                    <span className="text-xs font-semibold">
                      {task.photos.length}
                    </span>
                  </div>
                )}
                <div className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500">
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </div>
              </div>
            </div>

            {(task.verification_status === "APPROVED" ||
              task.verification_status === "REJECTED" ||
              task.verification_status === "PENDING") && (
              <div className="mt-2 flex items-center justify-between gap-3 text-xs">
                {task.verification_status === "APPROVED" && (
                  <div className="inline-flex max-w-full items-center text-[11px] font-medium leading-4 text-green-700">
                    Одобрено
                  </div>
                )}
                {task.verification_status === "REJECTED" && (
                  <div className="inline-flex max-w-full items-center text-[11px] font-medium leading-4 text-amber-700">
                    На доработке {task.rework_days || 0} дн.
                  </div>
                )}
                {task.verification_status === "PENDING" && (
                  <div
                    className={cn(
                      "inline-flex max-w-full items-center text-[11px] font-medium leading-4",
                      isResubmittedForReview ? "text-blue-600" : "text-slate-600",
                    )}
                  >
                    {isResubmittedForReview ? "После доработки" : "На проверке"}
                  </div>
                )}
                <div className="h-px flex-1 bg-slate-100" />
              </div>
            )}
          </div>

          {/* Desktop layout */}
          <div className="hidden sm:flex items-center gap-4">
            {(task.verification_status === "APPROVED" ||
              task.verification_status === "REJECTED" ||
              task.verification_status === "PENDING") && (
              <div
                className={cn(
                  "whitespace-nowrap text-xs font-medium",
                  task.verification_status === "APPROVED" && "text-green-700",
                  task.verification_status === "REJECTED" && "text-amber-700",
                  task.verification_status === "PENDING" &&
                    (isResubmittedForReview
                      ? "text-blue-600"
                      : "text-slate-600"),
                )}
              >
                {task.verification_status === "APPROVED" && "Одобрено"}
                {task.verification_status === "REJECTED" &&
                  `На доработке ${task.rework_days || 0} дн.`}
                {task.verification_status === "PENDING" &&
                  (isResubmittedForReview ? "После доработки" : "На проверке")}
              </div>
            )}

            <div className="text-right">
              <div className="text-sm font-medium leading-5 text-slate-700">
                {task.completed_by_name?.split(" ")[0] ||
                  (task.verification_status === "REJECTED"
                    ? "На доработке"
                    : "—")}
              </div>
              <div className="mt-0.5 text-xs leading-4 text-slate-400">
                {task.completed_at
                  ? format(new Date(task.completed_at), "dd.MM в HH:mm", {
                      locale: ru,
                    })
                  : task.verified_at
                    ? `Отклонен ${format(new Date(task.verified_at), "dd.MM в HH:mm", { locale: ru })}`
                    : "-"}
              </div>
            </div>

            <div className="flex items-center gap-3 pl-3 border-l border-slate-100">
              {task.photos && task.photos.length > 0 && (
                <div className="inline-flex items-center gap-1 text-blue-600">
                  <Camera className="h-3.5 w-3.5" />
                  <span className="text-xs font-semibold">
                    {task.photos.length}
                  </span>
                </div>
              )}
              <div className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500">
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t bg-white p-6 sm:px-8 pb-8 animate-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)] gap-6">
            {/* Photos section */}
            <div className="space-y-3">
              <div
                className={cn(
                  "grid gap-3",
                  previousSubmission ? "lg:grid-cols-2" : "grid-cols-1",
                )}
              >
                {/* Latest submission */}
                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="mb-3">
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {latestSubmission?.event_type === "RESUBMITTED"
                          ? "После доработки"
                          : "Фотоотчет"}
                      </div>
                      {formatTaskMessageStamp(latestSubmission?.created_at) && (
                        <div className="mt-1 text-xs text-slate-400">
                          {formatTaskMessageStamp(latestSubmission?.created_at)}
                        </div>
                      )}
                    </div>
                  </div>

                  {(latestSubmission?.photos_before &&
                    latestSubmission.photos_before.length > 0) ||
                  (latestSubmission?.photos_after &&
                    latestSubmission.photos_after.length > 0) ||
                  (latestSubmission?.photos &&
                    latestSubmission.photos.length > 0) ? (
                    <div
                      className={cn(
                        "grid gap-4",
                        latestSubmission?.photos_before &&
                          latestSubmission.photos_before.length > 0
                          ? "grid-cols-1 sm:grid-cols-2"
                          : "grid-cols-1",
                      )}
                    >
                      {latestSubmission?.photos_before &&
                        latestSubmission.photos_before.length > 0 && (
                          <div className="space-y-2">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              Состояние ДО
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {latestSubmission.photos_before.map((photo, i) => (
                                <div
                                  key={`before-${i}`}
                                  className="group relative h-20 w-20 sm:h-24 sm:w-24 overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200 cursor-zoom-in transition-all hover:ring-2 hover:ring-slate-300"
                                  onClick={(e) =>
                                    openImage(
                                      photo,
                                      latestSubmission.photos_before || [],
                                      e,
                                    )
                                  }
                                >
                                  <img
                                    src={photo}
                                    alt={`До ${i + 1}`}
                                    className="h-full w-full object-cover"
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/10 group-hover:opacity-100">
                                    <Eye className="h-5 w-5 text-white drop-shadow-md" />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                      <div className="space-y-2">
                        <div className="text-[10px] font-bold text-emerald-600/70 uppercase tracking-widest">
                          {latestSubmission?.photos_before &&
                          latestSubmission.photos_before.length > 0
                            ? "Результат ПОСЛЕ"
                            : "ФОТООТЧЕТ"}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {(latestSubmission?.photos_after?.length
                            ? latestSubmission.photos_after
                            : latestSubmission?.photos || []
                          ).map((photo, i) => (
                            <div
                              key={`after-${i}`}
                              className="group relative h-20 w-20 sm:h-24 sm:w-24 overflow-hidden rounded-2xl bg-emerald-50/50 ring-1 ring-emerald-200/50 cursor-zoom-in transition-all hover:ring-2 hover:ring-emerald-300"
                              onClick={(e) =>
                                openImage(
                                  photo,
                                  latestSubmission?.photos_after?.length
                                    ? latestSubmission.photos_after
                                    : latestSubmission?.photos || [],
                                  e,
                                )
                              }
                            >
                              <img
                                src={photo}
                                alt={`После ${i + 1}`}
                                className="h-full w-full object-cover"
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/10 group-hover:opacity-100">
                                <Eye className="h-5 w-5 text-white drop-shadow-md" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
                      Нет фото
                    </div>
                  )}

                  {latestSubmission?.task_notes && (
                    <div className="mt-3 border-t border-slate-100 pt-3">
                      <p className="text-sm leading-6 text-slate-700">
                        {latestSubmission.task_notes}
                      </p>
                    </div>
                  )}
                </section>

                {/* Previous submission */}
                {previousSubmission && (
                  <section className="rounded-2xl border border-amber-200 bg-amber-50/25 p-4 shadow-sm sm:p-5">
                    <div className="mb-3">
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                          Предыдущая попытка
                        </div>
                        {formatTaskMessageStamp(previousSubmission.created_at) && (
                          <div className="mt-1 text-xs text-amber-700/70">
                            {formatTaskMessageStamp(previousSubmission.created_at)}
                          </div>
                        )}
                      </div>
                    </div>

                    {(previousSubmission?.photos_before &&
                      previousSubmission.photos_before.length > 0) ||
                    (previousSubmission?.photos_after &&
                      previousSubmission.photos_after.length > 0) ||
                    (previousSubmission?.photos &&
                      previousSubmission.photos.length > 0) ? (
                      <div
                        className={cn(
                          "grid gap-4",
                          previousSubmission?.photos_before &&
                            previousSubmission.photos_before.length > 0
                            ? "grid-cols-1 sm:grid-cols-2"
                            : "grid-cols-1",
                        )}
                      >
                        {previousSubmission?.photos_before &&
                          previousSubmission.photos_before.length > 0 && (
                            <div className="space-y-2">
                              <div className="text-[10px] font-bold text-amber-700/50 uppercase tracking-widest">
                                Состояние ДО
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {previousSubmission.photos_before.map(
                                  (photo, i) => (
                                    <div
                                      key={`prev-before-${i}`}
                                      className="group relative h-20 w-20 sm:h-24 sm:w-24 overflow-hidden rounded-2xl bg-white ring-1 ring-amber-200 cursor-zoom-in transition-all hover:ring-2 hover:ring-amber-300"
                                      onClick={(e) =>
                                        openImage(
                                          photo,
                                          previousSubmission.photos_before || [],
                                          e,
                                        )
                                      }
                                    >
                                      <img
                                        src={photo}
                                        alt={`До ${i + 1}`}
                                        className="h-full w-full object-cover opacity-75"
                                      />
                                      <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/10 group-hover:opacity-100">
                                        <Eye className="h-5 w-5 text-white drop-shadow-md" />
                                      </div>
                                    </div>
                                  ),
                                )}
                              </div>
                            </div>
                          )}

                        <div className="space-y-2">
                          <div className="text-[10px] font-bold text-amber-700/70 uppercase tracking-widest">
                            {previousSubmission?.photos_before &&
                            previousSubmission.photos_before.length > 0
                              ? "Результат ПОСЛЕ"
                              : "ФОТООТЧЕТ"}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {(previousSubmission?.photos_after?.length
                              ? previousSubmission.photos_after
                              : previousSubmission?.photos || []
                            ).map((photo, i) => (
                              <div
                                key={`prev-after-${i}`}
                                className="group relative h-20 w-20 sm:h-24 sm:w-24 overflow-hidden rounded-2xl bg-white ring-1 ring-amber-200 cursor-zoom-in transition-all hover:ring-2 hover:ring-amber-300"
                                onClick={(e) =>
                                  openImage(
                                    photo,
                                    previousSubmission?.photos_after?.length
                                      ? previousSubmission.photos_after
                                      : previousSubmission?.photos || [],
                                    e,
                                  )
                                }
                              >
                                <img
                                  src={photo}
                                  alt={`После ${i + 1}`}
                                  className="h-full w-full object-cover opacity-75"
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/10 group-hover:opacity-100">
                                  <Eye className="h-5 w-5 text-white drop-shadow-md" />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-amber-200 bg-white/70 text-sm text-amber-700/70">
                        Ранее фото не были приложены
                      </div>
                    )}

                    {previousSubmission.task_notes && (
                      <div className="mt-3 border-t border-amber-200/70 pt-3">
                        <p className="text-sm leading-6 text-slate-700">
                          {previousSubmission.task_notes}
                        </p>
                      </div>
                    )}
                  </section>
                )}
              </div>
            </div>

            {/* Actions & Comments */}
            <div className="space-y-4">
              {latestRejection?.note && (
                <div className="bg-amber-50 p-3 rounded-lg border border-amber-100 shadow-sm">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="text-[10px] text-amber-600 uppercase tracking-wider font-bold">
                      Ранее отправлено на доработку
                    </div>
                    {formatTaskMessageStamp(latestRejection.created_at) && (
                      <span className="shrink-0 text-[11px] text-amber-700/60">
                        {formatTaskMessageStamp(latestRejection.created_at)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-amber-800 italic">
                    &ldquo;{latestRejection.note}&rdquo;
                  </p>
                  {latestRejection.photos && latestRejection.photos.length > 0 && (
                    <div className="mt-3 grid grid-cols-4 gap-2">
                      {latestRejection.photos.map((url, i) => (
                        <div
                          key={i}
                          className="aspect-square rounded-lg border border-amber-200 overflow-hidden cursor-zoom-in"
                          onClick={(e) =>
                            openImage(url, latestRejection.photos || [], e)
                          }
                        >
                          <img
                            src={url}
                            alt="Rework proof"
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    {equipmentTab === "active"
                      ? "Причина возврата"
                      : "Комментарий к решению"}
                  </div>
                  {task.verified_by_name && (
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground bg-slate-50 px-1.5 py-0.5 rounded">
                      <User className="h-3 w-3" />
                      <span>{task.verified_by_name}</span>
                    </div>
                  )}
                </div>
                <Textarea
                  placeholder={
                    equipmentTab === "active"
                      ? "Опишите, что нужно исправить..."
                      : "Комментарий отсутствует"
                  }
                  value={
                    equipmentTab === "active"
                      ? comment
                      : latestRejection?.note || task.verification_note || ""
                  }
                  onChange={(e) => setComment(e.target.value)}
                  className="bg-white min-h-[80px] resize-none text-sm"
                  disabled={equipmentTab === "history"}
                />

                {equipmentTab === "active" && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-lg border-slate-200 text-slate-600 hover:bg-slate-50"
                        onClick={() =>
                          document
                            .getElementById(`rework-photo-input-${task.id}`)
                            ?.click()
                        }
                      >
                        <Camera className="mr-2 h-4 w-4" />
                        Прикрепить фото (доработка)
                      </Button>
                      <input
                        id={`rework-photo-input-${task.id}`}
                        type="file"
                        multiple
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          setReworkPhotos((prev) => [...prev, ...files]);
                          const newPreviews = files.map((f) =>
                            URL.createObjectURL(f),
                          );
                          setReworkPhotosPreviews((prev) => [
                            ...prev,
                            ...newPreviews,
                          ]);
                        }}
                      />
                    </div>

                    {reworkPhotosPreviews.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {reworkPhotosPreviews.map((url, idx) => (
                          <div
                            key={idx}
                            className="relative h-16 w-16 rounded-lg overflow-hidden border border-slate-200 group"
                          >
                            <img
                              src={url}
                              alt="Preview"
                              className="h-full w-full object-cover"
                            />
                            <button
                              className="absolute top-1 right-1 h-5 w-5 bg-black/50 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => {
                                setReworkPhotos((prev) =>
                                  prev.filter((_, i) => i !== idx),
                                );
                                setReworkPhotosPreviews((prev) =>
                                  prev.filter((_, i) => i !== idx),
                                );
                              }}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action buttons — active tab */}
              {equipmentTab === "active" && (
                <div className="flex flex-col gap-3 pt-2">
                  {isLaundryItem && (
                    <Button
                      variant="outline"
                      className="w-full border-violet-200 text-violet-700 hover:bg-violet-50 hover:text-violet-800 h-12 md:h-9 font-semibold"
                      onClick={() => onSendToLaundry(task)}
                      disabled={
                        isSubmittingTask || Boolean(task.laundry_request_id)
                      }
                    >
                      {task.laundry_request_id
                        ? getLaundryStatusLabel(task.laundry_status)
                        : "Отправить в стирку"}
                    </Button>
                  )}
                  <div className="flex flex-row gap-3">
                    <Button
                      variant="outline"
                      className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 h-12 md:h-9 font-semibold"
                      onClick={() => onVerify(task, "REJECT")}
                      disabled={isSubmittingTask || !comment.trim()}
                    >
                      На доработку
                    </Button>
                    <div className="flex-1 space-y-1">
                      <Button
                        className="w-full bg-slate-900 text-white hover:bg-slate-800 shadow-sm h-12 md:h-9 font-semibold"
                        onClick={() => onVerify(task, "APPROVE")}
                        disabled={
                          isSubmittingTask ||
                          task.status !== "COMPLETED" ||
                          !(
                            task.verification_status === "PENDING" ||
                            task.verification_status === "NONE" ||
                            task.verification_status == null
                          )
                        }
                      >
                        Одобрить
                      </Button>
                      {task.verification_status === "REJECTED" && (
                        <div className="text-[11px] font-semibold text-amber-700 text-center">
                          Ждём пересдачи после доработки
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Action buttons — history tab */}
              {equipmentTab === "history" &&
                task.verification_status === "APPROVED" && (
                  <div className="pt-2">
                    <Button
                      variant="outline"
                      className="w-full border-slate-200 text-slate-700 hover:bg-slate-50 h-12 md:h-9 font-semibold"
                      onClick={() => onRevert(task)}
                      disabled={isSubmittingTask}
                    >
                      Вернуть на проверку
                    </Button>
                  </div>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
