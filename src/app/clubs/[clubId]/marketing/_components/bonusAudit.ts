import * as XLSX from "xlsx";

export type BonusCategory =
  | "tech_issue"
  | "marketing"
  | "spin_reward"
  | "cashier_correction"
  | "no_comment"
  | "other";

export type BonusRiskLevel = "critical" | "warning" | "normal";

export interface BonusOperation {
  id: string;
  phone: string;
  guestName: string;
  amount: number;
  dateStr: string;
  date: Date | null;
  source: string;
  rawAuthor: string;
  comment: string;
  category: BonusCategory;
  categoryLabel: string;
  riskLevel: BonusRiskLevel;
  riskReasons: string[];

  // Shift matching (filled dynamically against shifts list)
  matchedShiftId?: string | null;
  matchedEmployeeName?: string | null;
  matchedShiftType?: string | null;
  isOffShift?: boolean;
}

export interface ShiftInfo {
  id: string;
  club_id: number;
  user_id: string;
  employee_name: string;
  check_in: string | Date;
  check_out: string | Date | null;
  shift_type?: string;
  status?: string;
}

export const BONUS_CATEGORIES: { id: BonusCategory; label: string; color: string }[] = [
  { id: "tech_issue", label: "Техсбои и компенсации", color: "amber" },
  { id: "marketing", label: "Акции и лояльность", color: "emerald" },
  { id: "spin_reward", label: "Колесо / Спин / API", color: "indigo" },
  { id: "cashier_correction", label: "Ошибки кассы / Перенос", color: "blue" },
  { id: "no_comment", label: "Без комментария", color: "rose" },
  { id: "other", label: "Прочее", color: "slate" },
];

/**
 * Parses raw date string into Date.
 * Supports "DD.MM.YY HH:mm", "DD.MM.YYYY HH:mm", ISO strings, etc.
 */
export function parseTxDate(raw: unknown): Date | null {
  if (!raw) return null;
  if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw;
  const str = String(raw).trim();
  if (!str) return null;

  // Pattern: DD.MM.YY HH:mm or DD.MM.YYYY HH:mm
  const m = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10) - 1;
    let year = parseInt(m[3], 10);
    if (year < 100) year += 2000;
    const hour = m[4] ? parseInt(m[4], 10) : 0;
    const min = m[5] ? parseInt(m[5], 10) : 0;
    const sec = m[6] ? parseInt(m[6], 10) : 0;
    const d = new Date(year, month, day, hour, min, sec);
    return isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Categorize bonus comment by keywords
 */
export function categorizeComment(commentRaw: string, rawAuthor: string, source: string): { category: BonusCategory; label: string } {
  const c = (commentRaw || "").toLowerCase().trim();
  const a = (rawAuthor || "").toLowerCase().trim();
  const s = (source || "").toLowerCase().trim();

  if (!c) {
    return { category: "no_comment", label: "Без комментария" };
  }

  // Spin / bot / API rewards
  if (
    c.includes("spin") ||
    c.includes("reward bonus") ||
    c.includes("колесо") ||
    c.includes("рулетк") ||
    a === "api" ||
    c.includes("bot")
  ) {
    return { category: "spin_reward", label: "Колесо / Спин / API" };
  }

  // Technical compensation
  if (
    c.includes("компенсац") ||
    c.includes("завис") ||
    c.includes("вылет") ||
    c.includes("краш") ||
    c.includes("лаг") ||
    c.includes("синий") ||
    c.includes("экран") ||
    c.includes("мышь") ||
    c.includes("мышка") ||
    c.includes("наушник") ||
    c.includes("клав") ||
    c.includes("фейсит") ||
    c.includes("faceit") ||
    c.includes("пабг") ||
    c.includes("обновл") ||
    c.includes("пересад") ||
    c.includes("сбой") ||
    c.includes("не работа") ||
    c.includes("интернет")
  ) {
    return { category: "tech_issue", label: "Техсбои и компенсации" };
  }

  // Marketing, promos, reviews, birthdays
  if (
    c.includes("акци") ||
    c.includes("подар") ||
    c.includes("др") ||
    c.includes("день рожд") ||
    c.includes("отзыв") ||
    c.includes("яндекс") ||
    c.includes("2гис") ||
    c.includes("2gis") ||
    c.includes("промо") ||
    c.includes("турнир") ||
    c.includes("тг") ||
    c.includes("телеграм") ||
    c.includes("вк") ||
    c.includes("приветств") ||
    c.includes("бонус за рег") ||
    c.includes("друг")
  ) {
    return { category: "marketing", label: "Акции и лояльность" };
  }

  // Cashier errors, balance moves
  if (
    c.includes("ошибк") ||
    c.includes("перенос") ||
    c.includes("возврат") ||
    c.includes("не туда") ||
    c.includes("коррект") ||
    c.includes("смена аккаунта")
  ) {
    return { category: "cashier_correction", label: "Ошибки кассы / Перенос" };
  }

  return { category: "other", label: "Прочее" };
}

/**
 * Extracts and categorizes bonus accrual operations from raw transaction rows
 */
export function extractBonusOperations(txRows: Record<string, unknown>[]): BonusOperation[] {
  if (!txRows || txRows.length === 0) return [];

  // Detect column names from first row
  const s = txRows[0];
  const keys = Object.keys(s);

  const findKey = (candidates: string[]) => {
    return keys.find((k) => {
      const lower = k.toLowerCase();
      return candidates.some((c) => lower.includes(c.toLowerCase()));
    });
  };

  const colPhone = findKey(["Телефон", "phone", "тел"]);
  const colName = findKey(["ФИО", "Клиент", "Имя", "гость"]);
  const colAuthor = findKey(["Кем сделано", "Автор", "Сотрудник", "author"]);
  const colSource = findKey(["Источник", "касса", "source"]);
  const colBonus = findKey(["Бонусный баланс", "Бонус", "bonus"]);
  const colComment = findKey(["Комментарий", "Причина", "comment"]);
  const colDate = findKey(["Дата", "Время", "date", "created_at"]);

  const phoneCountMap = new Map<string, number>();

  const list: BonusOperation[] = [];

  for (let idx = 0; idx < txRows.length; idx++) {
    const row = txRows[idx];

    // Read bonus balance change
    let bonusVal = 0;
    if (colBonus && row[colBonus] !== undefined) {
      const bStr = String(row[colBonus]).replace(/\s/g, "").replace(",", ".");
      bonusVal = parseFloat(bStr) || 0;
    }

    // Only process accruals (positive bonus change)
    if (bonusVal <= 0) continue;

    const rawPhone = colPhone ? String(row[colPhone] || "") : "";
    const phone = rawPhone.replace(/\D/g, "").slice(-10);
    const guestName = colName ? String(row[colName] || "").trim() : "Гость";
    const rawAuthor = colAuthor ? String(row[colAuthor] || "").trim() : "";
    const source = colSource ? String(row[colSource] || "").trim() : "";
    const comment = colComment ? String(row[colComment] || "").trim() : "";
    const dateStr = colDate ? String(row[colDate] || "").trim() : "";
    const date = parseTxDate(dateStr);

    const { category, label: categoryLabel } = categorizeComment(comment, rawAuthor, source);

    if (phone) {
      phoneCountMap.set(phone, (phoneCountMap.get(phone) || 0) + 1);
    }

    const op: BonusOperation = {
      id: `bonus_${idx}_${phone}`,
      phone,
      guestName,
      amount: Math.round(bonusVal),
      dateStr,
      date,
      source,
      rawAuthor,
      comment,
      category,
      categoryLabel,
      riskLevel: "normal",
      riskReasons: [],
    };

    list.push(op);
  }

  // Assess risks and anomalies
  for (const op of list) {
    const isApi = op.rawAuthor.toLowerCase() === "api" || op.category === "spin_reward";

    // 1. Large accrual without comment
    if (op.category === "no_comment") {
      if (op.amount >= 500 && !isApi) {
        op.riskLevel = "critical";
        op.riskReasons.push(`Крупное начисление ${op.amount} Б без комментария`);
      } else if (op.amount >= 150 && !isApi) {
        if (op.riskLevel !== "critical") op.riskLevel = "warning";
        op.riskReasons.push(`Начисление ${op.amount} Б без комментария`);
      }
    }

    // 2. Extra large sum (> 2000 B)
    if (op.amount >= 2000 && !isApi) {
      op.riskLevel = "critical";
      op.riskReasons.push(`Аномально крупная сумма: ${op.amount} Б`);
    }

    // 3. Serial accruals to same client
    if (op.phone && (phoneCountMap.get(op.phone) || 0) >= 3 && !isApi) {
      if (op.riskLevel === "normal") op.riskLevel = "warning";
      op.riskReasons.push(`Частые начисления клиенту (${phoneCountMap.get(op.phone)} раз)`);
    }
  }

  return list;
}

/**
 * Matches a list of bonus operations with shift intervals from the database
 */
export function matchOperationsWithShifts(
  operations: BonusOperation[],
  shifts: ShiftInfo[]
): BonusOperation[] {
  if (!shifts || shifts.length === 0) return operations;

  const parsedShifts = shifts.map((s) => {
    const inDate = new Date(s.check_in);
    const outDate = s.check_out ? new Date(s.check_out) : new Date(inDate.getTime() + 16 * 3600 * 1000);
    return {
      ...s,
      inDate,
      outDate,
    };
  });

  return operations.map((op) => {
    if (!op.date) return op;

    const opTime = op.date.getTime();

    // Find shift where check_in <= opTime <= check_out
    const match = parsedShifts.find((s) => {
      return opTime >= s.inDate.getTime() && opTime <= s.outDate.getTime();
    });

    const isApi = op.rawAuthor.toLowerCase() === "api" || op.category === "spin_reward";

    if (match) {
      return {
        ...op,
        matchedShiftId: match.id,
        matchedEmployeeName: match.employee_name || "Администратор смены",
        matchedShiftType: match.shift_type || "Смена",
        isOffShift: false,
      };
    } else {
      const riskReasons = [...op.riskReasons];
      let riskLevel = op.riskLevel;
      if (!isApi) {
        riskReasons.push("Выдано вне открытой смены");
        if (riskLevel === "normal") riskLevel = "warning";
      }

      return {
        ...op,
        matchedShiftId: null,
        matchedEmployeeName: isApi ? "API / Автомат" : "Вне смены",
        matchedShiftType: null,
        isOffShift: !isApi,
        riskLevel,
        riskReasons,
      };
    }
  });
}

/**
 * Robust CSV parser supporting quotes and semicolons/commas
 */
export function parseCSVRobust(text: string): Record<string, unknown>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const delim = lines[0].includes(";") ? ";" : ",";

  const parseRow = (rowStr: string): string[] => {
    const fields: string[] = [];
    let cur = "";
    let inQuotes = false;
    let i = 0;
    while (i < rowStr.length) {
      const c = rowStr[i];
      if (c === '"') {
        if (inQuotes && i + 1 < rowStr.length && rowStr[i + 1] === '"') {
          cur += '"';
          i += 2;
          continue;
        }
        inQuotes = !inQuotes;
        i++;
      } else if (c === delim && !inQuotes) {
        fields.push(cur.trim());
        cur = "";
        i++;
      } else {
        cur += c;
        i++;
      }
    }
    fields.push(cur.trim());
    return fields;
  };

  const headerLine = lines[0].replace(/^\uFEFF/, "");
  const headers = parseRow(headerLine).map((h) => h.replace(/^"+|"+$/g, "").trim());

  const rows: Record<string, unknown>[] = [];
  for (let idx = 1; idx < lines.length; idx++) {
    const vals = parseRow(lines[idx]);
    if (vals.length === 1 && !vals[0]) continue;
    const obj: Record<string, unknown> = {};
    for (let j = 0; j < headers.length; j++) {
      if (headers[j]) {
        obj[headers[j]] = vals[j] !== undefined ? vals[j] : "";
      }
    }
    rows.push(obj);
  }
  return rows;
}

/**
 * Robust XLSX parser detecting the first header row with >= 4 columns
 */
export function parseXLSXBuffer(buffer: ArrayBuffer): Record<string, unknown>[] {
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const allRows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const headerIdx = allRows.findIndex(
    (row) => Array.isArray(row) && row.filter(Boolean).length >= 4
  );
  if (headerIdx < 0) return [];
  const headers = (allRows[headerIdx] as unknown[]).map((v) => String(v ?? "").trim());
  return allRows.slice(headerIdx + 1).map((row) =>
    Object.fromEntries(headers.map((h, i) => [h, (row as unknown[])[i] ?? ""]))
  );
}

/**
 * Universal spreadsheet file parser for both CSV and XLSX
 */
export async function parseSpreadsheetFile(file: File): Promise<Record<string, unknown>[]> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "csv") {
    const text = await file.text();
    return parseCSVRobust(text);
  } else if (ext === "xlsx" || ext === "xls") {
    const buf = await file.arrayBuffer();
    return parseXLSXBuffer(buf);
  }
  throw new Error("Неподдерживаемый формат: " + file.name);
}
