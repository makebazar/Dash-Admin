import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Clock,
  Sun,
  Moon,
  FileText,
  DollarSign,
  Wallet,
  TrendingUp,
  ArrowUpDown,
  Trash2,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Shift } from "../_types";
import { MaskedDateTimeInput } from "./MaskedInputs";
import {
  formatDate,
  displayToLocalDateTime,
  getMetricValue,
} from "../_utils";

// Helper: convert internal date (YYYY-MM-DDTHH:MM) to display mask (ДД.ММ.ГГГГ, ЧЧ:ММ)
function toDisplayMask(internal: string): string {
  if (!internal) return "";
  const match = internal.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return "";
  const [, yyyy, mm, dd, hh, min] = match;
  return `${dd}.${mm}.${yyyy}, ${hh}:${min}`;
}

// Helper: convert UTC ISO string to local timezone ISO string (YYYY-MM-DDTHH:MM)
function toLocalISOString(isoStr: string | null): string {
  if (!isoStr) return "";
  const date = new Date(isoStr);
  if (isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

interface EditShiftDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editingShift: Shift | null;
  clubId: string;
  reportFields: any[];
  clubTimezone: string;
  onSuccess: () => void;
}

export function EditShiftDialog({
  isOpen,
  onOpenChange,
  editingShift,
  clubId,
  reportFields,
  clubTimezone,
  onSuccess,
}: EditShiftDialogProps) {
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [editCashIncome, setEditCashIncome] = useState("");
  const [editCardIncome, setEditCardIncome] = useState("");
  const [editExpenses, setEditExpenses] = useState("");
  const [editComment, setEditComment] = useState("");
  const [editCheckIn, setEditCheckIn] = useState("");
  const [editCheckOut, setEditCheckOut] = useState("");
  const [editCheckInDisplay, setEditCheckInDisplay] = useState("");
  const [editCheckOutDisplay, setEditCheckOutDisplay] = useState("");
  const [editCustomFields, setEditCustomFields] = useState<Record<string, any>>({});
  const [editOwnerNotes, setEditOwnerNotes] = useState("");
  const [editShiftType, setEditShiftType] = useState<"DAY" | "NIGHT">("DAY");

  // Reset form when editingShift changes
  useEffect(() => {
    if (editingShift) {
      setEditCashIncome(String(editingShift.cash_income || ""));
      setEditCardIncome(String(editingShift.card_income || ""));
      setEditExpenses(String(editingShift.expenses || ""));
      setEditComment(editingShift.report_comment || "");
      setEditOwnerNotes(editingShift.owner_notes || "");
      setEditShiftType(editingShift.shift_type || "DAY");

      const checkInLocal = toLocalISOString(editingShift.check_in);
      setEditCheckIn(checkInLocal);
      setEditCheckInDisplay(toDisplayMask(checkInLocal));

      const checkOutLocal = toLocalISOString(editingShift.check_out);
      setEditCheckOut(checkOutLocal);
      setEditCheckOutDisplay(toDisplayMask(checkOutLocal));

      const custom: Record<string, any> = {};
      reportFields.forEach((f) => {
        custom[f.metric_key] = editingShift.report_data?.[f.metric_key] ?? "";
      });
      setEditCustomFields(custom);
    }
  }, [editingShift, reportFields]);

  const convertToClubTimezone = useCallback(
    (datetimeLocal: string) => {
      if (!datetimeLocal) return undefined;
      const localDate = new Date(datetimeLocal);
      const inClubTZString = localDate.toLocaleString("en-US", {
        timeZone: clubTimezone,
      });
      const inClubTZ = new Date(inClubTZString);
      const offset = inClubTZ.getTime() - localDate.getTime();
      const correctUTC = new Date(localDate.getTime() - offset);
      return correctUTC.toISOString();
    },
    [clubTimezone],
  );

  const validateTimes = (start: string, end: string) => {
    if (start && end) {
      if (new Date(start) > new Date(end)) {
        alert("Время начала не может быть позже времени окончания");
        return false;
      }
    }
    return true;
  };

  const handleSaveEdit = async () => {
    if (!editingShift) return;
    if (editCheckInDisplay && !editCheckIn) {
      alert("Заполните дату начала полностью и корректно");
      return;
    }
    if (editCheckOutDisplay && !editCheckOut) {
      alert("Заполните дату окончания полностью и корректно");
      return;
    }

    if (!validateTimes(editCheckIn, editCheckOut)) return;

    setIsSaving(true);

    let totalHours: number | undefined = undefined;
    if (editCheckIn && editCheckOut) {
      const start = new Date(editCheckIn);
      const end = new Date(editCheckOut);
      totalHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      if (totalHours < 0) totalHours = 0;
    }

    try {
      const updatedReportData = {
        ...editingShift.report_data,
        ...editCustomFields,
      };

      const res = await fetch(
        `/api/clubs/${clubId}/shifts/${editingShift.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cash_income: parseFloat(editCashIncome) || 0,
            card_income: parseFloat(editCardIncome) || 0,
            expenses: parseFloat(editExpenses) || 0,
            report_comment: editComment,
            owner_notes: editOwnerNotes,
            check_in: convertToClubTimezone(editCheckIn),
            check_out: convertToClubTimezone(editCheckOut),
            total_hours: totalHours,
            shift_type: editShiftType,
            report_data: updatedReportData,
          }),
        },
      );

      if (res.ok) {
        onOpenChange(false);
        onSuccess();
      } else {
        const data = await res.json();
        alert(data.error || "Ошибка сохранения");
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Ошибка сохранения");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteShift = async () => {
    if (!editingShift) return;

    if (
      !confirm(
        "Вы уверены, что хотите удалить эту смену? Это действие нельзя отменить.",
      )
    ) {
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(
        `/api/clubs/${clubId}/shifts/${editingShift.id}`,
        {
          method: "DELETE",
        },
      );

      if (res.ok) {
        onOpenChange(false);
        onSuccess();
      } else {
        const data = await res.json();
        alert(data.error || "Ошибка удаления");
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Ошибка удаления");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-bold">
                Редактирование смены
              </DialogTitle>
              <DialogDescription className="mt-1">
                {editingShift?.employee_name} •{" "}
                {editingShift && formatDate(editingShift.check_in, clubTimezone)}
              </DialogDescription>
            </div>
            <Badge
              variant={editShiftType === "NIGHT" ? "secondary" : "outline"}
              className="h-6"
            >
              {editShiftType === "NIGHT" ? "Ночная смена" : "Дневная смена"}
            </Badge>
          </div>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left Column */}
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold flex items-center gap-2 text-primary">
                  <Clock className="h-4 w-4" />
                  Временные рамки
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase">
                      Начало
                    </Label>
                    <MaskedDateTimeInput
                      value={editCheckInDisplay}
                      onValueChange={(displayValue, internalValue) => {
                        setEditCheckInDisplay(displayValue);
                        setEditCheckIn(internalValue);
                      }}
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase">
                      Конец
                    </Label>
                    <MaskedDateTimeInput
                      value={editCheckOutDisplay}
                      onValueChange={(displayValue, internalValue) => {
                        setEditCheckOutDisplay(displayValue);
                        setEditCheckOut(internalValue);
                      }}
                      className="bg-background"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold flex items-center gap-2 text-primary">
                  <Sun className="h-4 w-4" />
                  Тип смены
                </h3>
                <div className="flex gap-2 bg-muted/50 p-1 rounded-lg">
                  <Button
                    type="button"
                    variant={editShiftType === "DAY" ? "secondary" : "ghost"}
                    onClick={() => setEditShiftType("DAY")}
                    className={cn(
                      "flex-1 gap-2",
                      editShiftType === "DAY" && "bg-background shadow-sm",
                    )}
                  >
                    <Sun className="h-4 w-4 text-orange-500" />
                    Дневная
                  </Button>
                  <Button
                    type="button"
                    variant={editShiftType === "NIGHT" ? "secondary" : "ghost"}
                    onClick={() => setEditShiftType("NIGHT")}
                    className={cn(
                      "flex-1 gap-2",
                      editShiftType === "NIGHT" && "bg-background shadow-sm",
                    )}
                  >
                    <Moon className="h-4 w-4 text-blue-500" />
                    Ночная
                  </Button>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <h3 className="text-sm font-semibold flex items-center gap-2 text-primary">
                  <FileText className="h-4 w-4" />
                  Комментарии
                </h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase">
                      От сотрудника
                    </Label>
                    <Textarea
                      value={editComment}
                      onChange={(e) => setEditComment(e.target.value)}
                      placeholder="Примечание к смене..."
                      rows={3}
                      className="resize-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase">
                      Заметки владельца
                    </Label>
                    <Textarea
                      value={editOwnerNotes}
                      onChange={(e) => setEditOwnerNotes(e.target.value)}
                      placeholder="Причина корректировки (опционально)"
                      rows={3}
                      className="resize-none bg-blue-50/30 border-blue-100"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold flex items-center gap-2 text-primary">
                  <DollarSign className="h-4 w-4" />
                  Финансы
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase">
                      Наличные
                    </Label>
                    <div className="relative">
                      <Input
                        type="number"
                        value={editCashIncome}
                        onChange={(e) => setEditCashIncome(e.target.value)}
                        className="pl-8 bg-green-500/5 border-green-500/20"
                      />
                      <Wallet className="absolute left-2.5 top-2.5 h-4 w-4 text-green-600 opacity-50" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase">
                      Безнал
                    </Label>
                    <div className="relative">
                      <Input
                        type="number"
                        value={editCardIncome}
                        onChange={(e) => setEditCardIncome(e.target.value)}
                        className="pl-8 bg-blue-500/5 border-blue-500/20"
                      />
                      <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-blue-600 opacity-50" />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase">
                    Расходы
                  </Label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={editExpenses}
                      onChange={(e) => setEditExpenses(e.target.value)}
                      className="pl-8 bg-red-500/5 border-red-500/20"
                    />
                    <TrendingUp className="absolute left-2.5 top-2.5 h-4 w-4 text-red-600 opacity-50 rotate-180" />
                  </div>
                </div>
              </div>

              {reportFields.length > 0 && (
                <div className="space-y-4 pt-2 border-t border-dashed">
                  <h3 className="text-sm font-semibold flex items-center gap-2 text-primary">
                    <ArrowUpDown className="h-4 w-4" />
                    Дополнительно
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    {reportFields.map((field) => (
                      <div key={field.metric_key} className="space-y-2">
                        <Label
                          className="text-xs text-muted-foreground uppercase truncate"
                          title={field.custom_label}
                        >
                          {field.custom_label}
                        </Label>
                        <Input
                          type="number"
                          value={editCustomFields[field.metric_key] || ""}
                          onChange={(e) =>
                            setEditCustomFields((prev) => ({
                              ...prev,
                              [field.metric_key]: e.target.value,
                            }))
                          }
                          placeholder="0"
                          className="bg-muted/30"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-muted/30 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={handleDeleteShift}
            disabled={isSaving}
            className="text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Удалить смену
          </Button>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSaving} className="px-8">
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Сохранить изменения
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
