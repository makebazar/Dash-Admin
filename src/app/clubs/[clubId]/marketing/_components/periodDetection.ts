// Period auto-detection from file names or table rows

const MONTH_NAMES_RU: Record<number, string> = {
  1: "Январь",
  2: "Февраль",
  3: "Март",
  4: "Апрель",
  5: "Май",
  6: "Июнь",
  7: "Июль",
  8: "Август",
  9: "Сентябрь",
  10: "Октябрь",
  11: "Ноябрь",
  12: "Декабрь",
};

export interface DetectedPeriod {
  name: string;
  periodStart: string | null; // ISO YYYY-MM-DD
  periodEnd: string | null;   // ISO YYYY-MM-DD
  daysCount?: number;
}

export function parseRussianDateToISO(dStr: string): string | null {
  if (!dStr) return null;
  const clean = dStr.trim().split(" ")[0]; // drop time if present
  const parts = clean.split(/[.\-/]/);
  if (parts.length === 3) {
    let day = parseInt(parts[0], 10);
    let month = parseInt(parts[1], 10);
    let year = parseInt(parts[2], 10);
    if (year < 100) year += 2000;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const mm = String(month).padStart(2, "0");
      const dd = String(day).padStart(2, "0");
      return `${year}-${mm}-${dd}`;
    }
  }
  return null;
}

export function formatPeriod(startISO: string, endISO: string): DetectedPeriod {
  const [sy, sm, sd] = startISO.split("-").map(Number);
  const [ey, em, ed] = endISO.split("-").map(Number);

  const startDate = new Date(sy, sm - 1, sd);
  const endDate = new Date(ey, em - 1, ed);
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  const daysCount = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  // Check if it represents a full month (e.g. from 1st to 28-31st of same month/year)
  const isFullMonth =
    sy === ey &&
    sm === em &&
    sd === 1 &&
    ed >= 28;

  let name: string;
  if (isFullMonth) {
    const monthName = MONTH_NAMES_RU[sm] || `Месяц ${sm}`;
    name = `${monthName} ${sy}`;
  } else {
    name = `${String(sd).padStart(2, "0")}.${String(sm).padStart(2, "0")}.${sy} — ${String(ed).padStart(2, "0")}.${String(em).padStart(2, "0")}.${ey}`;
  }

  return {
    name,
    periodStart: startISO,
    periodEnd: endISO,
    daysCount,
  };
}

export function detectPeriod(
  fileNames: (string | null)[],
  packageRows: Record<string, unknown>[] | null,
  summaryRows: Record<string, unknown>[] | null
): DetectedPeriod {
  const cleanNames = fileNames.filter(Boolean) as string[];

  // 1. Try regex on file names: e.g. "Visits-01.09.2024-30.09.2024.xlsx", "01.09.2024_30.09.2024"
  for (const fn of cleanNames) {
    const match = fn.match(/(\d{2}[.\-/]\d{2}[.\-/]\d{2,4})[_\-\s—подо]+(\d{2}[.\-/]\d{2}[.\-/]\d{2,4})/i);
    if (match) {
      const startISO = parseRussianDateToISO(match[1]);
      const endISO = parseRussianDateToISO(match[2]);
      if (startISO && endISO) {
        return formatPeriod(startISO, endISO);
      }
    }
  }

  // 2. Try inspecting header & summary metadata rows (Langame files often have "Дата от / Дата до" in the first 20 rows)
  if (summaryRows && summaryRows.length > 0) {
    const checkCount = Math.min(25, summaryRows.length);
    let sDate: string | null = null;
    let eDate: string | null = null;

    for (let i = 0; i < checkCount; i++) {
      const row = summaryRows[i];
      for (const [k, v] of Object.entries(row)) {
        const str = `${k} ${v}`;
        // Pattern like "с 01.09.2024 по 30.09.2024" or "01.09.2024 - 30.09.2024"
        const rangeMatch = str.match(/(\d{2}[.\-/]\d{2}[.\-/]\d{2,4})[_\-\s—подо]+(\d{2}[.\-/]\d{2}[.\-/]\d{2,4})/i);
        if (rangeMatch) {
          const sISO = parseRussianDateToISO(rangeMatch[1]);
          const eISO = parseRussianDateToISO(rangeMatch[2]);
          if (sISO && eISO) {
            return formatPeriod(sISO, eISO);
          }
        }

        if (/дата от|date from/i.test(str)) {
          const m = str.match(/(\d{2}[.\-/]\d{2}[.\-/]\d{2,4})/);
          if (m) sDate = parseRussianDateToISO(m[1]);
        }
        if (/дата до|date to/i.test(str)) {
          const m = str.match(/(\d{2}[.\-/]\d{2}[.\-/]\d{2,4})/);
          if (m) eDate = parseRussianDateToISO(m[1]);
        }
      }
    }

    if (sDate && eDate) {
      return formatPeriod(sDate, eDate);
    }
  }

  // 3. Try inspecting date columns in packageRows
  if (packageRows && packageRows.length > 0) {
    let minDate: string | null = null;
    let maxDate: string | null = null;

    const sample = packageRows.slice(0, 3000);
    for (const row of sample) {
      for (const [k, v] of Object.entries(row)) {
        if (typeof v === "string" && /дата|время|date|time/i.test(k)) {
          const match = v.match(/(\d{2}[.\-/]\d{2}[.\-/]\d{2,4})/);
          if (match) {
            const iso = parseRussianDateToISO(match[1]);
            if (iso) {
              if (!minDate || iso < minDate) minDate = iso;
              if (!maxDate || iso > maxDate) maxDate = iso;
            }
          }
        }
      }
    }

    if (minDate && maxDate) {
      return formatPeriod(minDate, maxDate);
    }
  }

  // Fallback: Current month
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthName = MONTH_NAMES_RU[month] || `Месяц ${month}`;
  const startISO = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endISO = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  return {
    name: `${monthName} ${year}`,
    periodStart: startISO,
    periodEnd: endISO,
    daysCount: lastDay,
  };
}
