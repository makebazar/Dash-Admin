import { format } from "date-fns";
import { ru } from "date-fns/locale";
import {
  VerificationTask,
  VerificationTaskEvent,
  ShiftReviewItem,
  OwnerCorrectionChange,
} from "../types";

// ---------- Laundry ----------

export const getLaundryStatusLabel = (status?: string | null): string => {
  switch (status) {
    case "NEW":
      return "Ожидает стирки";
    case "SENT_TO_LAUNDRY":
      return "В стирке";
    case "READY_FOR_RETURN":
      return "Готов к возврату";
    case "RETURNED":
      return "Возвращен";
    case "CANCELLED":
      return "Отменен";
    default:
      return "Стирка";
  }
};

// ---------- Task history helpers ----------

export const getTaskHistoryEvents = (
  task: VerificationTask,
): VerificationTaskEvent[] => task.history || [];

export const getTaskSubmissionEvents = (
  task: VerificationTask,
): VerificationTaskEvent[] =>
  getTaskHistoryEvents(task).filter(
    (event) =>
      event.event_type === "SUBMITTED" || event.event_type === "RESUBMITTED",
  );

export const getLatestTaskSubmission = (
  task: VerificationTask,
): VerificationTaskEvent | null => {
  const submissions = getTaskSubmissionEvents(task);
  if (submissions.length > 0) return submissions[submissions.length - 1];

  if (
    task.completed_at ||
    task.notes ||
    (task.photos?.length || 0) > 0 ||
    (task.photos_before?.length || 0) > 0 ||
    (task.photos_after?.length || 0) > 0
  ) {
    return {
      id: -1,
      task_id: task.id,
      cycle_no: 1,
      event_type: "SUBMITTED" as const,
      task_notes: task.notes,
      photos: task.photos,
      photos_before: task.photos_before,
      photos_after: task.photos_after,
      created_at: task.completed_at || "",
      actor_name: task.completed_by_name || null,
    };
  }

  return null;
};

export const getPreviousTaskSubmission = (
  task: VerificationTask,
): VerificationTaskEvent | null => {
  const submissions = getTaskSubmissionEvents(task);
  if (submissions.length <= 1) return null;

  const latest = submissions[submissions.length - 1];
  if (latest.event_type !== "RESUBMITTED") return null;

  return submissions[submissions.length - 2];
};

export const getLatestTaskRejection = (
  task: VerificationTask,
): VerificationTaskEvent | null => {
  const rejections = getTaskHistoryEvents(task).filter(
    (event) => event.event_type === "REJECTED",
  );
  return rejections.length > 0 ? rejections[rejections.length - 1] : null;
};

export const formatTaskMessageStamp = (date?: string | null): string | null => {
  if (!date) return null;
  return format(new Date(date), "dd.MM.yyyy в HH:mm", { locale: ru });
};

// ---------- Shift helpers ----------

export const getShiftMetricValue = (
  shift: ShiftReviewItem,
  field: string,
): number => {
  if (
    field === "expenses" ||
    field === "cash_income" ||
    field === "card_income"
  ) {
    const keyMap: Record<string, string> = {
      expenses: "expenses_cash",
      cash_income: "cash_income",
      card_income: "card_income",
    };

    const reportKey = keyMap[field];
    const reportVal = shift.report_data?.[reportKey];

    if (reportVal !== undefined) {
      if (Array.isArray(reportVal)) {
        return reportVal.reduce(
          (sum, item: any) => sum + (Number(item.amount) || 0),
          0,
        );
      }
      return parseFloat(String(reportVal)) || 0;
    }

    return Number((shift as any)[field]) || 0;
  }

  const val = shift.report_data?.[field];
  if (Array.isArray(val)) {
    return val.reduce(
      (sum, item: any) => sum + (Number(item.amount) || 0),
      0,
    );
  }
  return parseFloat(String(val)) || 0;
};

export const formatShiftMoney = (
  amount: number | string | any[] | null | undefined,
): string => {
  if (amount === null || amount === undefined) return "0 ₽";

  let num: number;
  if (Array.isArray(amount)) {
    num = amount.reduce(
      (sum, item: any) => sum + (Number(item.amount) || 0),
      0,
    );
  } else {
    num = typeof amount === "string" ? parseFloat(amount) : Number(amount);
  }

  if (Number.isNaN(num) || num === 0) return "0 ₽";
  return `${num.toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽`;
};

export const formatShiftCorrectionValue = (
  change: OwnerCorrectionChange,
  value: any,
): string => {
  if (value === null || value === undefined || value === "") return "—";

  if (change.field === "check_in" || change.field === "check_out") {
    return format(new Date(value), "dd.MM.yyyy HH:mm", { locale: ru });
  }

  if (change.field === "shift_type") {
    return value === "NIGHT"
      ? "Ночная"
      : value === "DAY"
        ? "Дневная"
        : String(value);
  }

  if (change.field === "total_hours") {
    const numericValue = Number(value);
    return Number.isNaN(numericValue)
      ? String(value)
      : `${numericValue.toFixed(1)} ч`;
  }

  if (
    change.field === "cash_income" ||
    change.field === "card_income" ||
    change.field === "expenses"
  ) {
    return formatShiftMoney(value);
  }

  if (Array.isArray(value)) {
    const total = value.reduce(
      (sum, item: any) => sum + (Number(item?.amount) || 0),
      0,
    );
    const details = value
      .map((item: any) =>
        item?.comment
          ? `${item.amount} ₽ (${item.comment})`
          : `${item?.amount ?? 0} ₽`,
      )
      .join(", ");
    return details
      ? `${formatShiftMoney(total)}: ${details}`
      : formatShiftMoney(total);
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
};
