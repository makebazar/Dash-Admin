"use client";

import {
  Loader2,
  History,
  CheckCircle,
  XCircle,
  User,
  Trash2,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Calendar,
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UseChecklistsReturn } from "../_hooks/useChecklists";
import { ImageViewer } from "@/components/ui/image-viewer";

interface ChecklistsTabProps extends UseChecklistsReturn {
  clubId: string;
  onViewEvaluation: (id: number) => void;
}

function getStatusBadge(status?: string) {
  switch (status) {
    case "approved":
      return (
        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">
          Принят
        </Badge>
      );
    case "rejected":
      return (
        <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-red-200">
          Замечания
        </Badge>
      );
    default:
      return (
        <Badge
          variant="outline"
          className="text-yellow-600 border-yellow-200 bg-yellow-50"
        >
          На проверке
        </Badge>
      );
  }
}

export function ChecklistsTab({
  clubId,
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
  filteredChecklists,
  checklistMonths,
  checklistMonthIndex,
  handleReviewItemChange,
  submitReview,
  handleDeleteChecklist,
  handleRestoreChecklist,
  confirmDeleteChecklist,
  confirmRestoreChecklist,
  onViewEvaluation,
}: ChecklistsTabProps) {
  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <Tabs
        value={checklistsTab}
        onValueChange={(v) => setChecklistsTab(v as "active" | "history")}
        className="w-full"
      >
        <TabsList className="flex h-auto w-full justify-start gap-6 overflow-x-auto rounded-none bg-transparent p-0 mb-6">
          <TabsTrigger
            value="active"
            className="relative shrink-0 rounded-none border-b-2 border-transparent px-0 pb-2 pt-1 font-medium text-slate-500 hover:text-slate-700 data-[state=active]:border-slate-900 data-[state=active]:text-slate-900 data-[state=active]:shadow-none data-[state=active]:bg-transparent transition-all"
          >
            Ожидают проверки
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="relative shrink-0 rounded-none border-b-2 border-transparent px-0 pb-2 pt-1 font-medium text-slate-500 hover:text-slate-700 data-[state=active]:border-slate-900 data-[state=active]:text-slate-900 data-[state=active]:shadow-none data-[state=active]:bg-transparent transition-all"
          >
            История
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-4 border-b border-slate-100 pb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {checklistsTab === "history" && (
              <div className="flex items-center justify-between rounded-xl bg-white border border-slate-200 shadow-sm px-3 h-10 w-[240px]">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900"
                  onClick={() => {
                    const nextIndex = checklistMonthIndex + 1;
                    if (nextIndex < checklistMonths.length) {
                      setFilterChecklistMonth(checklistMonths[nextIndex]);
                    }
                  }}
                  disabled={
                    checklistMonthIndex === -1 ||
                    checklistMonthIndex >= checklistMonths.length - 1
                  }
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
                  <span className="text-sm font-medium text-slate-700 truncate">
                    {filterChecklistMonth === "all"
                      ? "Все месяцы"
                      : format(
                          new Date(`${filterChecklistMonth}-01`),
                          "MMMM yyyy",
                          { locale: ru },
                        )}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900"
                  onClick={() => {
                    const nextIndex = checklistMonthIndex - 1;
                    if (nextIndex >= 0) {
                      setFilterChecklistMonth(checklistMonths[nextIndex]);
                    }
                  }}
                  disabled={checklistMonthIndex <= 0}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="sm:hidden flex flex-col gap-0 -mx-4">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-muted-foreground" />
          </div>
        ) : filteredChecklists.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground bg-muted/10 rounded-xl border border-dashed mx-4">
            <History className="mx-auto h-12 w-12 opacity-20 mb-4" />
            <p>
              {checklistsTab === "active"
                ? "Нет проверок на рассмотрении"
                : "История проверок пуста"}
            </p>
          </div>
        ) : (
          filteredChecklists.map((evaluation) => {
            const percent = Math.round(
              (evaluation.total_score / (evaluation.max_score || 100)) * 100,
            );
            return (
              <div
                key={evaluation.id}
                className="bg-white border-b last:border-0 p-4 active:bg-muted/50 transition-colors"
                onClick={() => onViewEvaluation(evaluation.id)}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex flex-col">
                    <div className="font-semibold text-base">
                      {evaluation.employee_name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {evaluation.template_name}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-2">
                      {getStatusBadge(evaluation.status)}
                      {checklistsTab === "history" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-blue-500 hover:text-blue-600"
                          onClick={(e) => handleRestoreChecklist(evaluation, e)}
                          disabled={restoringChecklistId === evaluation.id}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-500 hover:text-red-600"
                        onClick={(e) => handleDeleteChecklist(evaluation, e)}
                        disabled={deletingChecklistId === evaluation.id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(
                        evaluation.evaluation_date || evaluation.created_at,
                      ).toLocaleDateString("ru-RU", {
                        day: "2-digit",
                        month: "2-digit",
                      })}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center mt-3 pt-2 border-t border-border/50">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <User className="h-3.5 w-3.5" />
                    <span>
                      {evaluation.reviewer_name ||
                        evaluation.evaluator_name ||
                        "—"}
                    </span>
                  </div>
                  <div
                    className={`font-bold text-lg ${percent >= 80 ? "text-green-600" : percent >= 50 ? "text-amber-600" : "text-red-600"}`}
                  >
                    {percent}%
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop Table */}
      <Card className="hidden sm:block">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-muted-foreground" />
            </div>
          ) : filteredChecklists.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <History className="mx-auto h-12 w-12 opacity-20 mb-4" />
              <p>
                {checklistsTab === "active"
                  ? "Нет проверок на рассмотрении"
                  : "История проверок пуста"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Статус</TableHead>
                  <TableHead>Дата</TableHead>
                  <TableHead>Шаблон</TableHead>
                  <TableHead>Кого проверяли</TableHead>
                  <TableHead>Кто проверял</TableHead>
                  <TableHead className="text-right">Баллы</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredChecklists.map((evaluation) => (
                  <TableRow
                    key={evaluation.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => onViewEvaluation(evaluation.id)}
                  >
                    <TableCell>{getStatusBadge(evaluation.status)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {new Date(
                            evaluation.evaluation_date || evaluation.created_at,
                          ).toLocaleDateString("ru-RU", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(
                            evaluation.evaluation_date || evaluation.created_at,
                          ).toLocaleTimeString("ru-RU", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{evaluation.template_name}</TableCell>
                    <TableCell>{evaluation.employee_name}</TableCell>
                    <TableCell>
                      {evaluation.reviewer_name ||
                        evaluation.evaluator_name ||
                        "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={`font-bold ${(evaluation.total_score / (evaluation.max_score || 100)) * 100 >= 80 ? "text-green-600" : (evaluation.total_score / (evaluation.max_score || 100)) * 100 >= 50 ? "text-amber-600" : "text-red-600"}`}
                      >
                        {Math.round(
                          (evaluation.total_score /
                            (evaluation.max_score || 100)) *
                            100,
                        )}
                        %
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {checklistsTab === "history" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-blue-500 hover:text-blue-600"
                          onClick={(e) => handleRestoreChecklist(evaluation, e)}
                          disabled={restoringChecklistId === evaluation.id}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-600"
                        onClick={(e) => handleDeleteChecklist(evaluation, e)}
                        disabled={deletingChecklistId === evaluation.id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Dialog */}
      <Dialog
        open={!!deleteChecklistTarget}
        onOpenChange={(open) => !open && setDeleteChecklistTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удаление чеклиста</DialogTitle>
            <DialogDescription>
              Вы уверены, что хотите удалить этот чеклист? Это действие нельзя
              отменить.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteChecklistTarget(null)}>
              Отмена
            </Button>
            <Button
              variant="outline"
              className="border-rose-200 text-rose-600 hover:bg-rose-50"
              onClick={confirmDeleteChecklist}
              disabled={!!deletingChecklistId}
            >
              {deletingChecklistId ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore Dialog */}
      <Dialog
        open={!!restoreChecklistTarget}
        onOpenChange={(open) => !open && setRestoreChecklistTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Вернуть чеклист</DialogTitle>
            <DialogDescription>
              Вернуть чеклист в активные? Он появится в разделе проверок.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreChecklistTarget(null)}>
              Отмена
            </Button>
            <Button onClick={confirmRestoreChecklist} disabled={!!restoringChecklistId}>
              {restoringChecklistId ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Вернуть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Evaluation detail / review dialog */}
      <Dialog
        open={!!selectedEvaluation}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedEvaluation(null);
            setIsReviewMode(false);
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between mr-8">
              <DialogTitle>Результаты проверки</DialogTitle>
              {selectedEvaluation && getStatusBadge(selectedEvaluation.status)}
            </div>
            <DialogDescription>
              {selectedEvaluation?.template_name} •{" "}
              {selectedEvaluation &&
                new Date(
                  selectedEvaluation.evaluation_date ||
                    selectedEvaluation.created_at,
                ).toLocaleDateString()}
            </DialogDescription>
          </DialogHeader>

          {selectedEvaluation ? (
            <div className="space-y-6">
              {/* Header Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-muted/30 p-4 rounded-xl border">
                <div>
                  <p className="text-muted-foreground text-xs uppercase font-bold">
                    Сотрудник
                  </p>
                  <p className="font-medium">{selectedEvaluation.employee_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase font-bold">
                    Подтвердил
                  </p>
                  <p className="font-medium">
                    {selectedEvaluation.reviewer_name || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase font-bold">
                    Дата проверки
                  </p>
                  <p className="font-medium">
                    {selectedEvaluation.reviewed_at
                      ? new Date(
                          selectedEvaluation.reviewed_at,
                        ).toLocaleDateString()
                      : "—"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground text-xs uppercase font-bold">
                    Итоговый балл
                  </p>
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-lg text-muted-foreground">
                      {Math.round(selectedEvaluation.total_score)}{" "}
                      <span className="text-sm">
                        / {Math.round(selectedEvaluation.max_score || 100)}
                      </span>
                    </span>
                    <span
                      className={`text-xl font-black ${(selectedEvaluation.total_score / (selectedEvaluation.max_score || 100)) * 100 >= 80 ? "text-green-600" : "text-amber-600"}`}
                    >
                      {Math.round(
                        (selectedEvaluation.total_score /
                          (selectedEvaluation.max_score || 100)) *
                          100,
                      )}
                      %
                    </span>
                  </div>
                </div>
              </div>

              {selectedEvaluation.comments && (
                <div className="bg-blue-50 text-blue-800 p-3 rounded-lg border border-blue-100 text-sm">
                  <span className="font-bold mr-2">Комментарий сотрудника:</span>
                  {selectedEvaluation.comments}
                </div>
              )}

              {selectedEvaluation.reviewer_note && !isReviewMode && (
                <div className="bg-yellow-50 text-yellow-800 p-3 rounded-lg border border-yellow-100 text-sm">
                  <span className="font-bold mr-2">Заметка проверяющего:</span>
                  {selectedEvaluation.reviewer_note}
                </div>
              )}

              {/* Action Buttons */}
              {!isReviewMode && (
                <div className="flex justify-end gap-2">
                  <Button
                    onClick={() => setIsReviewMode(true)}
                    className="rounded-xl h-11 px-6 font-medium bg-slate-900 text-white hover:bg-slate-800"
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Начать проверку
                  </Button>
                </div>
              )}

              {/* Items List */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  Детализация пунктов
                  {isReviewMode && (
                    <Badge className="bg-purple-100 text-purple-700">
                      Режим ревью
                    </Badge>
                  )}
                </h3>

                <div className="space-y-3">
                  {selectedEvaluation.responses?.map((response, index) => {
                    const photos =
                      response.photo_urls && response.photo_urls.length > 0
                        ? response.photo_urls
                        : response.photo_url
                          ? [response.photo_url]
                          : [];

                    const reviewState = reviewItems[response.id] || {
                      is_accepted: true,
                      admin_comment: "",
                    };
                    const isAccepted = isReviewMode
                      ? reviewState.is_accepted
                      : response.is_accepted !== false;
                    const adminComment = isReviewMode
                      ? reviewState.admin_comment
                      : response.admin_comment;

                    return (
                      <div
                        key={index}
                        className={`border rounded-xl p-4 transition-all ${!isAccepted ? "bg-red-50 border-red-200" : "bg-card"}`}
                      >
                        <div className="flex justify-between items-start mb-2 gap-4">
                          <div className="flex-1">
                            <p
                              className={`font-medium ${!isAccepted ? "text-red-700" : ""}`}
                            >
                              {response.item_content}
                            </p>
                            {response.comment && (
                              <p className="text-sm text-muted-foreground mt-1 bg-muted/50 p-2 rounded inline-block">
                                💬 {response.comment}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            {response.score > 0 ? (
                              <Badge
                                variant="outline"
                                className="text-green-600 border-green-200 bg-green-50"
                              >
                                Выполнено
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-red-600 border-red-200 bg-red-50"
                              >
                                Не выполнено
                              </Badge>
                            )}

                            {isReviewMode && (
                              <div className="flex items-center gap-1 mt-1 bg-white p-1 rounded border shadow-sm">
                                <Button
                                  size="sm"
                                  variant={isAccepted ? "default" : "ghost"}
                                  className={`h-7 px-2 ${isAccepted ? "bg-slate-900 text-white hover:bg-slate-800" : "text-muted-foreground"}`}
                                  onClick={() =>
                                    handleReviewItemChange(
                                      response.id,
                                      "is_accepted",
                                      true,
                                    )
                                  }
                                >
                                  <CheckCircle className="h-3 w-3 mr-1" /> OK
                                </Button>
                                <Button
                                  size="sm"
                                  variant={!isAccepted ? "destructive" : "ghost"}
                                  className={`h-7 px-2 ${!isAccepted ? "" : "text-muted-foreground"}`}
                                  onClick={() =>
                                    handleReviewItemChange(
                                      response.id,
                                      "is_accepted",
                                      false,
                                    )
                                  }
                                >
                                  <XCircle className="h-3 w-3 mr-1" /> Нет
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>

                        {photos.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {photos.map((url, photoIndex) => (
                              <div key={photoIndex} className="relative group">
                                <img
                                  src={url}
                                  alt="Фото"
                                  className="h-16 w-16 object-cover rounded-md border cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={() => setPhotoPreviewUrl(url)}
                                />
                              </div>
                            ))}
                          </div>
                        )}

                        {(isReviewMode && !isAccepted) ||
                        (!isReviewMode && adminComment) ? (
                          <div className="mt-3 pt-3 border-t border-red-100">
                            <Label className="text-xs text-red-600 mb-1 block font-bold">
                              Причина отклонения:
                            </Label>
                            {isReviewMode ? (
                              <Input
                                value={reviewState.admin_comment}
                                onChange={(e) =>
                                  handleReviewItemChange(
                                    response.id,
                                    "admin_comment",
                                    e.target.value,
                                  )
                                }
                                placeholder="Почему пункт отклонен?"
                                className="h-8 text-sm bg-white"
                              />
                            ) : (
                              <p className="text-sm text-red-800 bg-white/50 p-2 rounded border border-red-100">
                                {adminComment}
                              </p>
                            )}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Review Footer */}
              {isReviewMode && (
                <div className="sticky bottom-0 bg-background pt-4 border-t mt-6 space-y-4">
                  <div>
                    <Label>Общий комментарий к проверке</Label>
                    <Textarea
                      value={reviewerNote}
                      onChange={(e) => setReviewerNote(e.target.value)}
                      placeholder="Итог проверки, рекомендации..."
                      className="mt-1"
                    />
                  </div>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setIsReviewMode(false)}
                    >
                      Отмена
                    </Button>
                    <Button
                      className="flex-1 bg-red-600 hover:bg-red-700"
                      onClick={() => submitReview("rejected")}
                      disabled={isSubmittingReview}
                    >
                      С замечаниями
                    </Button>
                    <Button
                      className="flex-1 bg-slate-900 text-white hover:bg-slate-800"
                      onClick={() => submitReview("approved")}
                      disabled={isSubmittingReview}
                    >
                      Принять (ОК)
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Photo preview overlay */}
      <ImageViewer
        isOpen={!!photoPreviewUrl}
        onClose={() => setPhotoPreviewUrl(null)}
        src={photoPreviewUrl || ""}
      />
    </div>
  );
}
