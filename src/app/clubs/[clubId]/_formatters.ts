const currencyFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0,
});

export function formatCurrency(value: number) {
  const safeValue = Number.isFinite(value) ? value : 0;
  return `${currencyFormatter.format(Math.round(safeValue))} ₽`;
}

export function formatSignedPercent(value: number) {
  const safeValue = Number.isFinite(value) ? value : 0;
  const sign = safeValue > 0 ? "+" : "";
  return `${sign}${safeValue.toFixed(1)}%`;
}

export function getDateObject(value: string | Date) {
  if (value instanceof Date) return value;
  if (typeof value === "string" && value.includes("-")) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, (month || 1) - 1, day || 1);
  }
  return new Date(value);
}

export function isWeekendDate(value: string | Date) {
  const day = getDateObject(value).getDay();
  return day === 0 || day === 6;
}

export function formatShiftType(value: string) {
  if (value === "DAY") return "Дневная смена";
  if (value === "NIGHT") return "Ночная смена";
  return value;
}

export function formatWeekdayFull(weekday: number) {
  return (
    [
      "Воскресенье",
      "Понедельник",
      "Вторник",
      "Среда",
      "Четверг",
      "Пятница",
      "Суббота",
    ][weekday] || "День"
  );
}

export function formatWeekdayShortByIndex(weekday: number) {
  return ["вс", "пн", "вт", "ср", "чт", "пт", "сб"][weekday] || "дн";
}

export function normalizeMetricValue(value: unknown): number {
  if (Array.isArray(value))
    return value.reduce((sum, item) => sum + normalizeMetricValue(item), 0);
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (value && typeof value === "object") {
    if ("value" in value)
      return normalizeMetricValue((value as { value?: unknown }).value);
    return 0;
  }
  return 0;
}

export function formatDateKeyInTimezone(value: Date | string, timeZone: string) {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value || "0000";
  const month = parts.find((part) => part.type === "month")?.value || "01";
  const day = parts.find((part) => part.type === "day")?.value || "01";
  return `${year}-${month}-${day}`;
}

export function formatTaskType(type: string) {
  switch (type.toUpperCase()) {
    case "CLEANING": return "Чистка";
    case "REPAIR": return "Ремонт";
    case "INSPECTION": return "Осмотр";
    case "REPLACEMENT": return "Замена";
    default: return type;
  }
}

export function formatEquipmentType(type: string) {
  switch (type.toUpperCase()) {
    case "PC": return "ПК";
    case "MONITOR": return "Монитор";
    case "KEYBOARD": return "Клавиатура";
    case "MOUSE": return "Мышь";
    case "MOUSEPAD": return "Коврик";
    case "HEADSET": return "Наушники";
    case "CONSOLE": return "Консоль";
    case "GAMEPAD": return "Геймпад";
    case "VR_HEADSET": return "VR-шлем";
    case "TV": return "ТВ";
    case "CHAIR": return "Кресло";
    default: return type;
  }
}
