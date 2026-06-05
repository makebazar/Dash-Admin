"use client";

import { useEffect, useState, useMemo } from "react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { 
  Loader2, 
  TrendingUp, 
  Sun, 
  CloudRain, 
  Calendar, 
  Zap, 
  Check, 
  RefreshCw,
  LineChart,
  BarChart4,
  MapPin,
  Sparkles,
  Info,
  Users,
  Award,
  Settings,
  Plus,
  Trash2,
  Clock,
  ArrowUpRight,
  Activity
} from "lucide-react";
import {
  ComposedChart,
  Line,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceArea
} from "recharts";

interface AnalyticsClientProps {
  clubId: string;
}

interface CustomRange {
  start: string;
  end: string;
}

export default function AnalyticsClient({ clubId }: AnalyticsClientProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [aiResult, setAiResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Active shifts state
  const [activeShifts, setActiveShifts] = useState<any[]>([]);
  const [isActiveShiftsLoading, setIsActiveShiftsLoading] = useState(false);

  // City test selector states
  const [cityInput, setCityInput] = useState("Москва");
  const [activeCity, setActiveCity] = useState("Москва");

  // Tab state
  const [activeTab, setActiveTab] = useState<"finance" | "weather" | "academic">("finance");

  // Chart configuration states
  const [showWeatherOverlay, setShowWeatherOverlay] = useState(true);
  const [showHolidaysOverlay, setShowHolidaysOverlay] = useState(true);
  const [revenueType, setRevenueType] = useState<"total" | "split">("split");

  // Settings drawer & state for Custom Academic Calendar
  const [showSettings, setShowSettings] = useState(false);
  
  // Custom Ranges loaded from LocalStorage
  const [schoolVacations, setSchoolVacations] = useState<CustomRange[]>([]);
  const [studentVacations, setStudentVacations] = useState<CustomRange[]>([]);
  const [examSessions, setExamSessions] = useState<CustomRange[]>([]);
  
  // Custom City Holidays loaded from LocalStorage
  const [cityHolidays, setCityHolidays] = useState<Array<{ date: string; name: string }>>([]);

  // Expanded employee details row in leaderboard
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);

  // Form input temporary states
  const [newSchoolStart, setNewSchoolStart] = useState("");
  const [newSchoolEnd, setNewSchoolEnd] = useState("");
  const [newStudentStart, setNewStudentStart] = useState("");
  const [newStudentEnd, setNewStudentEnd] = useState("");
  const [newExamStart, setNewExamStart] = useState("");
  const [newExamEnd, setNewExamEnd] = useState("");
  
  const [newCityHolidayDate, setNewCityHolidayDate] = useState("");
  const [newCityHolidayName, setNewCityHolidayName] = useState("");

  // Recommendation execution state
  const [completedRecs, setCompletedRecs] = useState<Record<number, boolean>>({});

  // Quick suggestions for cities
  const citySuggestions = ["Москва", "Самара", "Казань", "Новосибирск"];

  // Initialize Custom Ranges from LocalStorage (Client-only)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedSchool = localStorage.getItem(`academic_school_${clubId}`);
      const savedStudent = localStorage.getItem(`academic_student_${clubId}`);
      const savedExam = localStorage.getItem(`academic_exam_${clubId}`);
      const savedCityHolidays = localStorage.getItem(`academic_city_holidays_${clubId}`);

      if (savedSchool) setSchoolVacations(JSON.parse(savedSchool));
      if (savedStudent) setStudentVacations(JSON.parse(savedStudent));
      if (savedExam) setExamSessions(JSON.parse(savedExam));
      if (savedCityHolidays) setCityHolidays(JSON.parse(savedCityHolidays));
    }
  }, [clubId]);

  const fetchAiAnalytics = async (
    cityToQuery = activeCity, 
    isForce = false,
    overrides?: { school?: CustomRange[]; student?: CustomRange[]; exam?: CustomRange[]; cityHolidays?: Array<{ date: string; name: string }> }
  ) => {
    if (isForce) setIsRefreshing(true);
    else setIsLoading(true);
    
    setError(null);
    try {
      let url = `/api/clubs/${clubId}/analytics/ai?city=${encodeURIComponent(cityToQuery)}`;
      
      // Determine ranges to send
      const sRanges = overrides?.school !== undefined ? overrides.school : schoolVacations;
      const stRanges = overrides?.student !== undefined ? overrides.student : studentVacations;
      const exRanges = overrides?.exam !== undefined ? overrides.exam : examSessions;
      const cHols = overrides?.cityHolidays !== undefined ? overrides.cityHolidays : cityHolidays;

      const schoolVal = sRanges.map(r => `${r.start}_${r.end}`).join(",");
      const studentVal = stRanges.map(r => `${r.start}_${r.end}`).join(",");
      const examVal = exRanges.map(r => `${r.start}_${r.end}`).join(",");
      const cityHolsVal = cHols.map(h => `${h.date}_${h.name}`).join(",");

      if (schoolVal) url += `&schoolVacations=${encodeURIComponent(schoolVal)}`;
      if (studentVal) url += `&studentVacations=${encodeURIComponent(studentVal)}`;
      if (examVal) url += `&examSessions=${encodeURIComponent(examVal)}`;
      if (cityHolsVal) url += `&cityHolidays=${encodeURIComponent(cityHolsVal)}`;

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error("Не удалось загрузить данные AI-аналитики");
      }
      const result = await res.json();
      
      if (result.error) {
        setError(result.message || result.error);
        return;
      }

      const dailyData = result.consolidatedData || [];
      const chartData = dailyData.map((d: any) => ({
        ...d,
        totalRevenue: d.revenuePc + d.revenueBar,
        formattedDate: formatDate(d.date),
      }));

      setData(chartData);
      setAiResult(result);
      if (result.cityAnalyzed) {
        setCityInput(result.cityAnalyzed);
        setActiveCity(result.cityAnalyzed);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Произошла непредвиденная ошибка");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const fetchActiveShifts = async () => {
    setIsActiveShiftsLoading(true);
    try {
      const res = await fetch(`/api/clubs/${clubId}/active-shifts`);
      if (res.ok) {
        const result = await res.json();
        setActiveShifts(result.shifts || []);
      }
    } catch (err) {
      console.error("Failed to fetch active shifts:", err);
    } finally {
      setIsActiveShiftsLoading(false);
    }
  };

  // Run initial queries
  useEffect(() => {
    // Delayed query to ensure LocalStorage states are loaded
    const timer = setTimeout(() => {
      fetchAiAnalytics(activeCity, false);
      fetchActiveShifts();
    }, 50);
    return () => clearTimeout(timer);
  }, [clubId]);

  const handleCityAnalyzeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cityInput.trim()) return;
    setActiveCity(cityInput.trim());
    fetchAiAnalytics(cityInput.trim(), false);
  };

  const handleQuickCityClick = (city: string) => {
    setCityInput(city);
    setActiveCity(city);
    fetchAiAnalytics(city, false);
  };

  // Custom Settings range modifiers
  const addSchoolRange = () => {
    if (!newSchoolStart || !newSchoolEnd) return;
    const updated = [...schoolVacations, { start: newSchoolStart, end: newSchoolEnd }];
    setSchoolVacations(updated);
    localStorage.setItem(`academic_school_${clubId}`, JSON.stringify(updated));
    setNewSchoolStart("");
    setNewSchoolEnd("");
    fetchAiAnalytics(activeCity, false, { school: updated });
  };

  const removeSchoolRange = (idx: number) => {
    const updated = schoolVacations.filter((_, i) => i !== idx);
    setSchoolVacations(updated);
    localStorage.setItem(`academic_school_${clubId}`, JSON.stringify(updated));
    fetchAiAnalytics(activeCity, false, { school: updated });
  };

  const addStudentRange = () => {
    if (!newStudentStart || !newStudentEnd) return;
    const updated = [...studentVacations, { start: newStudentStart, end: newStudentEnd }];
    setStudentVacations(updated);
    localStorage.setItem(`academic_student_${clubId}`, JSON.stringify(updated));
    setNewStudentStart("");
    setNewStudentEnd("");
    fetchAiAnalytics(activeCity, false, { student: updated });
  };

  const removeStudentRange = (idx: number) => {
    const updated = studentVacations.filter((_, i) => i !== idx);
    setStudentVacations(updated);
    localStorage.setItem(`academic_student_${clubId}`, JSON.stringify(updated));
    fetchAiAnalytics(activeCity, false, { student: updated });
  };

  const addExamRange = () => {
    if (!newExamStart || !newExamEnd) return;
    const updated = [...examSessions, { start: newExamStart, end: newExamEnd }];
    setExamSessions(updated);
    localStorage.setItem(`academic_exam_${clubId}`, JSON.stringify(updated));
    setNewExamStart("");
    setNewExamEnd("");
    fetchAiAnalytics(activeCity, false, { exam: updated });
  };

  const removeExamRange = (idx: number) => {
    const updated = examSessions.filter((_, i) => i !== idx);
    setExamSessions(updated);
    localStorage.setItem(`academic_exam_${clubId}`, JSON.stringify(updated));
    fetchAiAnalytics(activeCity, false, { exam: updated });
  };

  const addCityHoliday = () => {
    if (!newCityHolidayDate || !newCityHolidayName.trim()) return;
    const updated = [...cityHolidays, { date: newCityHolidayDate, name: newCityHolidayName.trim() }];
    setCityHolidays(updated);
    localStorage.setItem(`academic_city_holidays_${clubId}`, JSON.stringify(updated));
    setNewCityHolidayDate("");
    setNewCityHolidayName("");
    fetchAiAnalytics(activeCity, false, { cityHolidays: updated });
  };

  const removeCityHoliday = (idx: number) => {
    const updated = cityHolidays.filter((_, i) => i !== idx);
    setCityHolidays(updated);
    localStorage.setItem(`academic_city_holidays_${clubId}`, JSON.stringify(updated));
    fetchAiAnalytics(activeCity, false, { cityHolidays: updated });
  };

  const resetToDefaultAcademic = () => {
    setSchoolVacations([]);
    setStudentVacations([]);
    setExamSessions([]);
    setCityHolidays([]);
    localStorage.removeItem(`academic_school_${clubId}`);
    localStorage.removeItem(`academic_student_${clubId}`);
    localStorage.removeItem(`academic_exam_${clubId}`);
    localStorage.removeItem(`academic_city_holidays_${clubId}`);
    fetchAiAnalytics(activeCity, false, { school: [], student: [], exam: [], cityHolidays: [] });
  };

  // Helper date formatter
  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
  };

  // Helper currency formatter
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
      maximumFractionDigits: 0,
    }).format(val);
  };

  // 1. Max Revenue
  const maxRevenue = useMemo(() => {
    if (data.length === 0) return 1;
    return Math.max(...data.map(d => d.totalRevenue));
  }, [data]);

  // 2. Group 90 days into monthly calendar grids
  const calendarMonths = useMemo(() => {
    if (data.length === 0) return [];
    
    const groups: Record<string, any[]> = {};
    data.forEach(d => {
      const monthKey = d.date.slice(0, 7); // "YYYY-MM"
      if (!groups[monthKey]) groups[monthKey] = [];
      groups[monthKey].push(d);
    });
    
    const sortedKeys = Object.keys(groups).sort();
    
    return sortedKeys.map(key => {
      const days = groups[key].sort((a, b) => a.date.localeCompare(b.date));
      const firstDayDate = new Date(days[0].date);
      let startDayOfWeek = firstDayDate.getDay(); // 0 = Sunday, 1 = Monday
      const offset = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1; 
      
      const monthName = firstDayDate.toLocaleDateString("ru-RU", { month: "long" });
      const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
      
      return {
        monthKey: key,
        monthName: capitalizedMonth,
        year: firstDayDate.getFullYear(),
        offset,
        days
      };
    });
  }, [data]);

  // 3. Peaks & Dips AI Digest data
  const peakDay = useMemo(() => {
    if (data.length === 0) return null;
    return data.reduce((max, d) => d.totalRevenue > max.totalRevenue ? d : max, data[0]);
  }, [data]);

  const dipDay = useMemo(() => {
    if (data.length === 0) return null;
    return data.reduce((min, d) => d.totalRevenue < min.totalRevenue ? d : min, data[0]);
  }, [data]);

  const weatherStats = useMemo(() => {
    if (data.length === 0) return { rainyAvg: 0, dryAvg: 0, pctChange: 0 };
    const rainy = data.filter(d => d.precipitation > 0);
    const dry = data.filter(d => d.precipitation === 0);
    const rainyAvg = rainy.length > 0 ? Math.round(rainy.reduce((sum, d) => sum + d.totalRevenue, 0) / rainy.length) : 0;
    const dryAvg = dry.length > 0 ? Math.round(dry.reduce((sum, d) => sum + d.totalRevenue, 0) / dry.length) : 0;
    const pctChange = dryAvg > 0 ? Math.round(((rainyAvg - dryAvg) / dryAvg) * 100) : 0;
    return { rainyAvg, dryAvg, pctChange };
  }, [data]);

  const calendarStats = useMemo(() => {
    if (data.length === 0) return { holidayAvg: 0, weekdayAvg: 0, pctChange: 0 };
    const holidays = data.filter(d => d.isHoliday);
    const weekdays = data.filter(d => !d.isWeekend && !d.isHoliday);
    const holidayAvg = holidays.length > 0 ? Math.round(holidays.reduce((sum, d) => sum + d.totalRevenue, 0) / holidays.length) : 0;
    const weekdayAvg = weekdays.length > 0 ? Math.round(weekdays.reduce((sum, d) => sum + d.totalRevenue, 0) / weekdays.length) : 0;
    const pctChange = weekdayAvg > 0 ? Math.round(((holidayAvg - weekdayAvg) / weekdayAvg) * 100) : 0;
    return { holidayAvg, weekdayAvg, pctChange };
  }, [data]);

  // Hover state for custom heatmap tooltip
  const [hoveredDay, setHoveredDay] = useState<any | null>(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const toggleRec = (idx: number) => {
    setCompletedRecs(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 text-slate-100">
      
      {/* 1. Header & Interactive City Testing bar */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 shadow-2xl relative overflow-hidden border border-indigo-500/20">
        <div className="absolute right-0 top-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2.5">
              <div className="bg-slate-900 p-2 rounded-xl text-white">
                <Sparkles className="h-5 w-5 text-white fill-current animate-pulse" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                ИИ-Анализатор факторов: Погода, Каникулы и Персонал
              </h2>
            </div>
            <p className="text-slate-500 text-xs font-medium leading-relaxed max-w-2xl">
              Система анализирует архив реальной погоды, школьные/студенческие каникулы, праздники и показатели администраторов за 90 дней, выявляя скрытые закономерности выручки вашего клуба.
            </p>
            
            {/* Suggestion Chips */}
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Примеры городов:</span>
              {citySuggestions.map((city) => (
                <button
                  key={city}
                  onClick={() => handleQuickCityClick(city)}
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all ${activeCity === city ? "bg-slate-900 border-slate-900 text-white shadow-sm" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"}`}
                >
                  {city}
                </button>
              ))}
            </div>
          </div>

          {/* City Form Input Box */}
          <div className="flex flex-col gap-2 w-full md:w-80 shrink-0">
            <form onSubmit={handleCityAnalyzeSubmit} className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="pl-3 text-slate-400 shrink-0">
                <MapPin className="h-4 w-4" />
              </div>
              <Input
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
                placeholder="Город (например, Самара)"
                className="bg-transparent border-0 text-slate-900 placeholder-slate-400 focus-visible:ring-0 focus-visible:ring-offset-0 text-xs font-bold h-9 w-full"
              />
              <Button type="submit" disabled={isLoading} className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl px-4 h-9 font-bold text-xs shrink-0 shadow-sm transition-all">
                Тест AI
              </Button>
            </form>
            
            <Button
              onClick={() => setShowSettings(!showSettings)}
              className={`w-full h-9 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all ${showSettings ? "bg-amber-600 border-amber-500 text-white shadow-sm" : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"}`}
            >
              <Settings className="h-3.5 w-3.5" />
              <span>⚙️ Локальный календарь</span>
            </Button>
          </div>
        </div>

        {/* Dynamic simulation warning badge */}
        {aiResult?.isSynthetic && (
          <div className="mt-4 pt-3 border-t border-slate-200 flex items-center gap-2 text-[11px] text-slate-500 font-medium bg-slate-50/50 p-2.5 rounded-xl border border-dashed border-slate-200">
            <Info className="h-4 w-4 text-slate-400 shrink-0" />
            <span>
              <strong>Режим демонстрации:</strong> В вашей базе данных нет смен за последние 90 дней. Система сгенерировала синтетические смены, наложив на них <strong>РЕАЛЬНУЮ архивную погоду</strong> в г. <strong>{activeCity}</strong> из Open-Meteo API.
            </span>
          </div>
        )}
      </div>

      {/* 2. Custom Academic Calendar overrides Settings block */}
      {showSettings && (
        <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50 flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Settings className="h-4 w-4 text-slate-500" />
                <span>Настройка локальных каникул, сессий и праздников</span>
              </CardTitle>
              <CardDescription className="text-[11px] text-slate-500">
                Задайте точные даты для вашего города, чтобы переопределить стандартные графики РФ
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={resetToDefaultAcademic}
              className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-[10px] font-bold h-8 rounded-lg"
            >
              Сбросить к умолчанию
            </Button>
          </CardHeader>
          <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-4 gap-6">
            
            {/* 1. School Vacations */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                <Calendar className="h-3.5 w-3.5 text-indigo-500" />
                <span>Школьные каникулы</span>
              </h4>
              <div className="flex gap-2 items-center">
                <Input type="date" value={newSchoolStart} onChange={(e) => setNewSchoolStart(e.target.value)} className="bg-white border-slate-200 text-[11px] text-slate-900 h-8" />
                <span className="text-slate-400 text-xs">—</span>
                <Input type="date" value={newSchoolEnd} onChange={(e) => setNewSchoolEnd(e.target.value)} className="bg-white border-slate-200 text-[11px] text-slate-900 h-8" />
                <Button size="icon" onClick={addSchoolRange} className="bg-slate-900 hover:bg-slate-800 h-8 w-8 shrink-0 rounded-lg">
                  <Plus className="h-4 w-4 text-white" />
                </Button>
              </div>
              <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1">
                {schoolVacations.map((range, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-slate-50 p-1.5 rounded-lg border border-slate-200 text-[10px] text-slate-700 font-bold">
                    <span>{formatDate(range.start)} — {formatDate(range.end)}</span>
                    <button onClick={() => removeSchoolRange(idx)} className="text-rose-600 hover:text-rose-500 p-0.5">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {schoolVacations.length === 0 && <span className="text-[10px] text-slate-400 italic block pt-1">Используются системные даты</span>}
              </div>
            </div>

            {/* 2. Student Vacations */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                <Users className="h-3.5 w-3.5 text-blue-500" />
                <span>Студенческие каникулы</span>
              </h4>
              <div className="flex gap-2 items-center">
                <Input type="date" value={newStudentStart} onChange={(e) => setNewStudentStart(e.target.value)} className="bg-white border-slate-200 text-[11px] text-slate-900 h-8" />
                <span className="text-slate-400 text-xs">—</span>
                <Input type="date" value={newStudentEnd} onChange={(e) => setNewStudentEnd(e.target.value)} className="bg-white border-slate-200 text-[11px] text-slate-900 h-8" />
                <Button size="icon" onClick={addStudentRange} className="bg-slate-900 hover:bg-slate-800 h-8 w-8 shrink-0 rounded-lg">
                  <Plus className="h-4 w-4 text-white" />
                </Button>
              </div>
              <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1">
                {studentVacations.map((range, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-slate-50 p-1.5 rounded-lg border border-slate-200 text-[10px] text-slate-700 font-bold">
                    <span>{formatDate(range.start)} — {formatDate(range.end)}</span>
                    <button onClick={() => removeStudentRange(idx)} className="text-rose-600 hover:text-rose-500 p-0.5">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {studentVacations.length === 0 && <span className="text-[10px] text-slate-400 italic block pt-1">Используются системные даты</span>}
              </div>
            </div>

            {/* 3. Exam Sessions */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                <Zap className="h-3.5 w-3.5 text-amber-500" />
                <span>Сессии / Экзамены</span>
              </h4>
              <div className="flex gap-2 items-center">
                <Input type="date" value={newExamStart} onChange={(e) => setNewExamStart(e.target.value)} className="bg-white border-slate-200 text-[11px] text-slate-900 h-8" />
                <span className="text-slate-400 text-xs">—</span>
                <Input type="date" value={newExamEnd} onChange={(e) => setNewExamEnd(e.target.value)} className="bg-white border-slate-200 text-[11px] text-slate-900 h-8" />
                <Button size="icon" onClick={addExamRange} className="bg-slate-900 hover:bg-slate-800 h-8 w-8 shrink-0 rounded-lg">
                  <Plus className="h-4 w-4 text-white" />
                </Button>
              </div>
              <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1">
                {examSessions.map((range, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-slate-50 p-1.5 rounded-lg border border-slate-200 text-[10px] text-slate-700 font-bold">
                    <span>{formatDate(range.start)} — {formatDate(range.end)}</span>
                    <button onClick={() => removeExamRange(idx)} className="text-rose-600 hover:text-rose-500 p-0.5">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {examSessions.length === 0 && <span className="text-[10px] text-slate-400 italic block pt-1">Используются системные даты</span>}
              </div>
            </div>

            {/* 4. Custom Regional/City Holidays */}
            <div className="space-y-3 border-l border-slate-100 pl-0 md:pl-4">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                <span>Городские праздники</span>
              </h4>
              <div className="space-y-2">
                <Input 
                  type="text" 
                  value={newCityHolidayName} 
                  onChange={(e) => setNewCityHolidayName(e.target.value)} 
                  placeholder="Название (например, День города)" 
                  className="bg-white border-slate-200 text-[11px] text-slate-900 h-8" 
                />
                <div className="flex gap-2 items-center">
                  <Input type="date" value={newCityHolidayDate} onChange={(e) => setNewCityHolidayDate(e.target.value)} className="bg-white border-slate-200 text-[11px] text-slate-900 h-8 w-full" />
                  <Button size="icon" onClick={addCityHoliday} className="bg-emerald-600 hover:bg-emerald-700 h-8 w-8 shrink-0 rounded-lg">
                    <Plus className="h-4 w-4 text-white" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1">
                {cityHolidays.map((holiday, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-slate-50 p-1.5 rounded-lg border border-slate-200 text-[10px] text-slate-700 font-bold gap-2">
                    <span className="truncate">{formatDate(holiday.date)} — {holiday.name}</span>
                    <button onClick={() => removeCityHoliday(idx)} className="text-rose-600 hover:text-rose-500 p-0.5 shrink-0">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {cityHolidays.length === 0 && <span className="text-[10px] text-slate-400 italic block pt-1">Нет городских праздников</span>}
              </div>
            </div>

          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex h-80 flex-col items-center justify-center gap-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <Loader2 className="h-10 w-10 animate-spin text-slate-900" />
          <p className="text-xs font-bold text-slate-500">ИИ анализирует смены клуба и архив погоды в г. {activeCity}...</p>
        </div>
      ) : (
        <>
          {/* 3. Панель ИИ-Дайджеста (Peaks & Dips Panel) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            
            {/* Card 1: Peak Day */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between shadow-sm relative overflow-hidden">
              <div className="space-y-1.5">
                <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md inline-block">🏆 Пиковый день</span>
                <p className="text-2xl font-bold text-slate-900 tracking-tight pt-1">
                  {peakDay ? formatCurrency(peakDay.totalRevenue) : "—"}
                </p>
              </div>
              <div className="text-xs text-slate-500 pt-3 border-t border-slate-100 mt-2 font-medium">
                {peakDay ? (
                  <span>
                    <strong>{formatDate(peakDay.date)}</strong> • ПК: {formatCurrency(peakDay.revenuePc)} / Бар: {formatCurrency(peakDay.revenueBar)}
                    {peakDay.holidayName && <strong className="text-rose-600 block mt-0.5">🎉 {peakDay.holidayName}</strong>}
                  </span>
                ) : "Нет данных"}
              </div>
            </div>

            {/* Card 2: Dip Day */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between shadow-sm relative overflow-hidden">
              <div className="space-y-1.5">
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md inline-block">⚠️ Минимальный день</span>
                <p className="text-2xl font-bold text-slate-900 tracking-tight pt-1">
                  {dipDay ? formatCurrency(dipDay.totalRevenue) : "—"}
                </p>
              </div>
              <div className="text-xs text-slate-500 pt-3 border-t border-slate-100 mt-2 font-medium">
                {dipDay ? (
                  <span>
                    <strong>{formatDate(dipDay.date)}</strong> • ПК: {formatCurrency(dipDay.revenuePc)} / Бар: {formatCurrency(dipDay.revenueBar)}
                    {dipDay.tempAvg > 22 && <strong className="text-amber-600 block mt-0.5">☀️ Жара {dipDay.tempAvg}°C снижает ПК</strong>}
                  </span>
                ) : "Нет данных"}
              </div>
            </div>

            {/* Card 3: Weather Stats */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between shadow-sm relative overflow-hidden">
              <div className="space-y-1.5">
                <span className="text-[9px] font-bold uppercase tracking-widest text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md inline-block">🌦️ Погодный баланс</span>
                <p className="text-2xl font-bold text-slate-900 tracking-tight pt-1">
                  {weatherStats.pctChange > 0 ? `+${weatherStats.pctChange}%` : `${weatherStats.pctChange}%`}
                </p>
              </div>
              <div className="text-xs text-slate-500 pt-3 border-t border-slate-100 mt-2 font-medium">
                <span>
                  В дождь: <strong>{formatCurrency(weatherStats.rainyAvg)}</strong><br />
                  В сухую погоду: <strong>{formatCurrency(weatherStats.dryAvg)}</strong>
                </span>
              </div>
            </div>

            {/* Card 4: Calendar Stats */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between shadow-sm relative overflow-hidden">
              <div className="space-y-1.5">
                <span className="text-[9px] font-bold uppercase tracking-widest text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md inline-block">📅 Календарный эффект</span>
                <p className="text-2xl font-bold text-slate-900 tracking-tight pt-1">
                  {calendarStats.pctChange > 0 ? `+${calendarStats.pctChange}%` : `${calendarStats.pctChange}%`}
                </p>
              </div>
              <div className="text-xs text-slate-500 pt-3 border-t border-slate-100 mt-2 font-medium">
                <span>
                  Выходные/Праздники: <strong>{formatCurrency(calendarStats.holidayAvg)}</strong><br />
                  Будни: <strong>{formatCurrency(calendarStats.weekdayAvg)}</strong>
                </span>
              </div>
            </div>

          </div>

          {/* 4. Calendar Revenue Activity Heatmap Block */}
          <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden relative">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-600" />
                  <span>Календарь суточной выручки клуба (90 дней)</span>
                </CardTitle>
                <CardDescription className="text-[10px] text-slate-500">
                  Визуальная сетка доходов клуба с наложением погоды, государственных и городских праздников. Наведите для деталей.
                </CardDescription>
              </div>
              
              <div className="flex items-center gap-4 text-[10px] font-semibold text-slate-500 flex-wrap">
                <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-slate-100 border border-slate-200" /><span>Обычный день</span></div>
                <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border border-rose-300 border-2 bg-emerald-100" /><span>Гос. праздник</span></div>
                <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border border-emerald-400 border-2 bg-emerald-200" /><span>Городской праздник</span></div>
              </div>
            </CardHeader>
            
            <CardContent className="pt-6 relative">
              {/* Map Container */}
              <div className="flex flex-col md:flex-row gap-8 justify-between overflow-x-auto pb-4">
                {calendarMonths.map((m: any) => (
                  <div key={m.monthKey} className="flex-1 min-w-[200px]">
                    {/* Month Title */}
                    <h4 className="text-xs font-bold text-slate-700 mb-3 border-b border-slate-100 pb-1 flex justify-between items-baseline">
                      <span>{m.monthName}</span>
                      <span className="text-[10px] text-slate-400 font-medium">{m.year}</span>
                    </h4>
                    
                    {/* Weekday header */}
                    <div className="grid grid-cols-7 gap-1.5 text-center text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                      <span>пн</span><span>вт</span><span>ср</span><span>чт</span><span>пт</span><span className="text-indigo-500">сб</span><span className="text-rose-500">вс</span>
                    </div>
                    
                    {/* Squares Grid */}
                    <div className="grid grid-cols-7 gap-1.5 relative">
                      {/* Offset empty divs */}
                      {Array.from({ length: m.offset }).map((_, idx) => (
                        <div key={`offset-${idx}`} className="w-8 h-8 rounded-md bg-transparent" />
                      ))}
                      
                      {/* Calendar Day square */}
                      {m.days.map((day: any) => {
                        const ratio = day.totalRevenue / (maxRevenue || 1);
                        let bgClass = "bg-slate-100 text-slate-800 border-slate-200";
                        if (day.totalRevenue > 0) {
                          if (ratio < 0.25) bgClass = "bg-emerald-50 text-emerald-800 border-emerald-100 hover:bg-emerald-100";
                          else if (ratio < 0.5) bgClass = "bg-emerald-100 text-emerald-950 border-emerald-200 hover:bg-emerald-200";
                          else if (ratio < 0.75) bgClass = "bg-emerald-200 text-emerald-950 border-emerald-300 hover:bg-emerald-300";
                          else bgClass = "bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-600";
                        }
                        
                        // Holidays border highlight
                        const isCityHoliday = day.holidayName && cityHolidays.some(h => h.date === day.date);
                        let borderStyle = "border";
                        if (isCityHoliday) {
                          borderStyle = "border-2 border-emerald-400 shadow-sm";
                        } else if (day.isHoliday) {
                          borderStyle = "border-2 border-rose-300 shadow-sm";
                        } else if (day.isWeekend) {
                          borderStyle = "border border-indigo-200";
                        }
                        
                        return (
                          <div
                            key={day.date}
                            onMouseEnter={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              const parentRect = e.currentTarget.parentElement?.parentElement?.parentElement?.getBoundingClientRect();
                              setHoveredDay(day);
                              setHoverPos({
                                x: rect.left - (parentRect?.left || 0) + 16,
                                y: rect.top - (parentRect?.top || 0) - 210
                              });
                            }}
                            onMouseLeave={() => setHoveredDay(null)}
                            className={`w-8 h-8 rounded-md ${bgClass} ${borderStyle} flex items-center justify-center text-[10px] font-bold transition-all duration-150 cursor-pointer relative hover:scale-105 hover:z-10`}
                          >
                            {day.date.slice(8)}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Heatmap Legend */}
              <div className="flex items-center justify-end gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest pt-4 border-t border-slate-100 mt-2">
                <span>Меньше</span>
                <span className="w-4 h-4 rounded bg-slate-100 border border-slate-200" />
                <span className="w-4 h-4 rounded bg-emerald-50 border border-emerald-100" />
                <span className="w-4 h-4 rounded bg-emerald-100 border border-emerald-200" />
                <span className="w-4 h-4 rounded bg-emerald-200 border border-emerald-300" />
                <span className="w-4 h-4 rounded bg-emerald-500" />
                <span>Больше</span>
              </div>
              
              {/* Floating Tooltip Component */}
              {hoveredDay && (
                <div 
                  className="absolute bg-slate-900 text-white rounded-xl shadow-xl border border-slate-800 p-4 w-72 z-30 pointer-events-none text-xs font-semibold space-y-2 transition-opacity duration-150"
                  style={{ 
                    left: `${hoverPos.x}px`, 
                    top: `${hoverPos.y}px`,
                  }}
                >
                  <div className="flex items-center justify-between gap-4 pb-1.5 border-b border-slate-800">
                    <span className="text-slate-400 font-bold">{hoveredDay.formattedDate}</span>
                    {hoveredDay.isHoliday && (
                      <span className="text-[8px] font-bold uppercase bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded-full border border-rose-500/30">
                        Праздник
                      </span>
                    )}
                  </div>
                  
                  {hoveredDay.holidayName && (
                    <div className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/10">
                      🎉 {hoveredDay.holidayName}
                    </div>
                  )}

                  {hoveredDay.academicLabel && hoveredDay.academicLabel !== "Учебное время" && (
                    <div className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/10">
                      🎓 {hoveredDay.academicLabel}
                    </div>
                  )}

                  <div className="space-y-1 pt-1.5">
                    <div className="flex justify-between gap-8 text-[11px]">
                      <span className="text-slate-400">Игровые ПК:</span>
                      <span className="text-slate-100 font-bold">{formatCurrency(hoveredDay.revenuePc)}</span>
                    </div>
                    <div className="flex justify-between gap-8 text-[11px]">
                      <span className="text-slate-400">Продажи Бара:</span>
                      <span className="text-emerald-400 font-bold">{formatCurrency(hoveredDay.revenueBar)}</span>
                    </div>
                    <div className="flex justify-between gap-8 font-bold text-sm border-t border-dashed border-slate-800 pt-1 text-slate-200">
                      <span>Итого выручка:</span>
                      <span className="text-emerald-400">{formatCurrency(hoveredDay.totalRevenue)}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-1 pt-1.5 border-t border-slate-800 text-[10px] text-slate-400 font-medium">
                    <div className="flex items-center gap-1.5">
                      <Sun className="h-3.5 w-3.5 text-amber-500" />
                      <span>Температура: <strong className="text-slate-200">{hoveredDay.tempAvg}°C</strong></span>
                    </div>
                    {hoveredDay.precipitation > 0 && (
                      <div className="flex items-center gap-1.5">
                        <CloudRain className="h-3.5 w-3.5 text-blue-400" />
                        <span>Осадки: <strong className="text-slate-200">{hoveredDay.precipitation} мм</strong></span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 5. GORGEOUS DEDICATED EMPLOYEE & STAFFING BLOCK */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Column 1 & 2: Active Employee shifts and leaderboard performance */}
            <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden md:col-span-2">
              <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Users className="h-4 w-4 text-slate-500" />
                    <span>Служба администраторов клуба</span>
                  </CardTitle>
                  <CardDescription className="text-[10px] text-slate-500">
                    Рейтинг эффективности сотрудников на базе выручки, оценок сервиса и чистоты
                  </CardDescription>
                </div>
                
                {/* Active shifts loading indicator */}
                <button onClick={fetchActiveShifts} className="text-slate-500 hover:text-slate-950 transition-colors">
                  <RefreshCw className={`h-4 w-4 ${isActiveShiftsLoading ? "animate-spin" : ""}`} />
                </button>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                
                {/* 1. Who is working now Sub-block */}
                <div className="space-y-2">
                  <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider block">На смене прямо сейчас</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {activeShifts.map((shift, idx) => (
                      <div key={idx} className="p-3.5 rounded-xl border border-emerald-100 bg-emerald-50/50 flex items-center justify-between gap-3 relative overflow-hidden">
                        <div className="flex items-center gap-3">
                          {/* Pulsing ring container */}
                          <div className="relative">
                            <div className="h-8 w-8 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center font-bold text-emerald-800 text-xs">
                              {shift.user_name?.charAt(0) || "А"}
                            </div>
                            <div className="absolute right-0 bottom-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border border-white animate-pulse" />
                          </div>
                          
                          <div className="space-y-0.5">
                            <span className="text-xs font-bold text-slate-900 block">{shift.user_name}</span>
                            <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100/50 px-2 py-0.2 rounded-full border border-emerald-100 inline-block">
                              {shift.role}
                            </span>
                          </div>
                        </div>
                        
                        <div className="text-right flex items-center gap-1.5 text-[10px] text-slate-500 font-bold bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm">
                          <Clock className="h-3.5 w-3.5 text-emerald-600" />
                          <span>{shift.total_hours} ч</span>
                        </div>
                      </div>
                    ))}
                    {activeShifts.length === 0 && (
                      <div className="col-span-2 p-3.5 rounded-xl border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center gap-2 text-slate-400 text-[10px] font-bold">
                        <Clock className="h-4 w-4" />
                        <span>В данный момент нет открытых активных смен</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Employee KPI Leaderboard Table */}
                <div className="space-y-2 pt-2">
                  <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider block">Таблица эффективности администраторов</span>
                  <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-sm">
                    <table className="w-full text-[11px] text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[9px] uppercase tracking-wider">
                          <th className="p-3 pl-4">Сотрудник</th>
                          <th className="p-3 text-center">Смен (Ночи)</th>
                          <th className="p-3 text-right">Выручка</th>
                          <th className="p-3 text-right text-emerald-700">Бар</th>
                          <th className="p-3 text-center">Качество сервиса</th>
                          <th className="p-3 text-center pr-4">Хоз. задачи</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                        {aiResult?.employeeInsights?.map((emp: any, idx: number) => {
                          const isExpanded = expandedEmployee === emp.employeeName;
                          
                          // Service Score colors
                          const score = emp.avgServiceScore || 95;
                          let scoreBadgeColor = "bg-emerald-50 text-emerald-800 border-emerald-100";
                          if (score < 90) scoreBadgeColor = "bg-rose-50 text-rose-800 border-rose-100";
                          else if (score < 95) scoreBadgeColor = "bg-amber-50 text-amber-800 border-amber-100";

                          return (
                            <>
                              <tr 
                                key={idx} 
                                className="hover:bg-slate-50/50 transition-all cursor-pointer border-b border-slate-100"
                                onClick={() => setExpandedEmployee(isExpanded ? null : emp.employeeName)}
                              >
                                <td className="p-3 pl-4">
                                  <div className="space-y-0.5">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-slate-900 block font-bold">{emp.employeeName}</span>
                                      <span className="text-[8px] text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100">
                                        {isExpanded ? "Скрыть ▲" : "Детали ▼"}
                                      </span>
                                    </div>
                                    
                                    {/* Dynamic Superpower badge */}
                                    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[8px] font-bold uppercase bg-indigo-50 text-indigo-700 border border-indigo-100/50">
                                      <Award className="h-2 w-2" />
                                      {emp.superpower}
                                    </span>
                                  </div>
                                </td>
                                <td className="p-3 text-center text-slate-500">
                                  <span>{emp.totalShifts}</span>
                                  <span className="text-slate-400 font-medium text-[10px]"> ({emp.nightShifts})</span>
                                </td>
                                <td className="p-3 text-right text-slate-900 font-bold">{formatCurrency(emp.avgRevenue)}</td>
                                <td className="p-3 text-right text-emerald-600 font-bold">{formatCurrency(emp.avgBarSales)}</td>
                                <td className="p-3 text-center">
                                  <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold border ${scoreBadgeColor}`}>
                                    {score}%
                                  </span>
                                </td>
                                <td className="p-3 text-center pr-4">
                                  <span className="inline-block bg-slate-50 text-slate-700 border border-slate-200 px-2.5 py-0.5 rounded-full text-[9px] font-bold">
                                    {emp.completedTasksCount || 0}
                                  </span>
                                </td>
                              </tr>
                              
                              {/* Expandable detailed segment */}
                              {isExpanded && (
                                <tr className="bg-slate-50/50 border-b border-slate-200">
                                  <td colSpan={6} className="p-4 space-y-4 text-xs text-slate-600 pl-6 pr-6">
                                    
                                    {/* Calculated averages block */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-1">
                                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">Будние смены</span>
                                        <span className="text-slate-900 font-bold text-sm">{formatCurrency(emp.avgWeekdayRevenue)}</span>
                                        <span className="text-[9px] text-slate-400 block">в среднем за день</span>
                                      </div>

                                      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-1">
                                        <span className="text-[8px] font-bold text-indigo-500 uppercase tracking-widest block">Выходные / Праздники</span>
                                        <span className="text-indigo-600 font-bold text-sm">{formatCurrency(emp.avgWeekendRevenue)}</span>
                                        <span className="text-[9px] text-indigo-500/80 block">
                                          {emp.avgWeekendRevenue > emp.avgWeekdayRevenue ? `+${Math.round(((emp.avgWeekendRevenue - emp.avgWeekdayRevenue) / (emp.avgWeekdayRevenue || 1)) * 100)}% к будням` : "стабильно"}
                                        </span>
                                      </div>

                                      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-1">
                                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">Сухие смены</span>
                                        <span className="text-slate-900 font-bold text-sm">{formatCurrency(emp.avgDryRevenue)}</span>
                                        <span className="text-[9px] text-slate-400 block">в среднем за день</span>
                                      </div>

                                      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-1">
                                        <span className="text-[8px] font-bold text-sky-500 uppercase tracking-widest block">Дождливые смены</span>
                                        <span className="text-sky-600 font-bold text-sm">{formatCurrency(emp.avgRainyRevenue)}</span>
                                        <span className="text-[9px] text-sky-500/80 block">
                                          {emp.avgRainyRevenue > emp.avgDryRevenue ? `+${Math.round(((emp.avgRainyRevenue - emp.avgDryRevenue) / (emp.avgDryRevenue || 1)) * 100)}% к сухим` : "без изменений"}
                                        </span>
                                      </div>
                                    </div>

                                    {/* AI summary and details */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm space-y-1.5 sm:col-span-2">
                                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">ИИ-Анализ эффективности и влияния факторов</span>
                                        <p className="font-bold text-slate-700 text-[11px] leading-relaxed">
                                          {emp.insightText}
                                        </p>
                                      </div>

                                      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm space-y-2.5 flex flex-col justify-center text-slate-600">
                                        <div className="flex justify-between items-center text-[10px]">
                                          <span className="text-slate-400 font-bold">Оценки чек-листов:</span>
                                          <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-slate-50 border border-slate-200">
                                            {emp.evaluationsCount || 0} оценок
                                          </span>
                                        </div>
                                        <div className="flex justify-between items-center text-[10px]">
                                          <span className="text-slate-400 font-bold">KPI выручки смены:</span>
                                          <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${emp.revenueKpiRatio >= 100 ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-slate-50 text-slate-500"}`}>
                                            {emp.revenueKpiRatio}% {emp.revenueKpiRatio >= 100 ? "🔥" : ""}
                                          </span>
                                        </div>
                                        <div className="flex justify-between items-center text-[10px]">
                                          <span className="text-slate-400 font-bold">KPI выручки бара:</span>
                                          <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${emp.barKpiRatio >= 100 ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-slate-50 text-slate-500"}`}>
                                            {emp.barKpiRatio}% {emp.barKpiRatio >= 100 ? "🔥" : ""}
                                          </span>
                                        </div>
                                      </div>
                                    </div>

                                  </td>
                                </tr>
                              )}
                            </>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

              </CardContent>
            </Card>

            {/* Column 3: AI Employee Insights & Staff recommendations block */}
            <div className="space-y-6">
              
              {/* AI Staff Recommendations box */}
              <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden relative">
                <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 text-indigo-500 opacity-5 pointer-events-none">
                  <Zap className="h-24 w-24 fill-current" />
                </div>
                <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                  <CardTitle className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-slate-500" />
                    <span>ИИ-Планировщик смен</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  {aiResult?.employeeInsights?.slice(0, 3).map((emp: any, idx: number) => (
                    <div key={idx} className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 flex gap-2.5 shadow-sm">
                      <div className="h-6.5 w-6.5 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-700 font-bold text-[10px] shrink-0">
                        {emp.employeeName?.charAt(0) || "С"}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-bold text-slate-900">{emp.employeeName}</span>
                          <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 px-2 rounded-full border border-indigo-100">{emp.insightTitle}</span>
                        </div>
                        <p className="text-[10px] font-bold text-slate-500 leading-relaxed pt-1">
                          {emp.insightText}
                        </p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

            </div>

          </div>

          {/* 6. Action recommendations checklist */}
          <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-900">
                <Zap className="h-4 w-4 fill-current text-amber-500 animate-pulse" />
                <span>Тактические рекомендации ИИ</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {aiResult?.recommendations?.map((rec: any, idx: number) => {
                  const isCompleted = completedRecs[idx] === true;
                  const priorityColors: Record<string, string> = {
                    high: "bg-rose-50 text-rose-700 border-rose-100",
                    medium: "bg-amber-50 text-amber-700 border-amber-100",
                    low: "bg-blue-50 text-blue-700 border-blue-100"
                  };
                  return (
                    <div 
                      key={idx}
                      className={`p-4 rounded-xl border flex flex-col justify-between gap-3 transition-all ${isCompleted ? "bg-slate-50 border-slate-200 opacity-50" : "bg-white border-slate-200 hover:border-slate-300 shadow-sm"}`}
                    >
                      <div className="space-y-2">
                        <div className="flex justify-between items-start gap-2">
                          <span className={`text-[8px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${priorityColors[rec.priority] || "bg-slate-100"}`}>
                            {rec.priority === "high" ? "Высокий" : rec.priority === "medium" ? "Средний" : "Низкий"}
                          </span>
                          
                          {/* Checkbox button */}
                          <button
                            onClick={() => toggleRec(idx)}
                            className={`h-5 w-5 rounded-md border flex items-center justify-center transition-all ${isCompleted ? "bg-slate-900 border-slate-900 text-white" : "border-slate-200 hover:border-slate-400 hover:bg-slate-50"}`}
                          >
                            {isCompleted && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                          </button>
                        </div>
                        
                        <h4 className={`text-xs font-bold leading-snug ${isCompleted ? "line-through text-slate-400" : "text-slate-900"}`}>
                          {rec.action}
                        </h4>
                      </div>
                      
                      <p className={`text-[10px] font-bold leading-normal ${isCompleted ? "text-slate-400" : "text-slate-500"}`}>
                        {rec.benefit}
                      </p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
