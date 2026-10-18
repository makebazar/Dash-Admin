"use client";

import { Download, Users, Phone, Mail, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
export interface SegmentGuest {
  name: string;
  phone: string;
  email: string;
  balance: number;
}

export interface Segment {
  key: string;
  label: string;
  description: string;
  color: string;
  badge?: string;
  guests: SegmentGuest[];
}

export interface GuestSegments {
  total: number;
  withPhone: number;
  withEmail: number;
  undated: number;
  segments: Segment[];
}

export function exportSegmentAsCSV(seg: Segment) {
  if (typeof window === "undefined") return;
  const phones = seg.guests.map((g) => g.phone).filter((p) => p.length >= 10);
  const csv = "Phone\n" + phones.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${seg.key}.csv`;
  a.click();
}

interface Props {
  segments: GuestSegments | null;
}

const COLOR_MAP: Record<string, string> = {
  red:     "bg-red-500",
  amber:   "bg-amber-500",
  orange:  "bg-orange-500",
  violet:  "bg-violet-500",
  rose:    "bg-rose-500",
  slate:   "bg-slate-400",
  emerald: "bg-emerald-500",
};

const BADGE_MAP: Record<string, string> = {
  red:     "bg-red-50 text-red-600 border-red-100",
  amber:   "bg-amber-50 text-amber-600 border-amber-100",
  orange:  "bg-orange-50 text-orange-600 border-orange-100",
  violet:  "bg-violet-50 text-violet-600 border-violet-100",
  rose:    "bg-rose-50 text-rose-600 border-rose-100",
  slate:   "bg-slate-50 text-slate-500 border-slate-200",
  emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
};

function SegmentCard({ segment }: { segment: Segment }) {
  const phonesCount = segment.guests.filter((g) => g.phone.length >= 10).length;
  const pct = segment.guests.length > 0 ? Math.round((phonesCount / segment.guests.length) * 100) : 0;
  const totalBalance = segment.guests.reduce((s, g) => s + g.balance, 0);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", COLOR_MAP[segment.color] ?? "bg-slate-400")} />
          <h3 className="font-black uppercase tracking-wider text-sm text-slate-800">
            {segment.label}
          </h3>
        </div>
        <span className={cn("text-xs font-bold border px-2.5 py-0.5 rounded-full", BADGE_MAP[segment.color] ?? BADGE_MAP.slate)}>
          {segment.guests.length.toLocaleString("ru")} чел
        </span>
      </div>

      {/* Description */}
      <p className="text-slate-500 text-xs leading-relaxed">{segment.description}</p>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-slate-600">
          <Phone className="w-3 h-3 text-slate-400" />
          <span><b>{phonesCount.toLocaleString("ru")}</b> телефонов ({pct}%)</span>
        </div>
        {totalBalance > 0 && (
          <div className="flex items-center gap-1.5 text-slate-600">
            <span className="w-3 h-3 text-slate-400 text-center font-bold">₽</span>
            <span>Суммарно <b>{Math.round(totalBalance).toLocaleString("ru")} ₽</b></span>
          </div>
        )}
      </div>

      {/* VK export button */}
      <button
        onClick={() => exportSegmentAsCSV(segment)}
        disabled={phonesCount === 0}
        className={cn(
          "w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
          phonesCount > 0
            ? "bg-slate-900 text-white hover:bg-slate-700 active:scale-95"
            : "bg-slate-100 text-slate-400 cursor-not-allowed",
        )}
      >
        <Download className="w-3.5 h-3.5" />
        Скачать для VK ({phonesCount.toLocaleString("ru")} тел.)
      </button>
    </div>
  );
}

function RubleIcon({ className }: { className?: string }) {
  return <span className={cn("font-black text-red-500", className)}>₽</span>;
}

export function SegmentsTab({ segments }: Props) {
  if (!segments) {
    return (
      <div className="px-4 flex flex-col items-center justify-center py-24 gap-4 text-slate-400">
        <AlertCircle className="w-10 h-10" />
        <p className="font-bold uppercase tracking-widest text-xs">
          Сначала загрузите файл на вкладке «Загрузка базы»
        </p>
      </div>
    );
  }

  const totalBalance = segments.segments
    .find((s) => s.key === "churned_with_money")
    ?.guests.reduce((sum, g) => sum + g.balance, 0) ?? 0;

  return (
    <div className="px-4 space-y-6">
      {/* Summary bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Всего в базе", value: segments.total.toLocaleString("ru"), icon: Users, color: "text-slate-700" },
          { label: "С телефоном", value: segments.withPhone.toLocaleString("ru"), icon: Phone, color: "text-violet-600" },
          { label: "С email", value: segments.withEmail.toLocaleString("ru"), icon: Mail, color: "text-blue-600" },
          {
            label: "Денег у ушедших",
            value: `${Math.round(totalBalance).toLocaleString("ru")} ₽`,
            icon: RubleIcon,
            color: "text-red-600",
          },
        ].map((stat) => (
          <div key={stat.label} className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <stat.icon className={cn("w-3.5 h-3.5", stat.color)} />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{stat.label}</span>
            </div>
            <p className={cn("text-2xl font-black tracking-tight", stat.color)}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Instructions */}
      <div className="bg-violet-50 border border-violet-100 rounded-2xl p-4 text-xs text-violet-700 leading-relaxed">
        <b className="uppercase tracking-wider">Как загрузить в VK Рекламу:</b>
        {" "}Скачайте нужный сегмент → откройте{" "}
        <a href="https://ads.vk.com" target="_blank" className="underline font-bold">ads.vk.com</a>
        {" "}→ Аудитории → «Загрузить список» → выберите CSV → готово.
        VK автоматически сопоставит телефоны с профилями. Минимум 100 контактов для запуска, рекомендуется 500+.
      </div>

      {/* Segment cards */}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {segments.segments.map((seg) => (
          <SegmentCard key={seg.key} segment={seg} />
        ))}
      </div>

      {segments.undated > 0 && (
        <p className="text-xs text-slate-400 text-center">
          {segments.undated.toLocaleString("ru")} записей без даты не попали в сегменты
        </p>
      )}
    </div>
  );
}
