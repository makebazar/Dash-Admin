/**
 * Russian public holidays (fixed annual dates based on Labor Code Art. 112)
 * Format: MM-DD
 */
const FIXED_RU_HOLIDAYS = new Set([
  "01-01", "01-02", "01-03", "01-04", "01-05", "01-06", "01-07", "01-08", // New Year / Christmas
  "02-23", // Defender of the Fatherland Day
  "03-08", // International Women's Day
  "05-01", // Spring and Labor Day
  "05-09", // Victory Day
  "06-12", // Russia Day
  "11-04", // Unity Day
]);

/**
 * Russian public holidays names mapping
 */
const RU_HOLIDAY_NAMES: Record<string, string> = {
  "01-01": "Новый год",
  "01-02": "Новогодние каникулы",
  "01-03": "Новогодние каникулы",
  "01-04": "Новогодние каникулы",
  "01-05": "Новогодние каникулы",
  "01-06": "Новогодние каникулы",
  "01-07": "Рождество Христово",
  "01-08": "Новогодние каникулы",
  "02-23": "День защитника Отечества",
  "03-08": "Международный женский день",
  "05-01": "Праздник Весны и Труда",
  "05-09": "День Победы",
  "06-12": "День России",
  "11-04": "День народного единства",
};

/**
 * Russian holiday eves (fixed annual dates where the night shift acts like a Friday/weekend night)
 * MM-DD
 */
const FIXED_RU_HOLIDAY_EVES = new Set([
  "12-31", // Eve of New Year
  "02-22", // Eve of Feb 23
  "03-07", // Eve of Mar 8
  "04-30", // Eve of May 1
  "05-08", // Eve of May 9
  "06-11", // Eve of June 12
  "11-03", // Eve of Nov 4
]);

// Memory cache for isdayoff.ru API data
// key: YYYYMMDD, value: '0' (working), '1' (day off), '2' (shortened)
const isDayOffCache: Record<string, string> = {};
const prefetchedYears = new Set<number>();

/**
 * Prefetches the calendar data for given years from isdayoff.ru with a 2-second timeout
 */
export async function prefetchHolidaysForYears(years: number[]) {
  for (const year of years) {
    if (prefetchedYears.has(year)) continue;
    try {
      const res = await fetch(`https://isdayoff.ru/api/getdata?year=${year}`, {
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        const data = await res.text();
        if (data.length >= 365) {
          // Parse all days of the year
          let currentDate = new Date(year, 0, 1);
          for (let i = 0; i < data.length; i++) {
            const yyyymmdd = currentDate.toISOString().slice(0, 10).replace(/-/g, "");
            isDayOffCache[yyyymmdd] = data[i];
            currentDate.setDate(currentDate.getDate() + 1);
          }
          prefetchedYears.add(year);
          console.log(`✅ Prefetched official Russian calendar for year ${year} from isdayoff.ru`);
        }
      }
    } catch (err) {
      console.warn(`⚠️ isdayoff.ru prefetch failed for ${year} (using offline fallback):`, (err as Error).message);
    }
  }
}

export interface CustomAcademicRanges {
  schoolVacations?: Array<{ start: string; end: string }>;
  studentVacations?: Array<{ start: string; end: string }>;
  examSessions?: Array<{ start: string; end: string }>;
}

export interface DateCalendarStatus {
  isWeekend: boolean;
  isHoliday: boolean;
  isHolidayEve: boolean;
  isSchoolHoliday: boolean;
  isStudentHoliday: boolean;
  isExamSession: boolean;
  label: string;
  academicLabel: string;
  holidayName: string | null;
}

function isDateInRange(d: Date, ranges: Array<{ start: string; end: string }> | undefined): boolean {
  if (!ranges || !Array.isArray(ranges)) return false;
  // Normalize date to midnight UTC/local
  const targetTime = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return ranges.some(r => {
    const sParts = r.start.split("-").map(Number);
    const eParts = r.end.split("-").map(Number);
    if (sParts.length !== 3 || eParts.length !== 3) return false;
    const sTime = new Date(sParts[0], sParts[1] - 1, sParts[2]).getTime();
    const eTime = new Date(eParts[0], eParts[1] - 1, eParts[2]).getTime();
    return targetTime >= sTime && targetTime <= eTime;
  });
}

/**
 * Resolves the calendar status of a given date (weekend, holiday, eve, normal weekday)
 * and checks academic status (school/student holidays, exams)
 */
export function getDateCalendarStatus(
  dateInput: Date | string,
  customRanges?: CustomAcademicRanges,
  cityHolidays?: Array<{ date: string; name: string }>
): DateCalendarStatus {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  
  const year = date.getFullYear();
  const monthNum = date.getMonth(); // 0-indexed
  const dayNum = date.getDate();
  
  // Format date as MM-DD (zero-padded)
  const monthStr = String(monthNum + 1).padStart(2, "0");
  const dayStr = String(dayNum).padStart(2, "0");
  const mmDd = `${monthStr}-${dayStr}`;

  // Check cache for dynamic official calendar (isdayoff.ru)
  const yyyymmdd = `${year}${monthStr}${dayStr}`;
  const cachedStatus = isDayOffCache[yyyymmdd];

  const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
  let isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  let isHoliday = FIXED_RU_HOLIDAYS.has(mmDd);
  let isHolidayEve = FIXED_RU_HOLIDAY_EVES.has(mmDd);

  // Apply dynamic transfers from isdayoff.ru if cached
  if (cachedStatus !== undefined) {
    if (cachedStatus === "1") {
      // Dynamic day off (either weekend or transferred holiday)
      isWeekend = true;
      if (FIXED_RU_HOLIDAYS.has(mmDd) || dayOfWeek !== 0 && dayOfWeek !== 6) {
        isHoliday = true;
      }
    } else if (cachedStatus === "0") {
      // Dynamic working day (even if it's Saturday/Sunday!)
      isWeekend = false;
      isHoliday = false;
    } else if (cachedStatus === "2") {
      // Dynamic shortened day (holiday eve!)
      isHolidayEve = true;
    }
  }

  // Check city/municipal custom holidays
  const yyyyMmDdHyphen = `${year}-${monthStr}-${dayStr}`;
  const matchedCityHoliday = cityHolidays?.find(h => h.date === yyyyMmDdHyphen);
  
  if (matchedCityHoliday) {
    isWeekend = true;
    isHoliday = true;
  }

  let holidayName: string | null = null;
  if (matchedCityHoliday) {
    holidayName = matchedCityHoliday.name;
  } else if (isHoliday) {
    holidayName = RU_HOLIDAY_NAMES[mmDd] || "Государственный выходной";
  }

  // Academic schedule (school/university holidays and sessions)
  let isSchoolHoliday = false;
  let isStudentHoliday = false;
  let isExamSession = false;
  let academicLabel = "Учебное время";

  // Check custom overrides first
  const hasCustomSchool = customRanges?.schoolVacations && customRanges.schoolVacations.length > 0;
  const hasCustomStudent = customRanges?.studentVacations && customRanges.studentVacations.length > 0;
  const hasCustomExam = customRanges?.examSessions && customRanges.examSessions.length > 0;

  if (hasCustomSchool || hasCustomStudent || hasCustomExam) {
    if (hasCustomSchool && isDateInRange(date, customRanges.schoolVacations)) {
      isSchoolHoliday = true;
      academicLabel = "Школьные каникулы (свои)";
    }
    if (hasCustomStudent && isDateInRange(date, customRanges.studentVacations)) {
      isStudentHoliday = true;
      academicLabel = "Студенческие каникулы (свои)";
    }
    if (hasCustomExam && isDateInRange(date, customRanges.examSessions)) {
      isExamSession = true;
      academicLabel = "Экзаменационная сессия (свои)";
    }
  } else {
    // Fallback to baseline default calendar
    // 1. Summer holidays (Jun 1 - Aug 31)
    if (monthNum >= 5 && monthNum <= 7) {
      isSchoolHoliday = true;
      academicLabel = "Летние каникулы (школа)";
      if (monthNum >= 6) { // Jul 1 - Aug 31
        isStudentHoliday = true;
        academicLabel = "Летние каникулы (школа и ВУЗ)";
      }
    }

    // 2. Spring school holidays (late March: e.g. Mar 22 - Mar 30)
    else if (monthNum === 2 && dayNum >= 22 && dayNum <= 30) {
      isSchoolHoliday = true;
      academicLabel = "Весенние школьные каникулы";
    }

    // 3. Autumn school holidays (late October - early November: e.g. Oct 26 - Nov 3)
    else if ((monthNum === 9 && dayNum >= 26) || (monthNum === 10 && dayNum <= 3)) {
      isSchoolHoliday = true;
      academicLabel = "Осенние школьные каникулы";
    }

    // 4. Winter school & student holidays
    else if ((monthNum === 11 && dayNum >= 29) || (monthNum === 0 && dayNum <= 8)) {
      isSchoolHoliday = true;
      academicLabel = "Новогодние каникулы (школа)";
    }
    else if ((monthNum === 0 && dayNum >= 25) || (monthNum === 1 && dayNum <= 7)) {
      isStudentHoliday = true;
      academicLabel = "Зимние студенческие каникулы";
    }

    // 5. Exam Sessions (winter: Jan 5 - Jan 24, summer: May 25 - Jun 25)
    else if (monthNum === 0 && dayNum >= 5 && dayNum <= 24) {
      isExamSession = true;
      academicLabel = "Зимняя сессия (ВУЗы)";
    }
    else if ((monthNum === 4 && dayNum >= 25) || (monthNum === 5 && dayNum <= 25)) {
      isExamSession = true;
      academicLabel = "Летняя сессия и ОГЭ/ЕГЭ";
    }
  }

  let label = "Будний день";
  if (isHoliday) {
    label = holidayName || "Государственный праздник";
  } else if (isHolidayEve) {
    label = "Предпраздничный день";
  } else if (isWeekend) {
    label = dayOfWeek === 6 ? "Суббота" : "Воскресенье";
  }

  return {
    isWeekend,
    isHoliday,
    isHolidayEve,
    isSchoolHoliday,
    isStudentHoliday,
    isExamSession,
    label,
    academicLabel,
    holidayName,
  };
}

