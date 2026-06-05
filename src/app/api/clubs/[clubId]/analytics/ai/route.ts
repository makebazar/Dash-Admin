import { NextResponse } from "next/server";
import { query } from "@/db";
import { requireModuleAccess } from "@/lib/club-api-access";
import { getCoordinatesFromAddress, getHistoricalWeather } from "@/lib/integrations/weather";
import { getDateCalendarStatus, prefetchHolidaysForYears } from "@/lib/integrations/holidays";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

interface ShiftRow {
  id: string;
  cash_income: string | number;
  card_income: string | number;
  expenses: string | number;
  report_data: any;
  shift_type: string;
  check_in: Date | string;
  employee_id?: string | number;
  employee_name?: string;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> }
) {
  try {
    const { clubId } = await params;
    const url = new URL(request.url);
    const queryCity = url.searchParams.get("city") || "";

    const parsedCustomRanges = (() => {
      try {
        const schoolParam = url.searchParams.get("schoolVacations") || "";
        const studentParam = url.searchParams.get("studentVacations") || "";
        const examParam = url.searchParams.get("examSessions") || "";

        const parseRangeStr = (str: string) => {
          if (!str) return [];
          return str.split(",").map(range => {
            const [start, end] = range.split("_");
            return { start, end };
          }).filter(r => r.start && r.end);
        };

        return {
          schoolVacations: parseRangeStr(schoolParam),
          studentVacations: parseRangeStr(studentParam),
          examSessions: parseRangeStr(examParam),
        };
      } catch (e) {
        console.warn("Failed to parse custom academic ranges:", e);
        return undefined;
      }
    })();

    const parsedCityHolidays = (() => {
      try {
        const holidaysParam = url.searchParams.get("cityHolidays") || "";
        if (!holidaysParam) return [];
        return holidaysParam.split(",").map(h => {
          const [date, name] = h.split("_");
          return { date, name };
        }).filter(h => h.date && h.name);
      } catch (e) {
        console.warn("Failed to parse city holidays:", e);
        return [];
      }
    })();

    // 1. Authorization check
    await requireModuleAccess(clubId, "shifts", "view");

    // 2. Fetch club settings
    const clubResult = await query(
      `SELECT name, address, timezone FROM clubs WHERE id = $1`,
      [clubId]
    );

    if (clubResult.rowCount === 0) {
      return NextResponse.json({ error: "Club not found" }, { status: 404 });
    }

    const club = clubResult.rows[0];
    
    // Use user-provided city if present, otherwise parse from club address
    const targetAddress = queryCity.trim() || club.address;
    const { lat, lon } = getCoordinatesFromAddress(targetAddress);

    // 3. Define date range: last 90 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 90);

    const startDateStr = startDate.toISOString().slice(0, 10);
    const endDateStr = endDate.toISOString().slice(0, 10);

    // 4. Fetch real weather data from Open-Meteo
    const weatherMap = await getHistoricalWeather(lat, lon, startDateStr, endDateStr);

    // Prefetch official Russian calendar from isdayoff.ru (with dynamic holiday transfers)
    await prefetchHolidaysForYears([startDate.getFullYear(), endDate.getFullYear()]);

    // 5. Query shifts database (with employee details joined)
    const shiftsSql = `
      SELECT 
        s.id, 
        s.cash_income, 
        s.card_income, 
        s.expenses, 
        s.report_data, 
        COALESCE(s.shift_type, 'DAY') as shift_type, 
        s.check_in,
        s.user_id as employee_id,
        u.full_name as employee_name
      FROM shifts s
      LEFT JOIN shift_reports sr ON s.shift_report_id = sr.id
      LEFT JOIN users u ON s.user_id = u.id
      WHERE COALESCE(s.club_id, sr.club_id) = $1 
        AND s.status NOT IN ('ACTIVE', 'CANCELLED') 
        AND s.check_in >= $2::timestamp 
        AND s.check_in < $3::timestamp
      ORDER BY s.check_in ASC;
    `;

    const shiftsResult = await query(shiftsSql, [
      clubId,
      startDate.toISOString(),
      new Date(endDate.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    ]);

    const shiftRows = shiftsResult.rows as ShiftRow[];
    const hasData = shiftRows.length > 0;

    // Fetch evaluations for service quality score
    const evaluationsResult = await query(
      `SELECT 
        employee_id,
        AVG(CASE WHEN max_score > 0 THEN (total_score::float / max_score) * 100 ELSE 0 END) as avg_score,
        COUNT(id) as evaluations_count
      FROM evaluations
      WHERE club_id = $1
      GROUP BY employee_id`,
      [clubId]
    );

    // Fetch equipment maintenance tasks completed
    const maintenanceResult = await query(
      `SELECT 
        mt.completed_by as employee_id,
        COUNT(mt.id) as completed_tasks_count,
        SUM(COALESCE(mt.bonus_earned, 0)) as total_bonuses_earned
      FROM equipment_maintenance_tasks mt
      JOIN equipment e ON mt.equipment_id = e.id
      WHERE e.club_id = $1 AND mt.status = 'COMPLETED'
      GROUP BY mt.completed_by`,
      [clubId]
    );

    const evaluationsMap = new Map(evaluationsResult.rows.map((r: any) => [String(r.employee_id), {
      avgScore: Math.round(Number(r.avg_score)),
      count: Number(r.evaluations_count)
    }]));

    const maintenanceMap = new Map(maintenanceResult.rows.map((r: any) => [String(r.employee_id), {
      completedCount: Number(r.completed_tasks_count),
      bonusesEarned: Math.round(Number(r.total_bonuses_earned))
    }]));

    // Fetch active report template for the club to parse metrics
    const templateRes = await query(
      `SELECT schema FROM club_report_templates 
       WHERE club_id = $1 AND is_active = TRUE 
       ORDER BY created_at DESC LIMIT 1`,
      [clubId]
    );
    let schema = templateRes.rows[0]?.schema;
    if (!schema) {
      const anyTemplateRes = await query(
        `SELECT schema FROM club_report_templates 
         WHERE club_id = $1 
         ORDER BY created_at DESC LIMIT 1`,
        [clubId]
      );
      schema = anyTemplateRes.rows[0]?.schema;
    }
    const fields = Array.isArray(schema) ? schema : (schema?.fields || []);
    const metricCategories: Record<string, string> = {};
    fields.forEach((f: any) => {
      const key = f.metric_key || f.key;
      if (!key) return;
      let category = f.field_type || f.calculation_category;
      if (!category) {
        if (key.includes("income") || key.includes("revenue") || key === "cash" || key === "card") {
          category = "INCOME";
        } else if (key.includes("expense") || key === "expenses") {
          category = "EXPENSE";
        } else {
          category = "OTHER";
        }
      }
      metricCategories[key] = category;
    });

    const clubTimezone = club.timezone || "Europe/Moscow";
    const localDateFormatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: clubTimezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    let consolidatedData = [];
    let isSynthetic = false;
    let employeePerformanceSummary: any[] = [];
    let overallAvgDaily = 42000;
    let overallAvgBar = 12000;

    // Aggregate DB records
    if (shiftRows.length > 0) {
      const dailyDataMap: Record<string, any> = {};
      const employeeStatsMap: Record<string, {
        id: string;
        name: string;
        shiftsCount: number;
        totalRevenue: number;
        barRevenue: number;
        pcRevenue: number;
        nightShiftsCount: number;
        weekendRevenue: number;
        weekendShiftsCount: number;
        weekdayRevenue: number;
        weekdayShiftsCount: number;
        rainyRevenue: number;
        rainyShiftsCount: number;
        dryRevenue: number;
        dryShiftsCount: number;
      }> = {};

      shiftRows.forEach((row) => {
        const checkInDate = row.check_in instanceof Date ? row.check_in : new Date(row.check_in);
        // Format checkInDate to the local date string in club's timezone
        const dateStr = localDateFormatter.format(checkInDate);
        
        const calStatus = getDateCalendarStatus(checkInDate, parsedCustomRanges, parsedCityHolidays);
        const weather = weatherMap[dateStr] || { tempMean: 15.0, precipitation: 0.0 };

        // 1. Calculate total income using template metric categories
        let totalShiftIncome = 0;
        if (metricCategories["cash_income"] === "INCOME" || !metricCategories["cash_income"]) {
          totalShiftIncome += Number(row.cash_income) || 0;
        }
        if (metricCategories["card_income"] === "INCOME" || !metricCategories["card_income"]) {
          totalShiftIncome += Number(row.card_income) || 0;
        }

        const reportData = typeof row.report_data === "string" ? JSON.parse(row.report_data || "{}") : row.report_data || {};
        if (reportData && typeof reportData === "object") {
          Object.keys(reportData).forEach((key) => {
            if (key === "cash_income" || key === "card_income") return;
            if (metricCategories[key] === "INCOME") {
              totalShiftIncome += Number(reportData[key]) || 0;
            }
          });
        }

        // 2. Bar Revenue is a custom field in report_data (e.g. 'Bar' or 'bar_revenue'), categorized as 'OTHER' ("Другое")
        let barRev = 0;
        if (reportData && typeof reportData === "object") {
          const rawBarVal = reportData.bar_revenue !== undefined ? reportData.bar_revenue : reportData.Bar;
          if (rawBarVal !== undefined) {
            barRev = Number(rawBarVal) || 0;
          } else {
            // Fallback: search for any key containing "bar"
            Object.entries(reportData).forEach(([key, value]) => {
              if (key.toLowerCase().includes("bar") && !["cash_income", "card_income", "total_revenue"].includes(key)) {
                barRev += Number(value) || 0;
              }
            });
          }
        }

        // 3. PC zone revenue is the remainder: Total collected - Bar sales
        const pcRev = Math.max(0, totalShiftIncome - barRev);
        const expenses = Number(row.expenses) || 0;

        // 4. Employee Stats
        const empName = row.employee_name || "Неизвестный сотрудник";
        const empId = row.employee_id ? String(row.employee_id) : "";
        if (!employeeStatsMap[empName]) {
          employeeStatsMap[empName] = {
            id: empId,
            name: empName,
            shiftsCount: 0,
            totalRevenue: 0,
            barRevenue: 0,
            pcRevenue: 0,
            nightShiftsCount: 0,
            weekendRevenue: 0,
            weekendShiftsCount: 0,
            weekdayRevenue: 0,
            weekdayShiftsCount: 0,
            rainyRevenue: 0,
            rainyShiftsCount: 0,
            dryRevenue: 0,
            dryShiftsCount: 0
          };
        }
        const emp = employeeStatsMap[empName];
        emp.shiftsCount++;
        emp.totalRevenue += totalShiftIncome;
        emp.barRevenue += barRev;
        emp.pcRevenue += pcRev;
        if (row.shift_type === "NIGHT") emp.nightShiftsCount++;

        const isSp = calStatus.isWeekend || calStatus.isHoliday;
        if (isSp) {
          emp.weekendShiftsCount++;
          emp.weekendRevenue += totalShiftIncome;
        } else {
          emp.weekdayShiftsCount++;
          emp.weekdayRevenue += totalShiftIncome;
        }

        if (weather.precipitation > 0) {
          emp.rainyShiftsCount++;
          emp.rainyRevenue += totalShiftIncome;
        } else {
          emp.dryShiftsCount++;
          emp.dryRevenue += totalShiftIncome;
        }

        if (!dailyDataMap[dateStr]) {
          dailyDataMap[dateStr] = {
            date: dateStr,
            weekday: checkInDate.toLocaleDateString("en-US", { weekday: "long" }),
            isWeekend: calStatus.isWeekend,
            isHoliday: calStatus.isHoliday,
            holidayName: calStatus.holidayName || null,
            isHolidayEve: calStatus.isHolidayEve,
            isSchoolHoliday: calStatus.isSchoolHoliday,
            isStudentHoliday: calStatus.isStudentHoliday,
            isExamSession: calStatus.isExamSession,
            academicLabel: calStatus.academicLabel,
            revenuePc: 0,
            revenueBar: 0,
            expenses: 0,
            tempAvg: weather.tempMean,
            precipitation: weather.precipitation,
            dayShiftsCount: 0,
            nightShiftsCount: 0,
          };
        }

        const daily = dailyDataMap[dateStr];
        daily.revenuePc += pcRev;
        daily.revenueBar += barRev;
        daily.expenses += expenses;
        if (row.shift_type === "NIGHT") daily.nightShiftsCount++;
        else daily.dayShiftsCount++;
      });

      consolidatedData = Object.values(dailyDataMap);

      // Compute overall averages to calculate relative KPI ratios
      const overallTotalRevenue = consolidatedData.reduce((acc, d) => acc + d.revenuePc + d.revenueBar, 0);
      const overallTotalBarSales = consolidatedData.reduce((acc, d) => acc + d.revenueBar, 0);
      overallAvgDaily = consolidatedData.length > 0 ? Math.round(overallTotalRevenue / consolidatedData.length) : 42000;
      overallAvgBar = consolidatedData.length > 0 ? Math.round(overallTotalBarSales / consolidatedData.length) : 12000;

      employeePerformanceSummary = Object.values(employeeStatsMap).map(emp => {
        const avgRev = Math.round(emp.totalRevenue / emp.shiftsCount);
        const avgBar = Math.round(emp.barRevenue / emp.shiftsCount);
        const evalData = evaluationsMap.get(emp.id) || { avgScore: 95, count: 0 };
        const mainData = maintenanceMap.get(emp.id) || { completedCount: 0, bonusesEarned: 0 };
        
        return {
          id: emp.id,
          name: emp.name,
          totalShifts: emp.shiftsCount,
          nightShifts: emp.nightShiftsCount,
          avgRevenue: avgRev,
          avgBarSales: avgBar,
          avgPcSales: Math.round(emp.pcRevenue / emp.shiftsCount),
          avgWeekendRevenue: emp.weekendShiftsCount > 0 ? Math.round(emp.weekendRevenue / emp.weekendShiftsCount) : avgRev,
          avgWeekdayRevenue: emp.weekdayShiftsCount > 0 ? Math.round(emp.weekdayRevenue / emp.weekdayShiftsCount) : avgRev,
          avgRainyRevenue: emp.rainyShiftsCount > 0 ? Math.round(emp.rainyRevenue / emp.rainyShiftsCount) : avgRev,
          avgDryRevenue: emp.dryShiftsCount > 0 ? Math.round(emp.dryRevenue / emp.dryShiftsCount) : avgRev,
          barKpiRatio: Math.round((avgBar / (overallAvgBar || 1)) * 100),
          revenueKpiRatio: Math.round((avgRev / (overallAvgDaily || 1)) * 100),
          avgServiceScore: evalData.avgScore,
          evaluationsCount: evalData.count,
          completedTasksCount: mainData.completedCount,
          totalBonusesEarned: mainData.bonusesEarned,
        };
      });
    }

    // 6. Dynamic Fallback: If DB has no shifts, generate synthetic data matching this math
    if (consolidatedData.length === 0) {
      isSynthetic = true;
      const now = new Date();
      for (let i = 90; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dateStr = d.toISOString().slice(0, 10);
        const dayOfWeek = d.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        
        const calStatus = getDateCalendarStatus(d, parsedCustomRanges, parsedCityHolidays);
        const weather = weatherMap[dateStr] || { tempMean: 15.0, precipitation: 0.0 };

        // Generate PC and Bar revenues based on weather/holidays
        let pcRevenue = 24000;
        let barRevenue = 12000;

        if (isWeekend) {
          pcRevenue *= 1.45;
          barRevenue *= 1.35;
        } else if (calStatus.isHoliday) {
          pcRevenue *= 1.5;
          barRevenue *= 1.4;
        }

        if (weather.precipitation > 1.0) {
          pcRevenue *= 1.22; // rain boost
        }
        if (weather.tempMean > 22.0) {
          pcRevenue *= 0.82; // heat drop-off
          barRevenue *= 1.28; // cold drinks boost
        }

        // Academic schedule adjustment
        if (calStatus.isSchoolHoliday || calStatus.isStudentHoliday) {
          pcRevenue *= 1.35;
          barRevenue *= 1.30;
        } else if (calStatus.isExamSession) {
          pcRevenue *= 0.88;
          barRevenue *= 0.92;
        }

        // Add 10% realistic variance/noise
        pcRevenue = Math.round(pcRevenue * (0.9 + Math.random() * 0.2));
        barRevenue = Math.round(barRevenue * (0.95 + Math.random() * 0.1));

        consolidatedData.push({
          date: dateStr,
          weekday: d.toLocaleDateString("en-US", { weekday: "long" }),
          isWeekend,
          isHoliday: calStatus.isHoliday,
          holidayName: calStatus.holidayName || null,
          isHolidayEve: calStatus.isHolidayEve,
          isSchoolHoliday: calStatus.isSchoolHoliday,
          isStudentHoliday: calStatus.isStudentHoliday,
          isExamSession: calStatus.isExamSession,
          academicLabel: calStatus.academicLabel,
          revenuePc: pcRevenue,
          revenueBar: barRevenue,
          expenses: Math.round(1500 + Math.random() * 1000),
          tempAvg: weather.tempMean,
          precipitation: weather.precipitation,
          dayShiftsCount: 1,
          nightShiftsCount: isWeekend ? 1 : 0,
        });
      }
    }

    // 7. Check OpenRouter API key
    const apiKey = process.env.OPENROUTER_API_KEY;

    // --- MATHEMATICAL STATISTICAL CALCULATIONS ---
    // 1. Weather groups
    const hotDays = consolidatedData.filter(d => d.tempAvg > 20);
    const coldDays = consolidatedData.filter(d => d.tempAvg <= 20);
    const rainyDays = consolidatedData.filter(d => d.precipitation > 0);
    const dryDays = consolidatedData.filter(d => d.precipitation === 0);

    const calcAvg = (arr: any[], key1: string, key2?: string) => {
      if (arr.length === 0) return 0;
      const sum = arr.reduce((acc, d) => acc + (Number(d[key1]) || 0) + (key2 ? (Number(d[key2]) || 0) : 0), 0);
      return Math.round(sum / arr.length);
    };

    const avgPcHot = calcAvg(hotDays, "revenuePc");
    const avgPcCold = calcAvg(coldDays, "revenuePc");
    const avgBarHot = calcAvg(hotDays, "revenueBar");
    const avgBarCold = calcAvg(coldDays, "revenueBar");

    const avgPcRainy = calcAvg(rainyDays, "revenuePc");
    const avgPcDry = calcAvg(dryDays, "revenuePc");
    const avgBarRainy = calcAvg(rainyDays, "revenueBar");
    const avgBarDry = calcAvg(dryDays, "revenueBar");

    // Deltas
    const pcTempDelta = avgPcCold > 0 ? Math.round(((avgPcHot - avgPcCold) / avgPcCold) * 100) : -18;
    const barTempDelta = avgBarCold > 0 ? Math.round(((avgBarHot - avgBarCold) / avgBarCold) * 100) : 25;
    const pcRainDelta = avgPcDry > 0 ? Math.round(((avgPcRainy - avgPcDry) / avgPcDry) * 100) : 22;
    const barRainDelta = avgBarDry > 0 ? Math.round(((avgBarRainy - avgBarDry) / avgBarDry) * 100) : 10;

    // 2. Calendar groups
    const weekendDays = consolidatedData.filter(d => d.isWeekend && !d.isHoliday);
    const holidayDays = consolidatedData.filter(d => d.isHoliday);
    const weekdayDays = consolidatedData.filter(d => !d.isWeekend && !d.isHoliday);
    const academicVacationDays = consolidatedData.filter(d => d.isSchoolHoliday || d.isStudentHoliday);
    const examDays = consolidatedData.filter(d => d.isExamSession);

    const avgTotalWeekend = calcAvg(weekendDays, "revenuePc", "revenueBar");
    const avgTotalHoliday = calcAvg(holidayDays, "revenuePc", "revenueBar");
    const avgTotalWeekday = calcAvg(weekdayDays, "revenuePc", "revenueBar");
    const avgTotalVacation = calcAvg(academicVacationDays, "revenuePc", "revenueBar");
    const avgTotalSession = calcAvg(examDays, "revenuePc", "revenueBar");

    const weekendDelta = avgTotalWeekday > 0 ? Math.round(((avgTotalWeekend - avgTotalWeekday) / avgTotalWeekday) * 100) : 35;
    const holidayDelta = avgTotalWeekday > 0 ? Math.round(((avgTotalHoliday - avgTotalWeekday) / avgTotalWeekday) * 100) : 50;
    const vacationDelta = avgTotalWeekday > 0 ? Math.round(((avgTotalVacation - avgTotalWeekday) / avgTotalWeekday) * 100) : 30;
    const sessionDelta = avgTotalWeekday > 0 ? Math.round(((avgTotalSession - avgTotalWeekday) / avgTotalWeekday) * 100) : -12;

    const syntheticEmployeeSummary = [
      {
        name: "Иван",
        totalShifts: 28,
        nightShifts: 4,
        avgRevenue: 27041,
        avgBarSales: 2890,
        avgPcSales: 24151,
        avgWeekendRevenue: 34500,
        avgWeekdayRevenue: 24100,
        avgRainyRevenue: 31000,
        avgDryRevenue: 25400,
        barKpiRatio: 115,
        revenueKpiRatio: 108,
        avgServiceScore: 98,
        evaluationsCount: 12,
        completedTasksCount: 14,
        totalBonusesEarned: 1400
      },
      {
        name: "Влад",
        totalShifts: 25,
        nightShifts: 18,
        avgRevenue: 18857,
        avgBarSales: 2430,
        avgPcSales: 16427,
        avgWeekendRevenue: 23100,
        avgWeekdayRevenue: 17400,
        avgRainyRevenue: 21500,
        avgDryRevenue: 18100,
        barKpiRatio: 97,
        revenueKpiRatio: 92,
        avgServiceScore: 94,
        evaluationsCount: 10,
        completedTasksCount: 8,
        totalBonusesEarned: 800
      },
      {
        name: "Валерия",
        totalShifts: 22,
        nightShifts: 12,
        avgRevenue: 26270,
        avgBarSales: 2090,
        avgPcSales: 24180,
        avgWeekendRevenue: 31800,
        avgWeekdayRevenue: 22600,
        avgRainyRevenue: 29100,
        avgDryRevenue: 24900,
        barKpiRatio: 88,
        revenueKpiRatio: 105,
        avgServiceScore: 96,
        evaluationsCount: 15,
        completedTasksCount: 11,
        totalBonusesEarned: 1100
      }
    ];

    if (!apiKey) {
      console.warn("OPENROUTER_API_KEY is not defined. Returning mock analysis.");
      const mockResult = generateMockAiAnalysis(consolidatedData, targetAddress, isSynthetic);
      return NextResponse.json(mockResult);
    }

    // 8. OpenRouter Request
    const systemPrompt = `You are a professional business analyst for computer/gaming clubs.
You are given a 90-day daily aggregated dataset of revenues, weather conditions, holiday calendars, and academic schedules (school/university holidays, exam sessions) for the city "${targetAddress}".
You are ALSO given a summarized dataset of club employee performance: shifts worked, average total revenue, average bar sales, and average PC sales per shift, PLUS quality of service metrics (avgServiceScore out of 100 based on checklists, evaluationsCount, and completedTasksCount of cleaning/operational tasks).

Analyze these figures and return a strict, valid JSON object in Russian.

CRITICAL RULES:
- Be extremely CONCISE and PUNCHY.
- DO NOT generate long paragraphs of text.
- Insights and recommendations must be a MAXIMUM of 1 or 2 short sentences. Focus on numbers and direct facts.
- Explicitly correlate revenue peaks/dips with school/university vacations (isSchoolHoliday, isStudentHoliday) and exam periods (isExamSession) to find business opportunities.
- Analyze the performance of specific employees (who worked shifts) and generate 1 custom tactical insight per key employee. Highlight who sells the most in the bar, who generates the highest shift total revenue, AND who performs best in service quality/diligence (cleanliness, checklists, tasks completed).
- Suggest a custom staffing recommendation or superpower tag (e.g. "Мастер чистоты", "Лидер бара", "Дисциплинированный админ") based on their balance of sales vs operational checklist performance.
- Do NOT output any markdown, code blocks, or conversational text. Return ONLY the JSON object.

Strict JSON Response Schema:
{
  "weatherCorrelation": {
    "tempImpactText": "Краткое влияние жары (1-2 коротких предложения).",
    "pcTempDeltaPercent": -15, // percent drop in PC play in hot weather
    "barTempDeltaPercent": 25,  // percent change in bar sales in hot weather
    "rainImpactText": "Краткое влияние дождей (1-2 коротких предложения).",
    "rainRevenueMultiplier": 1.22
  },
  "holidayCorrelation": {
    "holidayBoostText": "Краткое сравнение будней, выходных и влияния каникул/учебы (1-2 коротких предложения).",
    "weekendVsWeekdayDeltaPercent": 35,
    "holidayEvePerformanceText": "Краткий вывод по предпраздничным ночам и периодам экзаменов (1-2 предложения)."
  },
  "employeeInsights": [
    {
      "employeeName": "Иван",
      "insightTitle": "Лидер чистоты и продаж",
      "insightText": "Иван имеет наивысший средний чек бара (2 890 ₽ за смену) и безупречный рейтинг чистоты 98% по чек-листам (выполнил 14 хоз. задач).",
      "superpower": "Лидер чистоты"
    }
  ],
  "recommendations": [
    {
      "priority": "high" | "medium" | "low",
      "action": "Конкретное короткое действие (5-8 слов)",
      "benefit": "В чем выгода действия (1 короткое предложение)."
    }
  ]
}`;

    const userPrompt = `Here is the consolidated daily dataset of club shifts:
${JSON.stringify(consolidatedData, null, 2)}

Here are the calculated general weather and holiday correlation metrics:
- Overall Club Average Daily Revenue: ${overallAvgDaily} ₽
- Overall Club Average Daily Bar Sales: ${overallAvgBar} ₽
- Average PC Revenue (Hot >20°C): ${avgPcHot} ₽ vs (Cold <=20°C): ${avgPcCold} ₽ (Delta: ${pcTempDelta}%)
- Average Bar Revenue (Hot >20°C): ${avgBarHot} ₽ vs (Cold <=20°C): ${avgBarCold} ₽ (Delta: ${barTempDelta}%)
- Average PC Revenue (Rainy): ${avgPcRainy} ₽ vs (Dry): ${avgPcDry} ₽ (Delta: ${pcRainDelta}%)
- Average Bar Revenue (Rainy): ${avgBarRainy} ₽ vs (Dry): ${avgBarDry} ₽ (Delta: ${barRainDelta}%)
- Average Total Revenue (Weekend): ${avgTotalWeekend} ₽ vs (Weekday): ${avgTotalWeekday} ₽ (Delta: ${weekendDelta}%)
- Average Total Revenue (Holidays): ${avgTotalHoliday} ₽ vs (Weekday): ${avgTotalWeekday} ₽ (Delta: ${holidayDelta}%)
- Average Total Revenue (Academic Vacations): ${avgTotalVacation} ₽ vs (Weekday): ${avgTotalWeekday} ₽ (Delta: ${vacationDelta}%)
- Average Total Revenue (Exam Sessions): ${avgTotalSession} ₽ vs (Weekday): ${avgTotalWeekday} ₽ (Delta: ${sessionDelta}%)

Here is the deep aggregated performance summary of club employees:
${JSON.stringify(hasData ? employeePerformanceSummary : syntheticEmployeeSummary, null, 2)}

Please perform the correlation analysis and return the strict JSON schema matching the instructions.
Your response MUST quote the exact Ruble numbers and percentage deltas from above. DO NOT HALLUCINATE OR CHANGE THE NUMBERS.
For EACH employee, write a detailed, highly specific analysis in "insightText" (3-4 sentences long) that includes:
1. Their total shifts, average revenue, average bar sales, and service score / host tasks completed.
2. A comparison of their performance in specific conditions (weekend vs weekday revenue, rainy vs dry revenue), citing the exact Rubles.
3. Their key strength (sales vs cleanliness/checklist diligence) and custom staffing fit recommendation based on their metrics.`;

    const openRouterResponse = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.DASHADMIN_SERVER_URL || "https://mydashadmin.ru",
        "X-Title": "DashAdmin AI Analytics",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!openRouterResponse.ok) {
      const errText = await openRouterResponse.text();
      throw new Error(`OpenRouter API failed with status ${openRouterResponse.status}: ${errText}`);
    }

    const aiData = await openRouterResponse.json();
    const contentText = aiData.choices?.[0]?.message?.content;

    if (!contentText) {
      throw new Error("AI returned an empty response");
    }

    const parsedResult = JSON.parse(contentText);
    
    // Merge database employee metrics with AI employee insights
    const employeesData = hasData ? employeePerformanceSummary : syntheticEmployeeSummary;
    const mergedEmployeeInsights = employeesData.map((stats: any) => {
      const insight = parsedResult.employeeInsights?.find((i: any) => i.employeeName?.toLowerCase() === stats.name?.toLowerCase());
      return {
        employeeName: stats.name,
        insightTitle: insight?.insightTitle || "Стабильные показатели смен",
        insightText: insight?.insightText || `${stats.name} демонстрирует стабильные показатели выручки и качественное обслуживание клиентов.`,
        superpower: insight?.superpower || (stats.avgBarSales > 2500 ? "Мастер бара" : "Надежный админ"),
        totalShifts: stats.totalShifts || 0,
        nightShifts: stats.nightShifts || 0,
        avgRevenue: stats.avgRevenue || 0,
        avgBarSales: stats.avgBarSales || 0,
        avgPcSales: stats.avgPcSales || 0,
        avgWeekendRevenue: stats.avgWeekendRevenue || 0,
        avgWeekdayRevenue: stats.avgWeekdayRevenue || 0,
        avgRainyRevenue: stats.avgRainyRevenue || 0,
        avgDryRevenue: stats.avgDryRevenue || 0,
        barKpiRatio: stats.barKpiRatio || 0,
        revenueKpiRatio: stats.revenueKpiRatio || 0,
        avgServiceScore: stats.avgServiceScore || 0,
        evaluationsCount: stats.evaluationsCount || 0,
        completedTasksCount: stats.completedTasksCount || 0,
        totalBonusesEarned: stats.totalBonusesEarned || 0,
      };
    });
    parsedResult.employeeInsights = mergedEmployeeInsights;

    // Add metadata for frontend indicators
    parsedResult.isSynthetic = isSynthetic;
    parsedResult.cityAnalyzed = targetAddress;
    parsedResult.consolidatedData = consolidatedData;

    return NextResponse.json(parsedResult);

  } catch (error: any) {
    console.error("Historical AI route error:", error);
    return NextResponse.json(
      { error: "Failed to compile AI insights", message: error.message },
      { status: 500 }
    );
  }
}

function generateMockAiAnalysis(consolidated: any[], city: string, isSynthetic: boolean) {
  const hasData = consolidated.length > 0;
  const totalPc = consolidated.reduce((sum, d) => sum + d.revenuePc, 0);
  const totalBar = consolidated.reduce((sum, d) => sum + d.revenueBar, 0);
  const avgDaily = hasData ? (totalPc + totalBar) / consolidated.length : 45000;

  const weekendDays = consolidated.filter(d => d.isWeekend);
  const weekdays = consolidated.filter(d => !d.isWeekend);
  const avgWeekend = weekendDays.length > 0 
    ? weekendDays.reduce((sum, d) => sum + d.revenuePc + d.revenueBar, 0) / weekendDays.length
    : avgDaily * 1.35;
  const avgWeekday = weekdays.length > 0
    ? weekdays.reduce((sum, d) => sum + d.revenuePc + d.revenueBar, 0) / weekdays.length
    : avgDaily * 0.85;

  const weekendDelta = Math.round(((avgWeekend - avgWeekday) / (avgWeekday || 1)) * 100);

  return {
    isMock: true,
    isSynthetic,
    cityAnalyzed: city,
    consolidatedData: consolidated,
    weatherCorrelation: {
      tempImpactText: `При температуре выше +22°C в г. ${city} выручка ПК-зоны снижается на 18%. Однако продажи прохладительных напитков возрастают на 25%.`,
      pcTempDeltaPercent: -18,
      barTempDeltaPercent: 25,
      rainImpactText: `Осадки выступают сильным катализатором. Дождливая погода поднимает посещаемость и выручку ПК на 22%.`,
      rainRevenueMultiplier: 1.22
    },
    holidayCorrelation: {
      holidayBoostText: `Выходные приносят на ${weekendDelta}% больше выручки. Периоды школьных каникул дают стабильный дневной прирост до 35%.`,
      weekendVsWeekdayDeltaPercent: weekendDelta,
      holidayEvePerformanceText: `Предпраздничные смены показывают выручку на 40% выше. В период студенческих сессий в июне наблюдается спад активности в будни.`
    },
    employeeInsights: [
      {
        employeeName: "Иван",
        insightTitle: "Лидер чистоты и продаж",
        insightText: "Иван отработал 28 смен со средней выручкой 27,041 ₽ (+14% к средней по клубу) и безупречным рейтингом сервиса 98% по чек-листам (закрыл 14 хозяйственных задач). Он является абсолютным лидером по продажам бара, собирая в среднем 2,890 ₽ за смену. В выходные его средняя выручка возрастает до 34,500 ₽, а в дождливые дни составляет 31,000 ₽. Рекомендуется ставить на пиковые смены.",
        superpower: "Лидер чистоты",
        totalShifts: 28,
        nightShifts: 4,
        avgRevenue: 27041,
        avgBarSales: 2890,
        avgPcSales: 24151,
        avgWeekendRevenue: 34500,
        avgWeekdayRevenue: 24100,
        avgRainyRevenue: 31000,
        avgDryRevenue: 25400,
        barKpiRatio: 115,
        revenueKpiRatio: 108,
        avgServiceScore: 98,
        evaluationsCount: 12,
        completedTasksCount: 14,
        totalBonusesEarned: 1400
      },
      {
        employeeName: "Влад",
        insightTitle: "Король ночных смен",
        insightText: "Влад работает преимущественно ночью (18 из 25 смен), удерживая стабильный уровень обслуживания (94% по чек-листам) и закрывая операционные задачи. Его средняя выручка составляет 18,857 ₽ за смену, увеличиваясь в дождливые дни до 21,500 ₽. Лучший кандидат для ночного дежурства.",
        superpower: "Мастер ночи",
        totalShifts: 25,
        nightShifts: 18,
        avgRevenue: 18857,
        avgBarSales: 2430,
        avgPcSales: 16427,
        avgWeekendRevenue: 23100,
        avgWeekdayRevenue: 17400,
        avgRainyRevenue: 21500,
        avgDryRevenue: 18100,
        barKpiRatio: 97,
        revenueKpiRatio: 92,
        avgServiceScore: 94,
        evaluationsCount: 10,
        completedTasksCount: 8,
        totalBonusesEarned: 800
      },
      {
        employeeName: "Валерия",
        insightTitle: "Мастер дневного потока",
        insightText: "Валерия обеспечивает максимальную дневную загрузку и идеальный порядок на смене (96% по чек-листам, выполнено 11 задач). Ее средний чек на ПК возрастает на 28% на выходных до 31,800 ₽. В дождливую погоду ее средняя выручка составляет 29,100 ₽. Идеально подходит для дневного потока.",
        superpower: "Дисциплинированный админ",
        totalShifts: 22,
        nightShifts: 12,
        avgRevenue: 26270,
        avgBarSales: 2090,
        avgPcSales: 24180,
        avgWeekendRevenue: 31800,
        avgWeekdayRevenue: 22600,
        avgRainyRevenue: 29100,
        avgDryRevenue: 24900,
        barKpiRatio: 88,
        revenueKpiRatio: 105,
        avgServiceScore: 96,
        evaluationsCount: 15,
        completedTasksCount: 11,
        totalBonusesEarned: 1100
      }
    ],
    recommendations: [
      {
        priority: "high",
        action: "Реклама прохладных VIP-залов",
        benefit: "Нивелирует 18% летний спад в жаркие дни."
      },
      {
        priority: "high",
        action: "Скидки 30% на пакеты 'Закрыл сессию!'",
        benefit: "Привлечет студентов в клуб сразу после окончания сессии в конце июня."
      },
      {
        priority: "high",
        action: "Увеличенный закуп напитков в жару",
        benefit: "Обеспечит покрытие возросшего на 25% спроса на баре."
      },
      {
        priority: "medium",
        action: "Акция 'Ура, Каникулы!' на дневные пакеты",
        benefit: "Увеличит дневную загрузку игровых ПК в период школьных каникул."
      },
      {
        priority: "medium",
        action: "Усиление смен перед праздниками",
        benefit: "Поможет качественно обслужить пиковый поток гостей."
      }
    ]
  };
}
