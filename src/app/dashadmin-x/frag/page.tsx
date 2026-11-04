"use client";

import { useEffect, useState, useRef } from "react";
import {
  Crosshair,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  FileCode,
  ExternalLink,
  Copy,
  Check,
  RotateCcw,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Release {
  id: string;
  appName: string;
  version: string;
  downloadUrl: string;
  fileSizeBytes: number | null;
  originalFilename: string;
  checksumSha256: string | null;
  changelog: string | null;
  isActive: boolean;
  createdAt: string;
}

export default function DashFragAdminPage() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [version, setVersion] = useState("");
  const [changelog, setChangelog] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchReleases = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/dashadmin-x/releases");
      const data = await res.json();
      if (res.ok) {
        setReleases(data.releases || []);
      }
    } catch (err) {
      console.error("Failed to load releases:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReleases();
  }, []);

  const activeRelease = releases.find((r) => r.isActive);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setFormError(null);

      // Guess version if filename has e.g. "dashfrag-1.0.4.exe"
      const match = file.name.match(/v?(\d+\.\d+(\.\d+)?)/i);
      if (match && !version) {
        setVersion(match[1]);
      }
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setFormError("Выберите бинарный файл (.exe или .zip)");
      return;
    }
    if (!version.trim()) {
      setFormError("Укажите версию приложения");
      return;
    }

    try {
      setUploading(true);
      setFormError(null);
      setFormSuccess(null);

      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("version", version.trim());
      formData.append("changelog", changelog.trim());
      formData.append("isActive", isActive ? "true" : "false");

      const res = await fetch("/api/dashadmin-x/releases", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Ошибка загрузки");
      }

      setFormSuccess(`Релиз DashFrag v${version} успешно загружен и опубликован!`);
      setSelectedFile(null);
      setVersion("");
      setChangelog("");
      if (fileInputRef.current) fileInputRef.current.value = "";

      await fetchReleases();
    } catch (err: any) {
      setFormError(err.message || "Не удалось загрузить бинарник");
    } finally {
      setUploading(false);
    }
  };

  const handleSetActive = async (id: string) => {
    try {
      setActionLoadingId(id);
      const res = await fetch(`/api/dashadmin-x/releases/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
      if (res.ok) {
        await fetchReleases();
      }
    } catch (err) {
      console.error("Failed to set active release:", err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (id: string, ver: string) => {
    if (!confirm(`Вы действительно хотите удалить релиз v${ver}?`)) return;

    try {
      setActionLoadingId(id);
      const res = await fetch(`/api/dashadmin-x/releases/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchReleases();
      }
    } catch (err) {
      console.error("Failed to delete release:", err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const formatBytes = (bytes: number | null) => {
    if (!bytes) return "—";
    const mb = bytes / (1024 * 1024);
    if (mb < 1) {
      return `${(bytes / 1024).toFixed(1)} КБ`;
    }
    return `${mb.toFixed(1)} МБ`;
  };

  const copyPublicLink = () => {
    const url = `${window.location.origin}/api/promo/frag/download`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Crosshair className="w-6 h-6 text-red-500" />
            Управление DashFrag
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Загрузка и управление бинарными сборками десктопного агента трекинга матчей
          </p>
        </div>

        <button
          onClick={copyPublicLink}
          className="inline-flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 transition"
        >
          {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          {copiedLink ? "Ссылка скопирована" : "Копировать ссылку на скачивание"}
        </button>
      </div>

      {/* Current Active Release Banner */}
      <Card className="p-6 bg-slate-900 border-slate-800 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                АКТИВНЫЙ РЕЛИЗ
              </span>
              <span className="text-xs text-slate-400">Отдаётся на странице /promo/frag</span>
            </div>

            {activeRelease ? (
              <div>
                <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                  DashFrag v{activeRelease.version}
                  <span className="text-sm font-normal text-slate-400">
                    ({formatBytes(activeRelease.fileSizeBytes)})
                  </span>
                </h2>
                <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span>Файл: <code className="text-slate-300">{activeRelease.originalFilename}</code></span>
                  <span>Опубликован: {new Date(activeRelease.createdAt).toLocaleString("ru-RU")}</span>
                </div>
                {activeRelease.changelog && (
                  <p className="text-xs text-slate-300 mt-2 bg-slate-800/60 p-2.5 rounded-lg border border-slate-800">
                    {activeRelease.changelog}
                  </p>
                )}
              </div>
            ) : (
              <div>
                <h2 className="text-xl font-bold text-amber-400">Активный релиз пока не назначен</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Загрузите бинарник ниже, чтобы игроки могли скачивать DashFrag
                </p>
              </div>
            )}
          </div>

          {activeRelease && (
            <div className="flex items-center gap-3">
              <a
                href={activeRelease.downloadUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-sm transition shadow-lg shadow-red-900/30"
              >
                <Download className="w-4 h-4" />
                Тест скачивания
              </a>
            </div>
          )}
        </div>
      </Card>

      {/* Grid: Upload New Release & History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Form (1 col) */}
        <Card className="p-6 bg-slate-900 border-slate-800 text-white lg:col-span-1 h-fit">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Upload className="w-5 h-5 text-red-400" />
            Загрузить новый бинарник
          </h2>

          <form onSubmit={handleUpload} className="space-y-4">
            {formError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-400 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formSuccess}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Файл бинарника (.exe, .zip, .msi) *
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".exe,.zip,.msi,.tar.gz"
                onChange={handleFileChange}
                disabled={uploading}
                className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer"
              />
              {selectedFile && (
                <p className="text-[11px] text-slate-400 mt-1">
                  Выбран: {selectedFile.name} ({formatBytes(selectedFile.size)})
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Номер версии (например, 1.0.4) *
              </label>
              <input
                type="text"
                placeholder="1.0.0"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                disabled={uploading}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Что нового в версии (Changelog)
              </label>
              <textarea
                placeholder="Исправлена синхронизация с CS2, ускорена отправка статистики..."
                rows={3}
                value={changelog}
                onChange={(e) => setChangelog(e.target.value)}
                disabled={uploading}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 resize-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                disabled={uploading}
                className="rounded border-slate-700 bg-slate-800 text-red-600 focus:ring-red-500"
              />
              <label htmlFor="isActive" className="text-xs text-slate-300 cursor-pointer select-none">
                Сделать активной для скачивания сразу
              </label>
            </div>

            <button
              type="submit"
              disabled={uploading || !selectedFile}
              className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold rounded-lg text-sm transition flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Загрузка в S3...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Опубликовать релиз
                </>
              )}
            </button>
          </form>
        </Card>

        {/* Releases History (2 cols) */}
        <Card className="p-6 bg-slate-900 border-slate-800 text-white lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <FileCode className="w-5 h-5 text-slate-400" />
              История версий ({releases.length})
            </h2>
            <button
              onClick={fetchReleases}
              disabled={loading}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition"
            >
              <RotateCcw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
              Обновить
            </button>
          </div>

          {loading ? (
            <div className="py-12 flex items-center justify-center text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : releases.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              Бинарники ещё не загружались
            </div>
          ) : (
            <div className="space-y-3">
              {releases.map((rel) => (
                <div
                  key={rel.id}
                  className={cn(
                    "p-4 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-4",
                    rel.isActive
                      ? "bg-slate-800/80 border-emerald-500/40"
                      : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                  )}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-base">v{rel.version}</span>
                      {rel.isActive ? (
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          Активен
                        </span>
                      ) : (
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                          Архив
                        </span>
                      )}
                      <span className="text-xs text-slate-400">• {formatBytes(rel.fileSizeBytes)}</span>
                    </div>

                    <div className="text-xs text-slate-400">
                      <span>{rel.originalFilename}</span> •{" "}
                      <span>{new Date(rel.createdAt).toLocaleString("ru-RU")}</span>
                    </div>

                    {rel.changelog && (
                      <p className="text-xs text-slate-300 pt-1 line-clamp-2">
                        {rel.changelog}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {!rel.isActive && (
                      <button
                        onClick={() => handleSetActive(rel.id)}
                        disabled={actionLoadingId === rel.id}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg font-medium transition"
                        title="Сделать этот релиз активным для скачивания"
                      >
                        {actionLoadingId === rel.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          "Сделать активным"
                        )}
                      </button>
                    )}

                    <a
                      href={rel.downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
                      title="Скачать бинарник"
                    >
                      <Download className="w-4 h-4" />
                    </a>

                    <button
                      onClick={() => handleDelete(rel.id, rel.version)}
                      disabled={actionLoadingId === rel.id}
                      className="p-2 bg-slate-800 hover:bg-red-950/60 hover:text-red-400 text-slate-400 rounded-lg transition"
                      title="Удалить запись"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
