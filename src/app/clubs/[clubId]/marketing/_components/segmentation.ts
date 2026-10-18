/**
 * Unified Analytics Engine for Computer Clubs.
 *
 * Mathematically verified calculations:
 * 1. REAL REVENUE (LTV):
 *    - In Summary Report: topupAdmin + topupLK + topupApp (excluding bonus & manual adjustments).
 *    - In Cashier Ledger: transactions where source == 'касса' or 'лк' (excluding bonus cashier).
 * 2. BONUS EMISSION & BURDEN:
 *    - totalBonusAccrued: sum of all bonuses issued/topped up by the club (Пополнение через бонусную кассу).
 *    - overallBonusEmissionRate = (totalBonusAccrued / totalRevenueInLog) * 100% (% к реальной кассе).
 *    - overallBonusShareOfTotal = (totalBonusAccrued / (totalRevenueInLog + totalBonusAccrued)) * 100% (% во всех начислениях).
 * 3. MACHINE-HOUR YIELD (Доходность часа):
 *    - hourlyYield = totalSpent / (playedMinutes / 60) (computed from exact minutes, no rounding drift).
 * 4. TIME AGGREGATION:
 *    - Summing exact minutes across all sessions first, then converting to total hours.
 */

export interface ClientProfile {
  name: string;
  phone: string;
  email: string;
  gender: string;
  age: number | null;
  group: string;

  // REAL MONEY ONLY (чистые рубли)
  balance: number;          // Реальный остаток на балансе (рубли)
  totalSpent: number;       // Реальные пополнения деньгами (без бонусов!)
  txCount: number;
  avgTx: number;

  // BONUSES (отдельно!)
  bonusBalance: number;     // Текущий остаток бонусов на счете
  bonusAccrued: number;     // Всего начислено/подарено бонусов за период
  bonusSpent: number;       // Всего списано бонусов за период

  // MATHEMATICAL RATIOS
  bonusGivenRatio: number;  // % выданных бонусов к реальным деньгам клиента (bonusAccrued / totalSpent * 100)
  cashShare: number;        // % доли реальных денег во всех начислениях клиента
  hourlyYield?: number;     // Доходность машино-часа (₽/ч = totalSpent / (playedMinutes / 60))
  valueCategory: "diamond" | "loyal" | "bonus_heavy" | "standard";

  lastAuth: Date | null;
  regDate: Date | null;
  daysSince: number | null;
  status: "active" | "cooling" | "churned" | "newbie" | "unknown";
  isWhale: boolean;

  // Rich metrics from Summary Report
  visits?: number;
  playedMinutes?: number;
  playedHours?: number;     // Отсиженные часы с точностью до 0.1
  avgSessionMinutes?: number;
  topupAdmin?: number;
  topupLK?: number;
  topupApp?: number;
  spentSessionsReal?: number;
  spentShop?: number;
  preferredPayment?: "admin" | "lk" | "app" | "mixed";

  // Package & Equipment / Zone metrics (from 4th report)
  favoriteZone?: string;
  favoriteTariff?: string;
  favoriteSeat?: string;
  packageCount?: number;
  packageSpentRub?: number;
  packageSpentBonus?: number;
  nightSessionsCount?: number;
  gamerPersona?: "night_owl" | "console" | "bootcamp" | "regular";
  preferredTime?: "morning" | "day" | "evening" | "night";
}

export interface ClubZoneStat {
  zone: string;
  sessions: number;
  rub: number;
  bonus: number;
  percentOfRub: number;
  uniqueGuests: number;
}

export interface ClubPcStat {
  pc: string;
  zone: string;
  sessions: number;
  rub: number;
  bonus: number;
  uniqueGuests: number;
  percentOfZoneAverage: number;
}

export interface ClubTariffStat {
  name: string;
  type: string;
  count: number;
  rub: number;
  bonus: number;
}

export interface WorkstationInfo {
  name: string;
  zone?: string | null;
}

export interface ClubAnalytics {
  profiles: ClientProfile[];
  clubPcStats?: ClubPcStat[];
  totalGuests: number;
  totalRevenueInLog: number; // ТОЛЬКО реальные деньги (рубли)
  totalBonusAccrued: number; // ВСЕГО НАЧИСЛЕНО бонусов клубом
  totalBonusSpent: number;   // Всего списано бонусов
  overallBonusEmissionRate: number; // % эмиссии бонусов к реальной выручке (totalBonusAccrued / totalRevenueInLog * 100)
  overallBonusShareOfTotal: number; // % доли бонусов во всех начислениях
  avgHourlyYield: number;    // Средняя доходность машино-часа по клубу (₽/час)

  activeCount: number;       // были <= 14 дней
  coolingCount: number;      // 15 - 30 дней
  churnedCount: number;      // 31+ дней
  abandonedBalance: number;  // реальные рубли на счетах ушедших
  abandonedBonus: number;    // бонусы на счетах ушедших
  whales: ClientProfile[];   // топ по реальным тратам
  topChurned: ClientProfile[]; // крупные клиенты в оттоке
  atRisk: ClientProfile[];   // крупные клиенты, которые засыпают

  // Report Period Metadata (from Table 3 or date filter)
  hasSummaryReport: boolean;
  reportDateFrom?: Date | null;
  reportDateTo?: Date | null;
  reportDays?: number | null;
  datasetDateFrom?: Date | null;
  datasetDateTo?: Date | null;

  totalPlayedMinutes?: number;
  totalHoursPlayed?: number;
  totalVisits?: number;
  totalAdminTopup?: number;
  totalLKTopup?: number;
  totalAppTopup?: number;
  totalShopSpent?: number;

  // Package & Zone Report Data (from Table 4)
  hasPackagesReport: boolean;
  totalPackageSessions?: number;
  totalPackageRub?: number;
  totalPackageBonus?: number;
  clubZoneStats?: ClubZoneStat[];
  clubTariffStats?: ClubTariffStat[];

  parsedAt: Date;
}

export interface DateFilter {
  startDate: Date | null;
  endDate: Date | null;
  monthKey?: string;
}

export interface MonthOption {
  key: string;
  label: string;
  shortLabel: string;
  startDate: Date;
  endDate: Date;
}

export function getAvailableMonths(from: Date, to: Date): MonthOption[] {
  if (!from || !to || isNaN(from.getTime()) || isNaN(to.getTime())) return [];
  const months: MonthOption[] = [];
  const curr = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);

  const monthNames = [
    "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
  ];
  const shortRu = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];

  while (curr <= end) {
    const year = curr.getFullYear();
    const month = curr.getMonth();
    const key = `${year}-${String(month + 1).padStart(2, "0")}`;

    const mStart = (year === from.getFullYear() && month === from.getMonth())
      ? new Date(year, month, from.getDate(), 0, 0, 0, 0)
      : new Date(year, month, 1, 0, 0, 0, 0);

    const mEnd = (year === to.getFullYear() && month === to.getMonth())
      ? new Date(year, month, to.getDate(), 23, 59, 59, 999)
      : new Date(year, month + 1, 0, 23, 59, 59, 999);

    months.push({
      key,
      label: `${monthNames[month]} ${year}`,
      shortLabel: `${shortRu[month]} ${year}`,
      startDate: mStart,
      endDate: mEnd,
    });

    curr.setMonth(curr.getMonth() + 1);
  }

  return months;
}

export function normalizePhone(raw: unknown): string {
  if (!raw) return "";
  const s = String(raw).replace(/<[^>]+>/g, "").trim();
  return s
    .replace(/\D/g, "")
    .slice(-10);
}

export function parseDate(raw: unknown): Date | null {
  if (!raw) return null;
  if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw;
  if (typeof raw === "number" && raw > 20000 && raw < 60000) {
    const d = new Date(Math.round((raw - 25569) * 86400 * 1000));
    return isNaN(d.getTime()) ? null : d;
  }
  const s = String(raw).trim().replace(/"/g, "");
  // Match DD.MM.YYYY HH:mm:ss or DD.MM.YYYY HH:mm or DD.MM.YY
  const m = s.match(/^(\d{2})\.(\d{2})\.(\d{2,4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) {
    let year = parseInt(m[3]);
    if (year < 100) year += 2000;
    const hours = m[4] ? parseInt(m[4]) : 0;
    const mins = m[5] ? parseInt(m[5]) : 0;
    const secs = m[6] ? parseInt(m[6]) : 0;
    const d = new Date(year, parseInt(m[2]) - 1, parseInt(m[1]), hours, mins, secs);
    return isNaN(d.getTime()) ? null : d;
  }
  const iso = new Date(s);
  return isNaN(iso.getTime()) ? null : iso;
}

export function parseNumber(raw: unknown): number {
  if (raw === undefined || raw === null || raw === "") return 0;
  const s = String(raw).replace(/\s/g, "").replace(",", ".");
  const num = parseFloat(s);
  return isNaN(num) ? 0 : num;
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round(Math.abs(b.getTime() - a.getTime()) / 86_400_000);
}

export function detectCol(row: Record<string, unknown>, candidates: string[]): string | undefined {
  return candidates.find((c) => c in row)
    ?? candidates.find((c) =>
      Object.keys(row).some((k) => k.toLowerCase().includes(c.toLowerCase()))
    );
}

export function isSummaryReportFile(rows: Record<string, unknown>[]): boolean {
  if (!rows.length) return false;
  const s = rows[0];
  const keys = Object.keys(s).map((k) => k.toLowerCase());
  return keys.some((k) => k.includes("отсиженные минуты") || k.includes("пополнение через админку") || k.includes("посещения"));
}

export function isTransactionFile(rows: Record<string, unknown>[]): boolean {
  if (!rows.length) return false;
  const s = rows[0];
  const keys = Object.keys(s).map((k) => k.toLowerCase());
  return keys.some((k) => k.includes("кем сделано") || k.includes("источник") || (k.includes("начислений") && k.includes("списаний")));
}

export function isPackagesFile(rows: Record<string, unknown>[]): boolean {
  if (!rows.length) return false;
  const s = rows[0];
  const keys = Object.keys(s).map((k) => k.toLowerCase());
  return keys.some(
    (k) =>
      k.includes("название тарифа") ||
      k.includes("тип тарифа") ||
      (k.includes("дата покупки") && k.includes("пк"))
  );
}

export function buildClubAnalytics(
  guestRows: Record<string, unknown>[] = [],
  txRows: Record<string, unknown>[] = [],
  summaryRows: Record<string, unknown>[] = [],
  packageRows: Record<string, unknown>[] = [],
  workstations: WorkstationInfo[] = [],
  dateFilter?: DateFilter | null
): ClubAnalytics {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let rawMinDate: Date | null = null;
  let rawMaxDate: Date | null = null;

  // Build lookup from workstation name to zone
  const wsZoneMap = new Map<string, string>();
  for (const w of workstations) {
    if (w.name && w.zone) {
      const norm = w.name.replace(/[\s\-_]/g, "").toLowerCase();
      wsZoneMap.set(norm, w.zone.trim());
    }
  }

  // Fallback resolver if workstation not in DB or name format varies
  const resolveZone = (pcRaw: string): string => {
    const norm = pcRaw.replace(/[\s\-_]/g, "").toLowerCase();
    if (wsZoneMap.has(norm)) return wsZoneMap.get(norm)!;

    if (norm.startsWith("tv") || norm.startsWith("ps")) return "PS Зона";
    if (norm === "pc41") return "Соло";

    const pcNum = parseInt(norm.replace(/\D/g, ""));
    if (!isNaN(pcNum)) {
      if (pcNum >= 1 && pcNum <= 18) return "Стандарт";
      if (pcNum >= 19 && pcNum <= 23) return "Буткемп";
      if (pcNum >= 24 && pcNum <= 33) return "Стандарт +";
      if (pcNum >= 34 && pcNum <= 40) return "Буткемп ПРО";
      if (pcNum === 41) return "Соло";
    }
    return "Стандарт";
  };

  // 0. Parse Packages & Tariffs Report (4-я таблица)
  interface ClientPackageStats {
    sessions: number;
    rub: number;
    bonus: number;
    nightSessions: number;
    tariffs: Map<string, { count: number; rub: number; bonus: number }>;
    zones: Map<string, number>;
    seats: Map<string, number>;
    timeSlots: { morning: number; day: number; evening: number; night: number };
  }
  const clientPackageMap = new Map<string, ClientPackageStats>();
  const clubZoneMap = new Map<string, { sessions: number; rub: number; bonus: number; guests: Set<string> }>();
  const clubTariffMap = new Map<string, { name: string; type: string; count: number; rub: number; bonus: number }>();
  const clubPcMap = new Map<string, { pc: string; zone: string; sessions: number; rub: number; bonus: number; guests: Set<string> }>();

  let totalPackageRub = 0;
  let totalPackageBonus = 0;
  let totalPackageSessions = 0;
  let totalPackageHours = 0;

  if (packageRows.length > 0) {
    const s = packageRows[0];
    const colTariffName = detectCol(s, ["Название тарифа"]);
    const colTariffType = detectCol(s, ["Тип тарифа"]);
    const colPhone = detectCol(s, ["Номер телефона гостя", "Телефон", "phone"]);
    const colPC = detectCol(s, ["ПК", "pc", "Место"]);
    const colRub = detectCol(s, ["Списано рублей"]);
    const colBonus = detectCol(s, ["Списано бонусов"]);
    const colDate = detectCol(s, ["Дата покупки тарифа", "Дата покупки", "Дата активации сессии", "Дата"]);

    for (const row of packageRows) {
      let rowDate: Date | null = null;
      if (colDate && row[colDate]) {
        rowDate = parseDate(row[colDate]);
        if (rowDate && !isNaN(rowDate.getTime())) {
          if (!rawMinDate || rowDate < rawMinDate) rawMinDate = rowDate;
          if (!rawMaxDate || rowDate > rawMaxDate) rawMaxDate = rowDate;

          if (dateFilter?.startDate && rowDate < dateFilter.startDate) continue;
          if (dateFilter?.endDate && rowDate > dateFilter.endDate) continue;
        }
      }

      const phone = normalizePhone(row[colPhone ?? ""]);
      if (phone.length < 10) continue;

      const tariffName = String(row[colTariffName ?? ""] ?? "Базовый тариф").trim();
      const tariffType = String(row[colTariffType ?? ""] ?? "Пакет").trim();
      const pc = String(row[colPC ?? ""] ?? "").trim();
      const rub = parseNumber(row[colRub ?? ""]);
      const bonus = parseNumber(row[colBonus ?? ""]);
      const zone = resolveZone(pc);

      const lowerT = tariffName.toLowerCase();
      let sessHours = 1;
      if (lowerT.includes("ночь")) {
        sessHours = 8;
      } else {
        const hm = lowerT.match(/(\d+)\s*(?:час|ч)/);
        if (hm) sessHours = parseInt(hm[1], 10);
      }

      totalPackageSessions += 1;
      totalPackageRub += rub;
      totalPackageBonus += bonus;
      totalPackageHours += sessHours;

      // Club tariff aggregations
      const tKey = tariffName.toLowerCase();
      const existingTariff = clubTariffMap.get(tKey) || { name: tariffName, type: tariffType, count: 0, rub: 0, bonus: 0 };
      existingTariff.count += 1;
      existingTariff.rub += rub;
      existingTariff.bonus += bonus;
      clubTariffMap.set(tKey, existingTariff);

      // Club zone aggregations
      const existingZone = clubZoneMap.get(zone) || { sessions: 0, rub: 0, bonus: 0, guests: new Set<string>() };
      existingZone.sessions += 1;
      existingZone.rub += rub;
      existingZone.bonus += bonus;
      existingZone.guests.add(phone);
      clubZoneMap.set(zone, existingZone);

      // Club PC aggregations
      if (pc) {
        const existingPc = clubPcMap.get(pc) || { pc, zone, sessions: 0, rub: 0, bonus: 0, guests: new Set<string>() };
        existingPc.sessions += 1;
        existingPc.rub += rub;
        existingPc.bonus += bonus;
        existingPc.guests.add(phone);
        clubPcMap.set(pc, existingPc);
      }

      // Client aggregations
      let clientPack = clientPackageMap.get(phone);
      if (!clientPack) {
        clientPack = {
          sessions: 0,
          rub: 0,
          bonus: 0,
          nightSessions: 0,
          tariffs: new Map(),
          zones: new Map(),
          seats: new Map(),
          timeSlots: { morning: 0, day: 0, evening: 0, night: 0 },
        };
        clientPackageMap.set(phone, clientPack);
      }

      clientPack.sessions += 1;
      clientPack.rub += rub;
      clientPack.bonus += bonus;

      const isNight = lowerT.includes("ночь");
      if (isNight) clientPack.nightSessions += 1;

      let slot: "morning" | "day" | "evening" | "night" | null = null;
      if (isNight) {
        slot = "night";
      } else if (lowerT.includes("утро")) {
        slot = "morning";
      } else if (lowerT.includes("день")) {
        slot = "day";
      } else if (lowerT.includes("вечер")) {
        slot = "evening";
      } else if (rowDate) {
        const h = rowDate.getHours();
        if (h >= 22 || h < 6) slot = "night";
        else if (h >= 6 && h < 12) slot = "morning";
        else if (h >= 12 && h < 17) slot = "day";
        else slot = "evening";
      }
      if (slot) {
        clientPack.timeSlots[slot] += 1;
      }

      const tStat = clientPack.tariffs.get(tariffName) || { count: 0, rub: 0, bonus: 0 };
      tStat.count += 1;
      tStat.rub += rub;
      tStat.bonus += bonus;
      clientPack.tariffs.set(tariffName, tStat);

      if (zone) {
        clientPack.zones.set(zone, (clientPack.zones.get(zone) || 0) + 1);
      }

      if (pc) {
        clientPack.seats.set(pc, (clientPack.seats.get(pc) || 0) + 1);
      }
    }
  }

  // 1. Parse Summary Report (3-я таблица)
  interface SummaryData {
    name: string;
    phone: string;
    topupAdmin: number;  // РЕАЛЬНЫЕ
    topupLK: number;     // РЕАЛЬНЫЕ
    topupApp: number;    // РЕАЛЬНЫЕ
    bonusTopup: number;  // ВЫДАНО БОНУСОВ КЛУБОМ
    bonusSpent: number;  // СПИСАНО БОНУСОВ
    spentSessions: number;
    spentShop: number;
    visits: number;
    playedMinutes: number;
    regDate: Date | null;
    lastVisit: Date | null;
    group: string;
    club: string;
  }
  const summaryMap = new Map<string, SummaryData>();

  let rawReportDateFrom: Date | null = null;
  let rawReportDateTo: Date | null = null;

  if (summaryRows.length > 0) {
    const s = summaryRows[0];
    const colPhone = detectCol(s, ["Телефон", "телефон", "phone"]);
    const colName = detectCol(s, ["ФИО", "фио", "Имя"]);
    const colAdmin = detectCol(s, ["Пополнение через админку"]);
    const colLK = detectCol(s, ["Пополнение через ЛК"]);
    const colApp = detectCol(s, ["Пополнение через моб. приложение", "моб. приложение"]);
    const colBonusTopup = detectCol(s, ["Пополнение через бонусную кассу", "бонусную кассу"]);
    const colBonusSpent = detectCol(s, ["Сумма списаний через бонусную кассу"]);
    const colSess = detectCol(s, ["Сумма списаний от сессий"]);
    const colShop = detectCol(s, ["Сумма списаний через магазин"]);
    const colVisits = detectCol(s, ["Посещения"]);
    const colMins = detectCol(s, ["Отсиженные минуты"]);
    const colReg = detectCol(s, ["Дата регистрации"]);
    const colLast = detectCol(s, ["Дата последнего посещения"]);
    const colGroup = detectCol(s, ["Группа гостя", "Группа"]);
    const colClub = detectCol(s, ["Клуб"]);

    // Extract exact period metadata
    for (let i = 0; i < Math.min(10, summaryRows.length); i++) {
      const row = summaryRows[i];
      const vals = Object.values(row).map(String);
      const keys = Object.keys(row);
      for (let j = 0; j < keys.length; j++) {
        const k = keys[j].toLowerCase();
        const v = String(row[keys[j]] ?? "");
        if (k.includes("дата от") || v.includes("Дата от")) {
          const nextVal = String(row[keys[j + 1]] ?? vals[j + 1] ?? "");
          const d = parseDate(nextVal);
          if (d) rawReportDateFrom = d;
        }
        if (k.includes("дата до") || v.includes("Дата до")) {
          const nextVal = String(row[keys[j + 1]] ?? vals[j + 1] ?? "");
          const d = parseDate(nextVal);
          if (d) rawReportDateTo = d;
        }
      }
    }

    if (rawReportDateFrom && (!rawMinDate || rawReportDateFrom < rawMinDate)) rawMinDate = rawReportDateFrom;
    if (rawReportDateTo && (!rawMaxDate || rawReportDateTo > rawMaxDate)) rawMaxDate = rawReportDateTo;

    for (const row of summaryRows) {
      const phone = normalizePhone(row[colPhone ?? ""]);
      if (phone.length < 10) continue;

      const name = String(row[colName ?? ""] ?? "").trim();
      const topupAdmin = parseNumber(row[colAdmin ?? ""]);
      const topupLK = parseNumber(row[colLK ?? ""]);
      const topupApp = parseNumber(row[colApp ?? ""]);
      const bonusTopup = parseNumber(row[colBonusTopup ?? ""]);
      const bonusSpent = parseNumber(row[colBonusSpent ?? ""]);
      const spentSessions = parseNumber(row[colSess ?? ""]);
      const spentShop = parseNumber(row[colShop ?? ""]);
      const visits = parseInt(String(row[colVisits ?? "0"])) || 0;
      const playedMinutes = parseInt(String(row[colMins ?? "0"])) || 0;
      const regDate = parseDate(row[colReg ?? ""]);
      const lastVisit = parseDate(row[colLast ?? ""]);
      const group = String(row[colGroup ?? ""] ?? "").trim();
      const club = String(row[colClub ?? ""] ?? "").trim();

      summaryMap.set(phone, {
        name,
        phone,
        topupAdmin,
        topupLK,
        topupApp,
        bonusTopup,
        bonusSpent,
        spentSessions,
        spentShop,
        visits,
        playedMinutes,
        regDate,
        lastVisit,
        group,
        club,
      });
    }
  }

  // 2. Parse Transactions (2-я таблица)
  interface TxSummary {
    realSpent: number;
    bonusTopup: number;
    bonusSpent: number;
    txCount: number;
    name: string;
  }
  const txMap = new Map<string, TxSummary>();

  if (txRows.length > 0) {
    const s = txRows[0];
    const colPhone = detectCol(s, ["Телефон", "телефон", "phone"]);
    const colAmount = detectCol(s, ["Баланс", "Сумма", "amount"]);
    const colBonus = detectCol(s, ["Бонусный баланс", "Бонус", "bonus"]);
    const colSource = detectCol(s, ["Источник", "источник", "Касса"]);
    const colName = detectCol(s, ["ФИО", "фио", "Имя"]);
    const colDateTx = detectCol(s, ["Дата", "Дата транзакции", "Время", "date", "created_at"]);

    for (const row of txRows) {
      if (colDateTx && row[colDateTx]) {
        const d = parseDate(row[colDateTx]);
        if (d && !isNaN(d.getTime())) {
          if (!rawMinDate || d < rawMinDate) rawMinDate = d;
          if (!rawMaxDate || d > rawMaxDate) rawMaxDate = d;

          if (dateFilter?.startDate && d < dateFilter.startDate) continue;
          if (dateFilter?.endDate && d > dateFilter.endDate) continue;
        }
      }

      const phone = normalizePhone(row[colPhone ?? ""]);
      if (phone.length < 10) continue;

      const source = String(row[colSource ?? ""] ?? "").toLowerCase();
      const amount = parseNumber(row[colAmount ?? ""]);
      const bonus = parseNumber(row[colBonus ?? ""]);

      const isBonusSource = source.includes("бонус");
      const isRealMoney = !isBonusSource && (source === "" || source.includes("касса") || source.includes("лк"));

      const existing = txMap.get(phone) || {
        realSpent: 0,
        bonusTopup: 0,
        bonusSpent: 0,
        txCount: 0,
        name: String(row[colName ?? ""] ?? "").trim(),
      };

      if (isRealMoney && amount > 0) {
        existing.realSpent += amount;
        existing.txCount += 1;
      }
      if (isBonusSource && (amount > 0 || bonus > 0)) {
        existing.bonusTopup += (bonus > 0 ? bonus : amount);
      }

      txMap.set(phone, existing);
    }
  }

  // 3. Parse Guests (1-я таблица)
  const guestMap = new Map<string, any>();
  if (guestRows.length > 0) {
    const s = guestRows[0];
    const colName = detectCol(s, ["ФИО", "фио", "Клиент", "Имя"]);
    const colPhone = detectCol(s, ["Телефон", "телефон", "phone"]);
    const colEmail = detectCol(s, ["Почта", "Email", "email"]);
    const colBal = detectCol(s, ["Баланс"]);
    const colBonusBal = detectCol(s, ["Бонусный баланс", "Бонусы"]);
    const colLast = detectCol(s, ["Последняя авторизация", "Последний визит"]);
    const colReg = detectCol(s, ["Дата регистрации"]);
    const colAge = detectCol(s, ["Возраст", "age"]);
    const colGender = detectCol(s, ["Пол", "gender"]);
    const colGroup = detectCol(s, ["Группа", "group"]);

    for (const row of guestRows) {
      const phone = normalizePhone(row[colPhone ?? ""]);
      if (phone.length < 10) continue;

      const lastAuth = parseDate(row[colLast ?? ""]);
      const regDate = parseDate(row[colReg ?? ""]);
      const daysSince = lastAuth ? daysBetween(lastAuth, today) : null;
      const balance = parseNumber(row[colBal ?? ""]);
      const bonusBalance = parseNumber(row[colBonusBal ?? ""]);

      let age: number | null = null;
      const ra = row[colAge ?? ""];
      if (ra) {
        const a = parseInt(String(ra));
        if (a > 5 && a < 100) age = a;
      }

      if (!guestMap.has(phone)) {
        guestMap.set(phone, {
          name: String(row[colName ?? ""] ?? "").trim(),
          phone,
          email: String(row[colEmail ?? ""] ?? "").trim(),
          gender: String(row[colGender ?? ""] ?? "").trim().toLowerCase(),
          group: String(row[colGroup ?? ""] ?? "").trim(),
          age,
          balance,
          bonusBalance,
          lastAuth,
          regDate,
          daysSince,
        });
      }
    }
  }

  // Determine overall dataset bounds and filtered report period
  const datasetDateFrom = rawReportDateFrom || rawMinDate;
  const datasetDateTo = rawReportDateTo || rawMaxDate;

  const reportDateFrom = dateFilter?.startDate || datasetDateFrom;
  const reportDateTo = dateFilter?.endDate || datasetDateTo;
  const reportDays = (reportDateFrom && reportDateTo) ? Math.max(1, daysBetween(reportDateFrom, reportDateTo)) : null;
  const datasetDays = (datasetDateFrom && datasetDateTo) ? Math.max(1, daysBetween(datasetDateFrom, datasetDateTo)) : null;

  // Combine into single unified array
  const profiles: ClientProfile[] = [];
  const allPhones = new Set([
    ...guestMap.keys(),
    ...txMap.keys(),
    ...summaryMap.keys(),
    ...clientPackageMap.keys(),
  ]);

  for (const phone of allPhones) {
    const g = guestMap.get(phone);
    const tx = txMap.get(phone);
    const sum = summaryMap.get(phone);
    const pack = clientPackageMap.get(phone);

    // Name priority
    let name = g?.name || sum?.name || tx?.name || "Гость";
    if (name === "Заполнить Обязательно" && sum?.name && sum.name !== "Заполнить Обязательно") {
      name = sum.name;
    }

    const email = g?.email || "";
    const gender = g?.gender || "";
    const age = g?.age ?? null;
    const group = g?.group || sum?.group || "Стандарт";

    // Balances
    const balance = g?.balance ?? 0;
    const bonusBalance = g?.bonusBalance ?? 0;

    // Dates
    const lastAuth = g?.lastAuth || sum?.lastVisit || null;
    const regDate = g?.regDate || sum?.regDate || null;
    const daysSince = lastAuth ? daysBetween(lastAuth, today) : null;

    // REAL MONEY TOTAL SPENT (исключаем бонусы!)
    let totalSpent = 0;
    if (packageRows.length > 0) {
      if (dateFilter) {
        totalSpent = pack ? pack.rub : 0;
      } else {
        totalSpent = sum ? (sum.topupAdmin + sum.topupLK + sum.topupApp) : (pack ? pack.rub : (tx ? tx.realSpent : 0));
      }
    } else if (sum && dateFilter && datasetDays && reportDays) {
      totalSpent = Math.round((sum.topupAdmin + sum.topupLK + sum.topupApp) * (reportDays / datasetDays));
    } else if (sum) {
      totalSpent = sum.topupAdmin + sum.topupLK + sum.topupApp;
    } else if (tx) {
      totalSpent = tx.realSpent;
    } else if (pack) {
      totalSpent = pack.rub;
    }

    // БОНУСЫ НАЧИСЛЕННЫЕ / ВЫДАННЫЕ КЛУБОМ
    let bonusAccrued = sum?.bonusTopup || tx?.bonusTopup || 0;
    if (dateFilter && datasetDays && reportDays && bonusAccrued > 0) {
      bonusAccrued = Math.round(bonusAccrued * (reportDays / datasetDays));
    }

    // БОНУСЫ СПИСАННЫЕ
    let bonusSpent = 0;
    if (packageRows.length > 0) {
      if (dateFilter) {
        bonusSpent = pack ? pack.bonus : 0;
      } else {
        bonusSpent = sum?.bonusSpent || pack?.bonus || 0;
      }
    } else if (sum && dateFilter && datasetDays && reportDays) {
      bonusSpent = Math.round(sum.bonusSpent * (reportDays / datasetDays));
    } else {
      bonusSpent = sum?.bonusSpent || pack?.bonus || 0;
    }

    const txCount = pack?.sessions || (sum && dateFilter && datasetDays && reportDays ? Math.max(1, Math.round(sum.visits * (reportDays / datasetDays))) : (sum?.visits || tx?.txCount || (totalSpent > 0 ? 1 : 0)));
    const avgTx = txCount > 0 ? Math.round(totalSpent / txCount) : 0;

    let status: ClientProfile["status"] = "unknown";
    if (daysSince !== null) {
      if (daysSince <= 14) status = "active";
      else if (daysSince <= 30) status = "cooling";
      else status = "churned";
    }

    // Payment preference
    let preferredPayment: ClientProfile["preferredPayment"] = undefined;
    if (sum) {
      const { topupAdmin, topupLK, topupApp } = sum;
      if (topupAdmin > topupLK && topupAdmin > topupApp) preferredPayment = "admin";
      else if (topupLK > topupAdmin && topupLK > topupApp) preferredPayment = "lk";
      else if (topupApp > topupAdmin && topupApp > topupLK) preferredPayment = "app";
      else if (topupAdmin + topupLK + topupApp > 0) preferredPayment = "mixed";
    }

    const playedMinutes = sum?.playedMinutes ?? undefined;
    // Keep 1 decimal place precision for hours to prevent rounding errors
    const playedHours = playedMinutes !== undefined
      ? (playedMinutes >= 6000 ? Math.round(playedMinutes / 60) : Math.round((playedMinutes / 60) * 10) / 10)
      : undefined;

    const visits = sum?.visits ?? pack?.sessions ?? undefined;
    const avgSessionMinutes = (playedMinutes && visits && visits > 0)
      ? Math.round(playedMinutes / visits)
      : undefined;

    // Hourly yield: calculated from exact minutes to prevent rounding distortion
    let hourlyYield: number | undefined = undefined;
    if (playedMinutes && playedMinutes >= 15) {
      hourlyYield = Math.round(totalSpent / (playedMinutes / 60));
    }

    // Процент выданных бонусов к реальным деньгам
    const bonusGivenRatio = totalSpent > 0
      ? Math.round((bonusAccrued / totalSpent) * 100)
      : (bonusAccrued > 0 ? 999 : 0);

    // Доля реальных денег от общей суммы пополнений (реальные + выданные бонусы)
    const totalAdditions = totalSpent + bonusAccrued;
    const cashShare = totalAdditions > 0 ? Math.round((totalSpent / totalAdditions) * 100) : 100;

    // Value Category:
    let valueCategory: ClientProfile["valueCategory"] = "standard";
    if (bonusAccrued >= 200 && (bonusGivenRatio >= 40 || totalSpent === 0)) {
      valueCategory = "bonus_heavy"; // ⚠️ Бонусоед (бонусов насыпали > 40% от его денег)
    } else if (bonusGivenRatio <= 10 && totalSpent >= 2000) {
      valueCategory = "diamond";     // 💎 Золотой (щедрость клуба <= 10%, высокий чек)
    } else if (bonusGivenRatio <= 25 && totalSpent >= 1000) {
      valueCategory = "loyal";       // ⚖️ Лояльный (бонусы до 25%)
    }

    const spentSessionsReal = sum
      ? Math.max(0, sum.spentSessions - sum.bonusSpent)
      : pack ? pack.rub : undefined;

    // Package & Zone intelligence
    let favoriteZone: string | undefined = undefined;
    let favoriteTariff: string | undefined = undefined;
    let favoriteSeat: string | undefined = undefined;
    let gamerPersona: ClientProfile["gamerPersona"] = undefined;

    if (pack) {
      let maxZCount = 0;
      for (const [z, cnt] of pack.zones.entries()) {
        if (cnt > maxZCount) {
          maxZCount = cnt;
          favoriteZone = z;
        }
      }

      let maxTCount = 0;
      for (const [t, data] of pack.tariffs.entries()) {
        if (data.count > maxTCount) {
          maxTCount = data.count;
          favoriteTariff = t;
        }
      }

      let maxSCount = 0;
      for (const [s, cnt] of pack.seats.entries()) {
        if (cnt > maxSCount) {
          maxSCount = cnt;
          favoriteSeat = s;
        }
      }

      if (pack.nightSessions >= 2 || (pack.sessions >= 3 && pack.nightSessions / pack.sessions >= 0.3)) {
        gamerPersona = "night_owl";
      } else if (favoriteZone === "PS Зона") {
        gamerPersona = "console";
      } else if (favoriteZone === "Буткемп ПРО" || favoriteZone === "Буткемп") {
        gamerPersona = "bootcamp";
      } else {
        gamerPersona = "regular";
      }
    }

    let preferredTime: ClientProfile["preferredTime"] = undefined;
    if (pack) {
      const ts = pack.timeSlots;
      const maxSlot = (Object.entries(ts) as [NonNullable<ClientProfile["preferredTime"]>, number][])
        .sort((a, b) => b[1] - a[1])[0];
      if (maxSlot && maxSlot[1] > 0) {
        preferredTime = maxSlot[0];
      }
    }
    if (!preferredTime && (gamerPersona === "night_owl" || favoriteTariff?.toLowerCase().includes("ночь"))) {
      preferredTime = "night";
    }
    if (!preferredTime && lastAuth && !isNaN(lastAuth.getTime())) {
      const h = lastAuth.getHours();
      if (h >= 22 || h < 6) preferredTime = "night";
      else if (h >= 6 && h < 12) preferredTime = "morning";
      else if (h >= 12 && h < 17) preferredTime = "day";
      else preferredTime = "evening";
    }

    profiles.push({
      name,
      phone,
      email,
      gender,
      age,
      group,
      balance,
      bonusBalance,
      bonusAccrued,
      bonusSpent,
      bonusGivenRatio,
      cashShare,
      hourlyYield,
      valueCategory,
      lastAuth,
      regDate,
      daysSince,
      totalSpent,
      txCount,
      avgTx,
      status,
      isWhale: false,

      visits,
      playedMinutes,
      playedHours,
      avgSessionMinutes,
      topupAdmin: sum?.topupAdmin,
      topupLK: sum?.topupLK,
      topupApp: sum?.topupApp,
      spentSessionsReal,
      spentShop: sum?.spentShop,
      preferredPayment,

      favoriteZone,
      favoriteTariff,
      favoriteSeat,
      packageCount: pack?.sessions,
      packageSpentRub: pack?.rub,
      packageSpentBonus: pack?.bonus,
      nightSessionsCount: pack?.nightSessions,
      gamerPersona,
      preferredTime,
    });
  }

  // Determine Whales (топ 10% платящих по реальным деньгам)
  const payers = profiles.filter((p) => p.totalSpent > 0).sort((a, b) => b.totalSpent - a.totalSpent);
  const whaleThreshold = payers.length > 10 ? payers[Math.floor(payers.length * 0.1)].totalSpent : 2500;
  payers.forEach((p) => {
    if (p.totalSpent >= Math.max(1500, whaleThreshold)) {
      p.isWhale = true;
    }
  });

  const activeCount = profiles.filter((p) => p.status === "active").length;
  const coolingCount = profiles.filter((p) => p.status === "cooling").length;
  const churnedCount = profiles.filter((p) => p.status === "churned").length;

  const abandonedBalance = profiles
    .filter((p) => p.status === "churned" && p.balance > 0)
    .reduce((sum, p) => sum + p.balance, 0);

  const abandonedBonus = profiles
    .filter((p) => p.status === "churned" && p.bonusBalance > 0)
    .reduce((sum, p) => sum + p.bonusBalance, 0);

  // ТОЛЬКО РЕАЛЬНЫЕ ДЕНЬГИ
  const totalRevenueInLog = profiles.reduce((sum, p) => sum + p.totalSpent, 0);
  // ВСЕГО ВЫДАНО БОНУСОВ КЛУБОМ
  const totalBonusAccrued = profiles.reduce((sum, p) => sum + p.bonusAccrued, 0);
  // ВСЕГО СПИСАНО БОНУСОВ
  const totalBonusSpent = profiles.reduce((sum, p) => sum + p.bonusSpent, 0);

  // ОБЩАЯ ДОЛЯ ВЫДАННЫХ БОНУСОВ:
  // 1. Относительно реальной кассы (сколько бонусов клуб дарит на каждые 100 рублей выручки):
  const overallBonusEmissionRate = totalRevenueInLog > 0
    ? Math.round((totalBonusAccrued / totalRevenueInLog) * 1000) / 10
    : 0;

  // 2. Доля бонусов во всех начисленных средствах (реальные + бонусы):
  const totalAllTopups = totalRevenueInLog + totalBonusAccrued;
  const overallBonusShareOfTotal = totalAllTopups > 0
    ? Math.round((totalBonusAccrued / totalAllTopups) * 1000) / 10
    : 0;

  // Summary aggregates (sum exact minutes first to prevent rounding drift)
  const hasSummaryReport = summaryRows.length > 0;
  let totalPlayedMinutes = 0;
  let totalVisits = 0;
  let totalAdminTopup = 0;
  let totalLKTopup = 0;
  let totalAppTopup = 0;
  let totalShopSpent = 0;

  if (hasSummaryReport) {
    for (const s of summaryMap.values()) {
      totalPlayedMinutes += s.playedMinutes;
      totalVisits += s.visits;
      totalAdminTopup += s.topupAdmin;
      totalLKTopup += s.topupLK;
      totalAppTopup += s.topupApp;
      totalShopSpent += s.spentShop;
    }
  }

  let totalHoursPlayed = 0;
  if (packageRows.length > 0 && totalPackageHours > 0) {
    totalHoursPlayed = totalPackageHours;
  } else if (totalPlayedMinutes > 0) {
    const rawHours = Math.round(totalPlayedMinutes / 60);
    totalHoursPlayed = (dateFilter && datasetDays && reportDays)
      ? Math.round(rawHours * (reportDays / datasetDays))
      : rawHours;
  }

  const avgHourlyYield = (totalHoursPlayed > 0 && totalRevenueInLog > 0)
    ? Math.round(totalRevenueInLog / totalHoursPlayed)
    : (totalPlayedMinutes > 0 && totalRevenueInLog > 0 ? Math.round(totalRevenueInLog / (totalPlayedMinutes / 60)) : 0);

  const whales = profiles
    .filter((p) => p.isWhale || p.totalSpent >= 2000)
    .sort((a, b) => b.totalSpent - a.totalSpent);

  const topChurned = profiles
    .filter((p) => p.status === "churned" && p.totalSpent > 0)
    .sort((a, b) => b.totalSpent - a.totalSpent);

  const atRisk = profiles
    .filter((p) => p.status === "cooling" && (p.totalSpent > 0 || p.balance > 100))
    .sort((a, b) => b.totalSpent - a.totalSpent);

  // Compute club zone stats
  const clubZoneStats: ClubZoneStat[] = Array.from(clubZoneMap.entries())
    .map(([zone, data]) => ({
      zone,
      sessions: data.sessions,
      rub: data.rub,
      bonus: data.bonus,
      percentOfRub: totalPackageRub > 0 ? Math.round((data.rub / totalPackageRub) * 1000) / 10 : 0,
      uniqueGuests: data.guests.size,
    }))
    .sort((a, b) => b.rub - a.rub);

  // Compute club tariff stats
  const clubTariffStats: ClubTariffStat[] = Array.from(clubTariffMap.values())
    .sort((a, b) => b.count - a.count);

  // Compute club PC stats & deviation from zone average
  const zoneTotalRub = new Map<string, number>();
  const zonePcCount = new Map<string, number>();
  for (const item of clubPcMap.values()) {
    zoneTotalRub.set(item.zone, (zoneTotalRub.get(item.zone) || 0) + item.rub);
    zonePcCount.set(item.zone, (zonePcCount.get(item.zone) || 0) + 1);
  }

  const clubPcStats: ClubPcStat[] = Array.from(clubPcMap.values())
    .map((item) => {
      const zTotal = zoneTotalRub.get(item.zone) || 0;
      const zCount = zonePcCount.get(item.zone) || 1;
      const zAvg = zTotal / zCount;
      const percentOfZoneAverage = zAvg > 0 ? Math.round((item.rub / zAvg) * 100) : 100;
      return {
        pc: item.pc,
        zone: item.zone,
        sessions: item.sessions,
        rub: item.rub,
        bonus: item.bonus,
        uniqueGuests: item.guests.size,
        percentOfZoneAverage,
      };
    })
    .sort((a, b) => b.rub - a.rub);

  return {
    profiles,
    clubPcStats,
    totalGuests: profiles.length,
    totalRevenueInLog,
    totalBonusAccrued,
    totalBonusSpent,
    overallBonusEmissionRate,
    overallBonusShareOfTotal,
    avgHourlyYield,

    activeCount,
    coolingCount,
    churnedCount,
    abandonedBalance,
    abandonedBonus,
    whales,
    topChurned,
    atRisk,

    hasSummaryReport,
    reportDateFrom,
    reportDateTo,
    reportDays,
    datasetDateFrom,
    datasetDateTo,

    totalPlayedMinutes,
    totalHoursPlayed,
    totalVisits,
    totalAdminTopup,
    totalLKTopup,
    totalAppTopup,
    totalShopSpent,

    hasPackagesReport: packageRows.length > 0,
    totalPackageSessions,
    totalPackageRub,
    totalPackageBonus,
    clubZoneStats,
    clubTariffStats,

    parsedAt: new Date(),
  };
}
