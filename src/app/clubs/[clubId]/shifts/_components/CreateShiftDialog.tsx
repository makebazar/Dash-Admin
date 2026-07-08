import React, { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { MaskedDateTimeInput } from "./MaskedInputs";

interface CreateShiftDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  clubId: string;
  employees: { id: string; full_name: string }[];
  reportFields: any[];
  clubTimezone: string;
  onSuccess: () => void;
}

export function CreateShiftDialog({
  isOpen,
  onOpenChange,
  clubId,
  employees,
  reportFields,
  clubTimezone,
  onSuccess,
}: CreateShiftDialogProps) {
  const [isCreating, setIsCreating] = useState(false);

  // Form State
  const [newShiftEmployee, setNewShiftEmployee] = useState("");
  const [newShiftCheckIn, setNewShiftCheckIn] = useState("");
  const [newShiftCheckOut, setNewShiftCheckOut] = useState("");
  const [newShiftCheckInDisplay, setNewShiftCheckInDisplay] = useState("");
  const [newShiftCheckOutDisplay, setNewShiftCheckOutDisplay] = useState("");
  const [newShiftCashIncome, setNewShiftCashIncome] = useState("");
  const [newShiftCardIncome, setNewShiftCardIncome] = useState("");
  const [newShiftExpenses, setNewShiftExpenses] = useState("");
  const [newShiftComment, setNewShiftComment] = useState("");
  const [newShiftCustomFields, setNewShiftCustomFields] = useState<Record<string, any>>({});

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

  const resetForm = () => {
    setNewShiftEmployee("");
    setNewShiftCheckIn("");
    setNewShiftCheckOut("");
    setNewShiftCheckInDisplay("");
    setNewShiftCheckOutDisplay("");
    setNewShiftCashIncome("");
    setNewShiftCardIncome("");
    setNewShiftExpenses("");
    setNewShiftComment("");
    setNewShiftCustomFields({});
  };

  const handleCreateShift = async () => {
    if (!newShiftEmployee || !newShiftCheckIn) {
      alert("Выберите сотрудника и укажите время начала");
      return;
    }
    if (newShiftCheckInDisplay && !newShiftCheckIn) {
      alert("Заполните дату начала полностью и корректно");
      return;
    }
    if (newShiftCheckOutDisplay && !newShiftCheckOut) {
      alert("Заполните дату окончания полностью и корректно");
      return;
    }

    if (!validateTimes(newShiftCheckIn, newShiftCheckOut)) return;

    setIsCreating(true);

    let totalHours: number | undefined = undefined;
    if (newShiftCheckIn && newShiftCheckOut) {
      const start = new Date(newShiftCheckIn);
      const end = new Date(newShiftCheckOut);
      totalHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      if (totalHours < 0) totalHours = 0;
    }

    try {
      const res = await fetch(`/api/clubs/${clubId}/shifts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: newShiftEmployee,
          check_in: convertToClubTimezone(newShiftCheckIn),
          check_out: convertToClubTimezone(newShiftCheckOut),
          cash_income: parseFloat(newShiftCashIncome) || 0,
          card_income: parseFloat(newShiftCardIncome) || 0,
          expenses: parseFloat(newShiftExpenses) || 0,
          report_comment: newShiftComment,
          total_hours: totalHours,
          report_data: newShiftCustomFields,
        }),
      });

      if (res.ok) {
        onOpenChange(false);
        resetForm();
        onSuccess();
      } else {
        const data = await res.json();
        alert(data.error || "Ошибка создания смены");
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Ошибка создания смены");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) resetForm();
        onOpenChange(open);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Добавить смену</DialogTitle>
          <DialogDescription>
            Ручное создание смены для сотрудника
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Employee Select */}
          <div className="space-y-2">
            <Label>Сотрудник *</Label>
            <select
              value={newShiftEmployee}
              onChange={(e) => setNewShiftEmployee(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="">Выберите сотрудника...</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name}
                </option>
              ))}
            </select>
          </div>

          {/* Time Section */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <Label className="text-xs uppercase text-muted-foreground tracking-wider">
              Время смены
            </Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm">Начало *</Label>
                <MaskedDateTimeInput
                  value={newShiftCheckInDisplay}
                  onValueChange={(displayValue, internalValue) => {
                    setNewShiftCheckInDisplay(displayValue);
                    setNewShiftCheckIn(internalValue);
                  }}
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Конец</Label>
                <MaskedDateTimeInput
                  value={newShiftCheckOutDisplay}
                  onValueChange={(displayValue, internalValue) => {
                    setNewShiftCheckOutDisplay(displayValue);
                    setNewShiftCheckOut(internalValue);
                  }}
                  className="bg-background"
                />
              </div>
            </div>
          </div>

          {/* Financial Section */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Выручка (Нал)</Label>
              <Input
                type="number"
                value={newShiftCashIncome}
                onChange={(e) => setNewShiftCashIncome(e.target.value)}
                placeholder="0"
                className="bg-green-500/5 border-green-500/20 focus:border-green-500"
              />
            </div>
            <div className="space-y-2">
              <Label>Выручка (Безнал)</Label>
              <Input
                type="number"
                value={newShiftCardIncome}
                onChange={(e) => setNewShiftCardIncome(e.target.value)}
                placeholder="0"
                className="bg-blue-500/5 border-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Расходы</Label>
            <Input
              type="number"
              value={newShiftExpenses}
              onChange={(e) => setNewShiftExpenses(e.target.value)}
              placeholder="0"
              className="bg-orange-500/5 border-orange-500/20 focus:border-orange-500"
            />
          </div>
          <div className="space-y-2">
            <Label>Комментарий</Label>
            <Input
              value={newShiftComment}
              onChange={(e) => setNewShiftComment(e.target.value)}
              placeholder="Примечание к смене..."
            />
          </div>

          {/* Custom Report Fields */}
          {reportFields.length > 0 && (
            <div className="space-y-3 pt-2 border-t">
              <Label className="text-xs uppercase text-muted-foreground tracking-wider">
                Дополнительные показатели
              </Label>
              <div className="grid grid-cols-2 gap-4">
                {reportFields.map((field) => (
                  <div key={field.metric_key} className="space-y-2">
                    <Label>{field.custom_label}</Label>
                    <Input
                      type="number"
                      value={newShiftCustomFields[field.metric_key] || ""}
                      onChange={(e) =>
                        setNewShiftCustomFields((prev) => ({
                          ...prev,
                          [field.metric_key]: e.target.value,
                        }))
                      }
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={handleCreateShift} disabled={isCreating}>
            {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Создать смену
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
