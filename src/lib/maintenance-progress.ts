export type MaintenanceStage =
  | "normal"
  | "grace"
  | "penalty"
  | "disabled"
  | "unknown";

export interface MaintenanceProgressInfo {
  stage: MaintenanceStage;
  normProgress: number; // 0..100% (зеленый сегмент)
  graceProgress: number; // 0..100% (желтый сегмент)
  penaltyProgress: number; // 0..100% (красный сегмент)
  daysUntilDue: number; // Дней до планового ТО
  daysLeftGrace: number; // Дней осталось без штрафа
  penaltyDays: number; // Дней штрафа
  rawOverdueDays: number; // Дней от планового срока
  label: string; // Текстовое описание
  badgeText: string; // Компактный бейдж
}

export function getMaintenanceProgress(
  item: {
    maintenance_enabled?: boolean;
    cleaning_interval_days?: number | null;
    cleaning_interval_override_days?: number | null;
    last_cleaned_at?: string | null;
    overdue_tolerance_days?: number | null;
    due_date?: string | null;
  },
  defaultToleranceDays = 3,
): MaintenanceProgressInfo {
  if (item.maintenance_enabled === false) {
    return {
      stage: "disabled",
      normProgress: 0,
      graceProgress: 0,
      penaltyProgress: 0,
      daysUntilDue: 0,
      daysLeftGrace: 0,
      penaltyDays: 0,
      rawOverdueDays: 0,
      label: "Без ТО",
      badgeText: "Без ТО",
    };
  }

  const intervalDays = Math.max(
    1,
    Number(
      item.cleaning_interval_override_days ?? item.cleaning_interval_days,
    ) || 30,
  );
  const toleranceDays = Math.max(
    0,
    Number(item.overdue_tolerance_days ?? defaultToleranceDays),
  );

  const now = new Date();
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const parseMidnight = (val?: string | null): Date | null => {
    if (!val) return null;
    const match = String(val).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  };

  const dueDate = parseMidnight(item.due_date);
  const lastCleanedDate = parseMidnight(item.last_cleaned_at);

  let elapsedDays: number;

  // Если дата чистки позже или равна плановой дате, оборудование уже обслужено!
  // Срок отсчитывается от даты последней чистки, а старая дата плана не приводит к штрафу.
  const isCleanedAfterDue = Boolean(
    dueDate && lastCleanedDate && lastCleanedDate >= dueDate,
  );

  if (dueDate && !isCleanedAfterDue) {
    const diffFromDue = Math.floor(
      (todayDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    elapsedDays = Math.max(0, intervalDays + diffFromDue);
  } else if (lastCleanedDate) {
    elapsedDays = Math.max(
      0,
      Math.floor(
        (todayDate.getTime() - lastCleanedDate.getTime()) /
          (1000 * 60 * 60 * 24),
      ),
    );
  } else {
    return {
      stage: "penalty",
      normProgress: 100,
      graceProgress: 100,
      penaltyProgress: 100,
      daysUntilDue: 0,
      daysLeftGrace: 0,
      penaltyDays: intervalDays,
      rawOverdueDays: intervalDays,
      label: `Штраф ${intervalDays} дн. (не обслуживалось)`,
      badgeText: `Штраф: ${intervalDays} дн.`,
    };
  }

  // 1. Зеленая зона: Норма (заполнение слева направо к сроку ТО)
  if (elapsedDays < intervalDays) {
    const daysUntilDue = intervalDays - elapsedDays;
    // По мере приближения к сроку ТО полоска продвигается к желтой зоне
    const normProgress = Math.min(
      100,
      Math.max(8, Math.round((elapsedDays / intervalDays) * 100)),
    );

    return {
      stage: "normal",
      normProgress,
      graceProgress: 0,
      penaltyProgress: 0,
      daysUntilDue,
      daysLeftGrace: toleranceDays,
      penaltyDays: 0,
      rawOverdueDays: 0,
      label: `В норме • ТО через ${daysUntilDue} дн.`,
      badgeText: `В норме (${daysUntilDue} дн.)`,
    };
  }

  const daysPastDue = elapsedDays - intervalDays;

  // 2. Желтая зона: Льготный период без штрафа
  // Зеленая зона уже 100% пройдена, желтая заполняется по мере истечения льготы к красной зоне
  if (daysPastDue <= toleranceDays) {
    const daysLeftGrace = toleranceDays - daysPastDue;
    const graceProgress =
      toleranceDays > 0
        ? Math.min(
            100,
            Math.max(12, Math.round((daysPastDue / toleranceDays) * 100)),
          )
        : 100;

    const daysText =
      daysLeftGrace === 0
        ? "сегодня последний день"
        : `${daysLeftGrace} ${daysLeftGrace === 1 ? "день" : daysLeftGrace < 5 ? "дня" : "дней"}`;

    return {
      stage: "grace",
      normProgress: 100,
      graceProgress,
      penaltyProgress: 0,
      daysUntilDue: 0,
      daysLeftGrace,
      penaltyDays: 0,
      rawOverdueDays: Math.max(1, daysPastDue),
      label: `Пора обслужить • без штрафа ${daysText}`,
      badgeText: `Льгота: ${daysLeftGrace} дн.`,
    };
  }

  // 3. Красная зона: Штраф
  // Зеленая и желтая зоны пройдены на 100%, красная заполняется по мере роста штрафа
  const penaltyDays = daysPastDue - toleranceDays;
  const penaltyMaxScale = Math.max(14, toleranceDays * 4);
  const penaltyProgress = Math.min(
    100,
    Math.max(20, Math.round((penaltyDays / penaltyMaxScale) * 100)),
  );

  return {
    stage: "penalty",
    normProgress: 100,
    graceProgress: 100,
    penaltyProgress,
    daysUntilDue: 0,
    daysLeftGrace: 0,
    penaltyDays,
    rawOverdueDays: daysPastDue,
    label: `Штраф ${penaltyDays} дн. (просрочка ${daysPastDue} дн.)`,
    badgeText: `Штраф: ${penaltyDays} дн.`,
  };
}
