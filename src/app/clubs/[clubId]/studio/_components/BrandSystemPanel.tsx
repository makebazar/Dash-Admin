"use client";

import { useState } from "react";
import { Sparkles, Upload, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MATERIAL_LABELS, type BrandDesign } from "@/lib/studio-types";
import type { AuditIssue } from "@/lib/studio-brand-rules";

export type BrandBrief = { brandName: string; niche: string; audience: string; vibe: string; colors: string; avoid: string };
export const EMPTY_BRIEF: BrandBrief = { brandName: "", niche: "", audience: "", vibe: "", colors: "", avoid: "" };

const BRIEF_FIELDS: [keyof BrandBrief, string, string][] = [
  ["brandName", "Название клуба", "Например, COLIZEUM"],
  ["niche", "Тип клуба", "Компьютерный клуб, PS5-лаунж, киберарена…"],
  ["audience", "Аудитория", "Школьники 12–17, студенты, корпоративные команды…"],
  ["vibe", "Настроение", "Дерзкое, уютное, премиальное, андерграунд…"],
  ["colors", "Пожелания по цветам (необязательно)", "Тёмный фон и жёлтый акцент"],
  ["avoid", "Чего избегать (необязательно)", "Неоновые градиенты, розовый"],
];

type Props = {
  design: BrandDesign;
  refImages: string[];
  brief: BrandBrief;
  issues: AuditIssue[];
  busy: boolean;
  onBrief: (b: BrandBrief) => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveRef: (i: number) => void;
  onRun: () => void;
};

const List = ({ title, items }: { title: string; items?: string[] }) =>
  items?.length ? (
    <div>
      <div className="text-[10px] font-bold uppercase text-slate-500 mb-0.5">{title}</div>
      <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-slate-700">
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </div>
  ) : null;

export function BrandSystemPanel(p: Props) {
  const [mode, setMode] = useState<"references" | "scratch">(p.refImages.length ? "references" : "scratch");
  const s = p.design.system;
  const canRun = mode === "references" ? p.refImages.length > 0 : Object.values(p.brief).some((v) => v.trim());

  return (
    <div className="space-y-3">
      <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/70 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-700" />
          <h3 className="font-bold text-slate-900 text-xs">Шаг 1. Бренд-система (ИИ-арт-директор)</h3>
        </div>

        <div className="grid grid-cols-2 gap-1 p-0.5 bg-white rounded-lg border border-amber-200">
          {(["references", "scratch"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`h-7 rounded-md text-[11px] font-bold ${mode === m ? "bg-[#FFD92E] text-slate-950" : "text-slate-500"}`}
            >
              {m === "references" ? "По референсам" : "С нуля по брифу"}
            </button>
          ))}
        </div>

        {mode === "references" && (
          <div className="grid grid-cols-3 gap-2">
            {p.refImages.map((img, i) => (
              <div key={i} className="relative rounded-lg border border-amber-300 overflow-hidden aspect-square bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img} alt={`Ref ${i + 1}`} className="w-full h-full object-cover" />
                <button
                  onClick={() => p.onRemoveRef(i)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-rose-600"
                  title="Удалить"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {p.refImages.length < 5 && (
              <label className="border-2 border-dashed border-amber-300 bg-white/70 hover:bg-white rounded-lg aspect-square flex flex-col items-center justify-center cursor-pointer text-center">
                <Upload className="w-4 h-4 text-amber-600 mb-1" />
                <span className="text-[10px] font-bold text-slate-700">+ Референс</span>
                <span className="text-[9px] text-slate-400">до 5 шт</span>
                <input type="file" accept="image/*" multiple onChange={p.onUpload} className="hidden" />
              </label>
            )}
          </div>
        )}

        {/* Бриф полезен в обоих режимах: уточняет то, чего не видно на картинках */}
        <div className="space-y-1.5">
          {mode === "references" && (
            <p className="text-[10px] text-slate-500">Бриф необязателен — он уточнит то, чего не видно на картинках.</p>
          )}
          {BRIEF_FIELDS.filter(([k]) => mode === "scratch" || k !== "niche").map(([k, label, ph]) =>
            k === "vibe" || k === "avoid" ? (
              <div key={k}>
                <label className="text-[10px] text-slate-600 font-medium">{label}</label>
                <Textarea
                  rows={2}
                  value={p.brief[k]}
                  onChange={(e) => p.onBrief({ ...p.brief, [k]: e.target.value })}
                  placeholder={ph}
                  className="text-xs bg-white border-slate-200"
                />
              </div>
            ) : (
              <div key={k}>
                <label className="text-[10px] text-slate-600 font-medium">{label}</label>
                <Input
                  value={p.brief[k]}
                  onChange={(e) => p.onBrief({ ...p.brief, [k]: e.target.value })}
                  placeholder={ph}
                  className="h-8 text-xs bg-white border-slate-200"
                />
              </div>
            )
          )}
        </div>

        <Button
          onClick={p.onRun}
          disabled={p.busy || !canRun}
          className="w-full h-8 bg-[#FFD92E] text-slate-950 font-black text-xs hover:bg-[#ffe156] gap-2"
        >
          {p.busy ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Арт-директор работает…
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" /> {s ? "Пересоздать бренд-систему" : "Создать бренд-систему"}
            </>
          )}
        </Button>
      </div>

      {p.issues.length > 0 && (
        <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-1">
          <div className="text-[10px] font-bold uppercase text-slate-500">Проверка по правилам дизайна</div>
          {p.issues.map((i, k) => (
            <div key={k} className={`text-[11px] ${i.level === "fix" ? "text-emerald-700" : "text-amber-700"}`}>
              {i.level === "fix" ? "✓ Исправлено: " : "⚠ "}
              {i.text}
            </div>
          ))}
        </div>
      )}

      {s && (
        <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-3">
          <div>
            <div className="text-[10px] font-bold uppercase text-slate-500">Позиционирование</div>
            <p className="text-[11px] text-slate-800">{s.positioning}</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {s.personality.map((t) => (
                <span key={t} className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-semibold text-slate-700">
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-700">
            <div>Display / Title: <b>{s.typography.scale.display} / {s.typography.scale.title}px</b></div>
            <div>Body / Caption: <b>{s.typography.scale.body} / {s.typography.scale.caption}px</b></div>
            <div>Сетка: <b>{s.layout.grid} кол.</b></div>
            <div>Поля: <b>{s.layout.safeZone}%</b></div>
            <div>Плотность: <b>{s.layout.density}</b></div>
            <div>Выравнивание: <b>{s.layout.alignment}</b></div>
            {s.typography.limits && (
              <div className="col-span-2 text-[10px] text-slate-500 pt-1">
                Лимиты слов: <b>{s.typography.limits.displayMaxWords} сл.</b> (заголовок), <b>{s.typography.limits.titleMaxWords} сл.</b> (подзаголовок), <b>{s.typography.limits.bodyMaxChars} зн.</b> (тезис)
              </div>
            )}
            {s.imagery?.imagePromptStyle && (
              <div className="col-span-2 text-[10px] text-slate-500 pt-0.5">
                Промпт ИИ-арта: <span className="font-mono text-[9px] text-slate-600 truncate block">{s.imagery.imagePromptStyle}</span>
              </div>
            )}
          </div>

          <List title="Правила стиля" items={s.rules} />
          <List title="Голос: делаем" items={s.voice.dos} />
          <List title="Голос: не делаем" items={s.voice.donts} />

          <div>
            <div className="text-[10px] font-bold uppercase text-slate-500 mb-1">Материалы</div>
            <div className="space-y-1.5">
              {s.materials.map((m) => (
                <details key={m.id} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1">
                  <summary className="text-[11px] font-bold text-slate-800 cursor-pointer">{MATERIAL_LABELS[m.id]}</summary>
                  <div className="mt-1 space-y-0.5 text-[11px] text-slate-600">
                    <div><b>Цель:</b> {m.goal}</div>
                    <div><b>Иерархия:</b> {m.hierarchy.join(" → ")}</div>
                    <div><b>Композиция:</b> {m.layout}</div>
                    <div><b>Акцент:</b> {m.accentUsage}</div>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
