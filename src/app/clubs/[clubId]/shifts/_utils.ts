export const DATE_MASK_TEMPLATE = "__.__.____";
export const DATE_EDITABLE_POSITIONS = [0, 1, 3, 4, 6, 7, 8, 9] as const;
export const DATE_COMPLETE_REGEX = /^(\d{2})\.(\d{2})\.(\d{4})$/;

export const buildMaskedDateDisplay = (digits: string[]) => {
  const chars = DATE_MASK_TEMPLATE.split("");
  let hasAnyDigits = false;

  DATE_EDITABLE_POSITIONS.forEach((pos, index) => {
    const digit =
      digits[index] && /\d/.test(digits[index]) ? digits[index] : "_";
    if (digit !== "_") hasAnyDigits = true;
    chars[pos] = digit;
  });

  return hasAnyDigits ? chars.join("") : "";
};

export const extractMaskedDateDigits = (display: string) =>
  DATE_EDITABLE_POSITIONS.map((pos) => {
    const char = display[pos] || "_";
    return /\d/.test(char) ? char : "_";
  });

export const dateToInternal = (displayStr: string) => {
  const match = displayStr.match(DATE_COMPLETE_REGEX);
  if (!match) return "";

  const [, dd, mm, yyyy] = match;
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);

  if (month < 1 || month > 12 || day < 1) return "";

  const parsed = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "";
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() + 1 !== month ||
    parsed.getDate() !== day
  ) {
    return "";
  }

  return `${yyyy}-${mm}-${dd}`;
};

export const dateToDisplay = (internalStr: string) => {
  if (!internalStr) return "";
  const parts = internalStr.split("-");
  if (parts.length !== 3) return "";
  const [y, m, d] = parts;
  return `${d}.${m}.${y}`;
};

export const DATE_TIME_MASK_TEMPLATE = "__.__.____, __:__";
export const DATE_TIME_EDITABLE_POSITIONS = [
  0, 1, 3, 4, 6, 7, 8, 9, 12, 13, 15, 16,
] as const;
export const DATE_TIME_COMPLETE_REGEX = /^(\d{2})\.(\d{2})\.(\d{4}), (\d{2}):(\d{2})$/;

export const buildMaskedDateTimeDisplay = (digits: string[]) => {
  const chars = DATE_TIME_MASK_TEMPLATE.split("");
  let hasAnyDigits = false;

  DATE_TIME_EDITABLE_POSITIONS.forEach((pos, index) => {
    const digit =
      digits[index] && /\d/.test(digits[index]) ? digits[index] : "_";
    if (digit !== "_") hasAnyDigits = true;
    chars[pos] = digit;
  });

  return hasAnyDigits ? chars.join("") : "";
};

export const extractMaskedDateTimeDigits = (display: string) =>
  DATE_TIME_EDITABLE_POSITIONS.map((pos) => {
    const char = display[pos] || "_";
    return /\d/.test(char) ? char : "_";
  });

export const displayToLocalDateTime = (display: string) => {
  const match = display.match(DATE_TIME_COMPLETE_REGEX);
  if (!match) return "";

  const [, dd, mm, yyyy, hh, min] = match;
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);
  const hours = Number(hh);
  const minutes = Number(min);

  if (month < 1 || month > 12 || day < 1 || hours > 23 || minutes > 59)
    return "";

  const parsed = new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:00`);
  if (Number.isNaN(parsed.getTime())) return "";
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() + 1 !== month ||
    parsed.getDate() !== day ||
    parsed.getHours() !== hours ||
    parsed.getMinutes() !== minutes
  ) {
    return "";
  }

  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
};

export function getMetricValue(shift: any, field: string): number {
  if (!shift) return 0;

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
          (sum: number, item: any) => sum + (Number(item.amount) || 0),
          0,
        );
      }
      return parseFloat(String(reportVal)) || 0;
    }

    return Number(shift[field]) || 0;
  }

  const val = shift.report_data?.[field];
  if (Array.isArray(val)) {
    return val.reduce(
      (sum: number, item: any) => sum + (Number(item.amount) || 0),
      0,
    );
  }
  return parseFloat(String(val)) || 0;
}

export function formatMoney(amount: number | string | any[] | null): string {
  if (amount === null || amount === undefined) return "0\u00A0₽";

  let num: number;
  if (Array.isArray(amount)) {
    num = amount.reduce(
      (sum: number, item: any) => sum + (Number(item.amount) || 0),
      0,
    );
  } else {
    num = typeof amount === "string" ? parseFloat(amount) : Number(amount);
  }

  if (isNaN(num) || num === 0) return "0\u00A0₽";
  return (
    num
      .toLocaleString("ru-RU", { maximumFractionDigits: 0 })
      .replace(/\s/g, "\u00A0") + "\u00A0₽"
  );
}

export function formatDate(dateStr: string, timezone: string = "Europe/Moscow"): string {
  return new Date(dateStr).toLocaleDateString("ru-RU", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    timeZone: timezone,
  });
}

export function formatTime(dateStr: string, timezone: string = "Europe/Moscow"): string {
  return new Date(dateStr).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  });
}

export function isWeekendDate(dateStr: string, timezone: string = "Europe/Moscow"): boolean {
  const weekday = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: timezone,
  }).format(new Date(dateStr));

  return weekday === "Sat" || weekday === "Sun";
}
