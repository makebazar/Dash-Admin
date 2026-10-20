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
      <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 space-y-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              Загрузка отчетов Langame
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm mt-1 font-medium">
              Загрузите один или несколько отчетов. Система сопоставит их по номерам телефонов в единый массив.
            </p>
          </div>

          {totalLoadedFiles > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={onClearAll}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors border border-slate-200 shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Сбросить всё</span>
              </button>
              <button
                onClick={onGoToAnalytics}
                className="flex items-center gap-2 px-4 py-2 text-xs font-medium bg-black hover:bg-slate-800 text-white rounded-xl shadow-xs transition-all"
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
              <span className="font-semibold text-xs text-slate-900 block">
                1. Анализ посещаемости клуба/сети
              </span>
              <span className="text-[11px] text-slate-500 mt-1 block">
                Langame: Аналитика → Анализ посещаемости клуба/сети
              </span>
              {summaryFileName && (
                <span className="text-[10px] text-slate-400 mt-0.5 block truncate max-w-[220px] mx-auto font-mono">
                  {summaryFileName}
                </span>
              )}
            </div>
            {summaryRows ? (
              <span className="text-[11px] font-medium bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-200">
                ✓ Загружено ({summaryRows.length.toLocaleString("ru")} строк)
              </span>
            ) : (
              <span className="text-[11px] font-medium bg-slate-100 text-slate-600 px-3 py-1 rounded-full">
                Нажмите для выбора
              </span>
            )}
          </div>

          {/* Слот 2: База гостей (Статистика и балансы гостей) */}
          <div
            onClick={() => guestInputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-2xl p-5 flex flex-col items-center justify-between gap-3 cursor-pointer transition-all min-h-[210px] relative group",
              guestRows
                ? "border-emerald-400 bg-emerald-50/60"
                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
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
              <Users className="w-8 h-8 text-slate-400 group-hover:text-slate-600 transition-colors" />
            )}
            <div className="text-center">
              <span className="font-semibold text-xs text-slate-900 block">
                2. Статистика и балансы гостей
              </span>
              <span className="text-[11px] text-slate-500 mt-1 block">
                Langame: Работа с гостями → Статистика и балансы гостей
              </span>
              {guestFileName && (
                <span className="text-[10px] text-slate-400 mt-0.5 block truncate max-w-[220px] mx-auto font-mono">
                  {guestFileName}
                </span>
              )}
            </div>
            {guestRows ? (
              <span className="text-[11px] font-medium bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-200">
                ✓ Загружено ({guestRows.length.toLocaleString("ru")} строк)
              </span>
            ) : (
              <span className="text-[11px] font-medium bg-slate-100 text-slate-600 px-3 py-1 rounded-full">
                Нажмите для выбора
              </span>
            )}
          </div>

          {/* Слот 3: Лог ручных начислений/списаний */}
          <div
            onClick={() => txInputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-2xl p-5 flex flex-col items-center justify-between gap-3 cursor-pointer transition-all min-h-[210px] relative group",
              txRows
                ? "border-emerald-400 bg-emerald-50/60"
                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
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
              <Wallet className="w-8 h-8 text-slate-400 group-hover:text-slate-600 transition-colors" />
            )}
            <div className="text-center">
              <span className="font-semibold text-xs text-slate-900 block">
                3. Лог ручных начислений/списаний
              </span>
              <span className="text-[11px] text-slate-500 mt-1 block">
                Langame: Работа с гостями → Лог ручных начислений/списаний
              </span>
              {txFileName && (
                <span className="text-[10px] text-slate-400 mt-0.5 block truncate max-w-[220px] mx-auto font-mono">
                  {txFileName}
                </span>
              )}
            </div>
            {txRows ? (
              <span className="text-[11px] font-medium bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-200">
                ✓ Загружено ({txRows.length.toLocaleString("ru")} строк)
              </span>
            ) : (
              <span className="text-[11px] font-medium bg-slate-100 text-slate-600 px-3 py-1 rounded-full">
                Нажмите для выбора
              </span>
            )}
          </div>

          {/* Слот 4: Покупка пакетов */}
          <div
            onClick={() => packageInputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-2xl p-5 flex flex-col items-center justify-between gap-3 cursor-pointer transition-all min-h-[210px] relative group",
              packageRows
                ? "border-emerald-400 bg-emerald-50/60"
                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
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
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            ) : (
              <Gamepad2 className="w-8 h-8 text-slate-400 group-hover:text-slate-600 transition-colors" />
            )}
            <div className="text-center">
              <span className="font-semibold text-xs text-slate-900 block">
                4. Покупка пакетов
              </span>
              <span className="text-[11px] text-slate-500 mt-1 block">
                Langame: Аналитика → Покупка пакетов
              </span>
              {packageFileName && (
                <span className="text-[10px] text-slate-400 mt-0.5 block truncate max-w-[220px] mx-auto font-mono">
                  {packageFileName}
                </span>
              )}
            </div>
            {packageRows ? (
              <span className="text-[11px] font-medium bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-200">
                ✓ Загружено ({packageRows.length.toLocaleString("ru")} строк)
              </span>
            ) : (
              <span className="text-[11px] font-medium bg-slate-100 text-slate-600 px-3 py-1 rounded-full">
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
        txRows={txRows}
        summaryRows={summaryRows}
        packageRows={packageRows}
        activeSnapshot={activeSnapshot}
        onSelectSnapshot={onSelectSnapshot}
      />
    </div>
  );
}
