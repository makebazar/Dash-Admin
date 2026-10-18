"use client";

import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Sparkles, Clock, Wallet, Users, Trash2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { isSummaryReportFile, isTransactionFile, isPackagesFile } from "./segmentation";
import { Gamepad2 } from "lucide-react";

import { SnapshotsManager } from "./SnapshotsManager";
import type { SnapshotFull } from "./types";
import type { ClubAnalytics } from "./segmentation";

interface Props {
  clubId: string;
  analytics: ClubAnalytics | null;
  activeSnapshot: SnapshotFull | null;
  onSelectSnapshot: (snap: SnapshotFull) => void;

  guestRows: Record<string, unknown>[] | null;
  guestFileName: string | null;
  setGuestData: (rows: Record<string, unknown>[] | null, name: string | null) => void;

  txRows: Record<string, unknown>[] | null;
  txFileName: string | null;
  setTxData: (rows: Record<string, unknown>[] | null, name: string | null) => void;

  summaryRows: Record<string, unknown>[] | null;
  summaryFileName: string | null;
  setSummaryData: (rows: Record<string, unknown>[] | null, name: string | null) => void;

  packageRows: Record<string, unknown>[] | null;
  packageFileName: string | null;
  setPackageData: (rows: Record<string, unknown>[] | null, name: string | null) => void;

  onGoToAnalytics: () => void;
  onClearAll: () => void;
}

// Robust CSV parser supporting quotes, escaped double quotes (""), and auto-detected delimiter (; or ,)
function parseCSVRobust(text: string): Record<string, unknown>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  // Detect delimiter from first non-empty line
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

function parseXLSX(buffer: ArrayBuffer): Record<string, unknown>[] {
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

async function readFileRows(file: File): Promise<Record<string, unknown>[]> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "csv") {
    const text = await file.text();
    return parseCSVRobust(text);
  } else if (ext === "xlsx" || ext === "xls") {
    const buf = await file.arrayBuffer();
    return parseXLSX(buf);
  }
  throw new Error("Неподдерживаемый формат: " + file.name);
}

export function UploadTab({
  clubId,
  analytics,
  activeSnapshot,
  onSelectSnapshot,
  guestRows,
  guestFileName,
  setGuestData,
  txRows,
  txFileName,
  setTxData,
  summaryRows,
  summaryFileName,
  setSummaryData,
  packageRows,
  packageFileName,
  setPackageData,
  onGoToAnalytics,
  onClearAll,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guestInputRef = useRef<HTMLInputElement>(null);
  const txInputRef = useRef<HTMLInputElement>(null);
  const summaryInputRef = useRef<HTMLInputElement>(null);
  const packageInputRef = useRef<HTMLInputElement>(null);

  const totalLoadedFiles = [guestRows, txRows, summaryRows, packageRows].filter(Boolean).length;

  const processFiles = async (files: FileList | File[]) => {
    setError(null);
    setLoading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const rows = await readFileRows(file);

        if (isSummaryReportFile(rows)) {
          setSummaryData(rows, file.name);
        } else if (isPackagesFile(rows)) {
          setPackageData(rows, file.name);
        } else if (isTransactionFile(rows)) {
          setTxData(rows, file.name);
        } else {
          setGuestData(rows, file.name);
        }
      }
    } catch (e: any) {
      setError(e?.message || "Ошибка при чтении файлов");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 space-y-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black uppercase italic tracking-tight text-slate-800">
              Загрузка отчетов Langame
            </h2>
            <p className="text-slate-500 text-sm mt-1">
              Загрузите один или несколько отчетов. Система сопоставит их по номерам телефонов в единый массив.
            </p>
          </div>

          {totalLoadedFiles > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={onClearAll}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-slate-200"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Сбросить всё</span>
              </button>
              <button
                onClick={onGoToAnalytics}
                className="flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-wider bg-violet-600 text-white rounded-xl shadow-md hover:bg-violet-700 transition-all"
              >
                <span>Смотреть аналитику ({totalLoadedFiles}/4)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Слот 1: Сводный операционный отчет (3-я таблица) */}
          <div
            onClick={() => summaryInputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-2xl p-5 flex flex-col items-center justify-between gap-3 cursor-pointer transition-all min-h-[210px] relative group",
              summaryRows
                ? "border-violet-400 bg-violet-50/60"
                : "border-slate-200 hover:border-violet-300 hover:bg-violet-50/30"
            )}
          >
            <input
              ref={summaryInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) processFiles(e.target.files);
              }}
            />
            {summaryRows ? (
              <CheckCircle2 className="w-8 h-8 text-violet-600" />
            ) : (
              <Clock className="w-8 h-8 text-slate-400 group-hover:text-violet-500 transition-colors" />
            )}
            <div className="text-center">
              <span className="font-bold text-xs uppercase tracking-wider text-slate-800 block">
                1. Сводка по гостям (Операционный)
              </span>
              <span className="text-[11px] text-slate-500 mt-1 block">
                {summaryFileName
                  ? `${summaryFileName} (${summaryRows?.length.toLocaleString("ru")} строк)`
                  : "Часы в ПК, визиты, ЛК, моб. приложение, бар"}
              </span>
            </div>
            {summaryRows ? (
              <span className="text-[10px] font-bold uppercase bg-violet-100 text-violet-700 px-3 py-1 rounded-full border border-violet-200">
                ✓ Загружено ({summaryRows.length.toLocaleString("ru")} строк)
              </span>
            ) : (
              <span className="text-[10px] font-bold uppercase bg-slate-100 text-slate-600 px-3 py-1 rounded-full">
                Нажмите для выбора
              </span>
            )}
          </div>

          {/* Слот 2: База гостей (1-я таблица) */}
          <div
            onClick={() => guestInputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-2xl p-5 flex flex-col items-center justify-between gap-3 cursor-pointer transition-all min-h-[210px] relative group",
              guestRows
                ? "border-emerald-400 bg-emerald-50/60"
                : "border-slate-200 hover:border-violet-300 hover:bg-violet-50/30"
            )}
          >
            <input
              ref={guestInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) processFiles(e.target.files);
              }}
            />
            {guestRows ? (
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            ) : (
              <Users className="w-8 h-8 text-slate-400 group-hover:text-emerald-500 transition-colors" />
            )}
            <div className="text-center">
              <span className="font-bold text-xs uppercase tracking-wider text-slate-800 block">
                2. Статистика и балансы гостей
              </span>
              <span className="text-[11px] text-slate-500 mt-1 block">
                {guestFileName
                  ? `${guestFileName} (${guestRows?.length.toLocaleString("ru")} строк)`
                  : "Реальные остатки на счетах, бонусы, возраст, пол"}
              </span>
            </div>
            {guestRows ? (
              <span className="text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full border border-emerald-200">
                ✓ Загружено ({guestRows.length.toLocaleString("ru")} строк)
              </span>
            ) : (
              <span className="text-[10px] font-bold uppercase bg-slate-100 text-slate-600 px-3 py-1 rounded-full">
                Нажмите для выбора
              </span>
            )}
          </div>

          {/* Слот 3: Лог кассы (2-я таблица) */}
          <div
            onClick={() => txInputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-2xl p-5 flex flex-col items-center justify-between gap-3 cursor-pointer transition-all min-h-[210px] relative group",
              txRows
                ? "border-emerald-400 bg-emerald-50/60"
                : "border-slate-200 hover:border-violet-300 hover:bg-violet-50/30"
            )}
          >
            <input
              ref={txInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) processFiles(e.target.files);
              }}
            />
            {txRows ? (
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            ) : (
              <Wallet className="w-8 h-8 text-slate-400 group-hover:text-emerald-500 transition-colors" />
            )}
            <div className="text-center">
              <span className="font-bold text-xs uppercase tracking-wider text-slate-800 block">
                3. Лог начислений / списаний
              </span>
              <span className="text-[11px] text-slate-500 mt-1 block">
                {txFileName
                  ? `${txFileName} (${txRows?.length.toLocaleString("ru")} операций)`
                  : "История чеков кассы администраторов"}
              </span>
            </div>
            {txRows ? (
              <span className="text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full border border-emerald-200">
                ✓ Загружено ({txRows.length.toLocaleString("ru")} строк)
              </span>
            ) : (
              <span className="text-[10px] font-bold uppercase bg-slate-100 text-slate-600 px-3 py-1 rounded-full">
                Нажмите для выбора
              </span>
            )}
          </div>

          {/* Слот 4: Покупка пакетов и тарифов (4-я таблица) */}
          <div
            onClick={() => packageInputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-2xl p-5 flex flex-col items-center justify-between gap-3 cursor-pointer transition-all min-h-[210px] relative group",
              packageRows
                ? "border-amber-400 bg-amber-50/60"
                : "border-slate-200 hover:border-violet-300 hover:bg-violet-50/30"
            )}
          >
            <input
              ref={packageInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) processFiles(e.target.files);
              }}
            />
            {packageRows ? (
              <CheckCircle2 className="w-8 h-8 text-amber-600" />
            ) : (
              <Gamepad2 className="w-8 h-8 text-slate-400 group-hover:text-amber-500 transition-colors" />
            )}
            <div className="text-center">
              <span className="font-bold text-xs uppercase tracking-wider text-slate-800 block">
                4. Покупка пакетов и тарифов
              </span>
              <span className="text-[11px] text-slate-500 mt-1 block">
                {packageFileName
                  ? `${packageFileName} (${packageRows?.length.toLocaleString("ru")} строк)`
                  : "Тарифы, ПК, зоны клуба, списания (руб / бонусы)"}
              </span>
            </div>
            {packageRows ? (
              <span className="text-[10px] font-bold uppercase bg-amber-100 text-amber-700 px-3 py-1 rounded-full border border-amber-200">
                ✓ Загружено ({packageRows.length.toLocaleString("ru")} строк)
              </span>
            ) : (
              <span className="text-[10px] font-bold uppercase bg-slate-100 text-slate-600 px-3 py-1 rounded-full">
                Нажмите для выбора
              </span>
            )}
          </div>
        </div>

        {/* Drag & drop area */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files?.length) processFiles(e.dataTransfer.files);
          }}
          className="border border-slate-200 bg-slate-50/70 rounded-2xl p-5 text-center text-xs text-slate-600 font-medium space-y-1"
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2 text-violet-600 font-bold py-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Обработка файлов и объединение в единый массив…</span>
            </div>
          ) : (
            <div>
              <p className="font-bold text-slate-700">💡 Можно выделить и перетащить сразу все 4 файла сюда</p>
              <p className="text-[11px] text-slate-400">Парсер сам поймет структуру каждого отчета, сопоставит ПК с зонами клуба и исключит бонусы из выручки.</p>
            </div>
          )}
        </div>
      </div>

      {/* Snapshots History & Management */}
      <SnapshotsManager
        clubId={clubId}
        analytics={analytics}
        fileNames={[guestFileName, txFileName, summaryFileName, packageFileName]}
        summaryRows={summaryRows}
        packageRows={packageRows}
        activeSnapshot={activeSnapshot}
        onSelectSnapshot={onSelectSnapshot}
      />
    </div>
  );
}
