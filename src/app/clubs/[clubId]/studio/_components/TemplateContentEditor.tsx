"use client";

import React, { useState } from "react";
import {
  Plus,
  Trash2,
  Upload,
  Sparkles,
  Wand2,
  RefreshCw,
  X,
  FolderOpen,
  Check,
  Image as ImageIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  BrandDesign,
  DynamicTemplate,
  FieldDef,
  PostData,
  StudioAsset,
} from "@/lib/studio-types";

type Props = {
  template: DynamicTemplate | null;
  data: PostData;
  assets?: StudioAsset[];
  clubId?: string;
  format?: string;
  design?: BrandDesign;
  onChange: (patch: Partial<PostData>) => void;
  onGenerateText?: () => void;
  onAssetSaved?: () => void;
};

export function TemplateContentEditor({
  template,
  data,
  assets = [],
  clubId,
  format = "story",
  design,
  onChange,
  onGenerateText,
  onAssetSaved,
}: Props) {
  // Состояние встроенного ИИ-генератора для конкретного поля
  const [aiActiveField, setAiActiveField] = useState<string | null>(null);
  const [aiFieldMode, setAiFieldMode] = useState<"cutout" | "background">("cutout");
  const [aiFieldPrompt, setAiFieldPrompt] = useState("");
  const [aiFieldWithMascot, setAiFieldWithMascot] = useState(false);
  const [aiFieldHd, setAiFieldHd] = useState(false);
  const [aiFieldLoading, setAiFieldLoading] = useState(false);
  const [aiFieldResult, setAiFieldResult] = useState<string | null>(null);
  const [aiFieldError, setAiFieldError] = useState<string | null>(null);

  // Состояние выбора из медиатеки
  const [libraryActiveField, setLibraryActiveField] = useState<string | null>(null);

  if (!template) {
    return (
      <div className="p-6 text-center text-xs text-slate-400">
        Выберите шаблон во вкладке «Шаблоны» или сгенерируйте новый с нуля.
      </div>
    );
  }

  const handleFieldChange = (key: string, value: any) => {
    onChange({ [key]: value });
  };

  const handleListItemChange = (
    listKey: string,
    index: number,
    itemKey: string,
    value: any
  ) => {
    const currentList: any[] = Array.isArray(data[listKey]) ? [...data[listKey]] : [];
    const item = { ...(currentList[index] || {}) };
    item[itemKey] = value;
    currentList[index] = item;
    onChange({ [listKey]: currentList });
  };

  const handleAddListItem = (field: FieldDef) => {
    const currentList: any[] = Array.isArray(data[field.key]) ? [...data[field.key]] : [];
    const newItem: Record<string, any> = {};
    (field.itemFields || []).forEach((sub) => {
      newItem[sub.key] = sub.default || "";
    });
    onChange({ [field.key]: [...currentList, newItem] });
  };

  const handleRemoveListItem = (listKey: string, index: number) => {
    const currentList: any[] = Array.isArray(data[listKey]) ? [...data[listKey]] : [];
    const updated = currentList.filter((_, i) => i !== index);
    onChange({ [listKey]: updated });
  };

  const handleFileUpload = async (fieldKey: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const json = await res.json();
      if (res.ok && json.url) {
        handleFieldChange(fieldKey, json.url);
      }
    } catch (err) {
      console.error("Failed to upload image", err);
    }
  };

  // Определение типа изображения (персонаж / вырезка ARGB vs фон / сцена)
  const isCutoutField = (field: FieldDef) => {
    const k = field.key.toLowerCase();
    const l = field.label.toLowerCase();
    return (
      k.includes("player") ||
      k.includes("photo") ||
      k.includes("mascot") ||
      k.includes("character") ||
      k.includes("cutout") ||
      l.includes("игрок") ||
      l.includes("фото") ||
      l.includes("маскот") ||
      l.includes("персонаж")
    );
  };

  const isBgField = (field: FieldDef) => {
    const k = field.key.toLowerCase();
    const l = field.label.toLowerCase();
    return k.includes("bg") || k.includes("background") || l.includes("фон");
  };

  // Открытие ИИ генератора для поля с умной инициализацией
  const handleOpenAiGenerator = (field: FieldDef) => {
    if (aiActiveField === field.key) {
      setAiActiveField(null);
      return;
    }
    const cutout = isCutoutField(field);
    setAiActiveField(field.key);
    setAiFieldMode(cutout ? "cutout" : "background");
    setAiFieldResult(null);
    setAiFieldError(null);
    setAiFieldWithMascot(false);

    // Умный дефолтный промт на основе темы постера и поля
    const titleHint = typeof data.title === "string" ? data.title : "";
    if (cutout) {
      if (design?.mascot) {
        setAiFieldPrompt(`Маскот клуба ${design.mascot} в победной позе, крупный план, киберспорт`);
      } else {
        setAiFieldPrompt(
          titleHint
            ? `Киберспортсмен турнира «${titleHint}» в командном черном худи и наушниках перед экраном`
            : "Профессиональный киберспортсмен в худи с наушниками на шее, динамичная поза"
        );
      }
    } else {
      setAiFieldPrompt(
        titleHint
          ? `Турнирная киберарена для «${titleHint}», неоновая подсветка, дым, пустой центр для надписей`
          : "Современный компьютерный клуб, киберпанк интерьер, неоновые акценты, свободный центр"
      );
    }
  };

  // Вызов API генерации Qwen Image 2.1
  const handleRunAiGeneration = async (fieldKey: string) => {
    if (!aiFieldPrompt.trim() || !clubId) return;
    setAiFieldLoading(true);
    setAiFieldError(null);
    setAiFieldResult(null);

    try {
      const res = await fetch(`/api/clubs/${clubId}/studio/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format,
          prompt: aiFieldPrompt.trim(),
          mode: aiFieldMode,
          withMascot: aiFieldWithMascot,
          hd: aiFieldHd,
          targetField: fieldKey,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Ошибка генерации");
      setAiFieldResult(json.image);
    } catch (e: any) {
      setAiFieldError(e?.message || "Не удалось сгенерировать изображение");
    } finally {
      setAiFieldLoading(false);
    }
  };

  // Применение сгенерированного изображения к полю и сохранение в медиатеку
  const handleApplyAiImage = async (fieldKey: string, fieldLabel: string) => {
    if (!aiFieldResult) return;
    handleFieldChange(fieldKey, aiFieldResult);

    // Автоматически сохраняем в медиатеку клуба
    if (clubId) {
      try {
        await fetch(`/api/clubs/${clubId}/studio/assets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: aiFieldMode === "cutout" ? "mascot" : "background",
            name: `${fieldLabel} · ${aiFieldPrompt.slice(0, 30)}`,
            url: aiFieldResult,
          }),
        });
        onAssetSaved?.();
      } catch (err) {
        console.error("Failed to auto-save asset", err);
      }
    }

    setAiActiveField(null);
    setAiFieldResult(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Контент постера
          </h2>
          <p className="text-[11px] text-slate-500 font-medium truncate max-w-[200px]">
            {template.name}
          </p>
        </div>
        {onGenerateText && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onGenerateText}
            className="h-7 text-xs text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 gap-1 px-2 font-bold"
          >
            <Wand2 className="w-3 h-3 text-amber-600" />
            ИИ идеи
          </Button>
        )}
      </div>

      <div className="space-y-3 text-xs">
        {template.fields.map((field) => {
          if (field.type === "text") {
            return (
              <div key={field.key} className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-600 block">
                  {field.label}
                </label>
                <Input
                  value={data[field.key] ?? ""}
                  onChange={(e) => handleFieldChange(field.key, e.target.value)}
                  placeholder={field.label}
                  className="h-8 text-xs bg-white border-slate-200"
                />
              </div>
            );
          }

          if (field.type === "longtext") {
            return (
              <div key={field.key} className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-600 block">
                  {field.label}
                </label>
                <Textarea
                  rows={2}
                  value={data[field.key] ?? ""}
                  onChange={(e) => handleFieldChange(field.key, e.target.value)}
                  placeholder={field.label}
                  className="text-xs bg-white border-slate-200"
                />
              </div>
            );
          }

          if (field.type === "image") {
            const currentImg = data[field.key] || "";
            const isCutout = isCutoutField(field);
            const isBg = isBgField(field);
            const isAiOpen = aiActiveField === field.key;
            const isLibOpen = libraryActiveField === field.key;

            return (
              <div
                key={field.key}
                className="space-y-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50/80 transition-all shadow-sm"
              >
                {/* Шапка поля с бейджем и кнопками ИИ / медиатеки */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[11px] font-bold text-slate-800 truncate">
                      {field.label}
                    </span>
                    {isCutout ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                        ARGB Персонаж
                      </span>
                    ) : isBg ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200 shrink-0">
                        Фон
                      </span>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {/* Кнопка ИИ генератора Qwen 2.1 */}
                    <button
                      type="button"
                      onClick={() => handleOpenAiGenerator(field)}
                      className={cn(
                        "h-6 px-2 rounded-md text-[10px] font-bold flex items-center gap-1 transition-all border",
                        isAiOpen
                          ? "bg-amber-500 text-slate-950 border-amber-600 shadow-sm"
                          : "bg-white hover:bg-amber-50 text-amber-700 border-amber-200 shadow-xs"
                      )}
                    >
                      <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                      ИИ Арт
                    </button>

                    {/* Кнопка выбора из медиатеки клуба */}
                    {assets.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setLibraryActiveField(isLibOpen ? null : field.key)
                        }
                        className={cn(
                          "h-6 px-1.5 rounded-md text-[10px] font-medium flex items-center gap-1 transition-all border",
                          isLibOpen
                            ? "bg-slate-800 text-white border-slate-900"
                            : "bg-white hover:bg-slate-100 text-slate-600 border-slate-200"
                        )}
                        title="Выбрать из медиатеки"
                      >
                        <FolderOpen className="w-3 h-3 text-slate-500" />
                      </button>
                    )}

                    {currentImg && (
                      <button
                        type="button"
                        onClick={() => handleFieldChange(field.key, "")}
                        className="text-[10px] text-rose-600 hover:text-rose-700 px-1 font-semibold"
                        title="Очистить поле"
                      >
                        Сброс
                      </button>
                    )}
                  </div>
                </div>

                {/* Строка с превью, инпутом URL и кнопкой загрузки */}
                <div className="flex items-center gap-2">
                  {currentImg ? (
                    <div
                      className="w-10 h-10 rounded-lg border border-slate-300 overflow-hidden shrink-0 shadow-xs flex items-center justify-center p-0.5"
                      style={{
                        backgroundImage: isCutout
                          ? "repeating-conic-gradient(#cbd5e1 0% 25%, #f1f5f9 0% 50%)"
                          : undefined,
                        backgroundSize: "8px 8px",
                        backgroundColor: isCutout ? undefined : "#0f172a",
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={currentImg}
                        alt=""
                        className={`w-full h-full ${
                          isCutout ? "object-contain" : "object-cover"
                        }`}
                      />
                    </div>
                  ) : null}

                  <Input
                    value={currentImg}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    placeholder="URL картинки или генерация..."
                    className="h-8 text-xs bg-white border-slate-200 flex-1 font-mono text-[11px]"
                  />

                  <label
                    className="h-8 px-2.5 rounded-md bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center cursor-pointer shrink-0 transition-colors shadow-xs"
                    title="Загрузить файл с устройства"
                  >
                    <Upload className="w-3.5 h-3.5 text-slate-600" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(field.key, e)}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Выпадающая панель медиатеки */}
                {isLibOpen && (
                  <div className="p-2.5 rounded-lg bg-white border border-slate-200 shadow-sm space-y-2 mt-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                      <span>Медиатека клуба ({assets.length})</span>
                      <button
                        type="button"
                        onClick={() => setLibraryActiveField(null)}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5 max-h-36 overflow-y-auto p-1 bg-slate-50 rounded border border-slate-100">
                      {assets.map((asset) => (
                        <button
                          key={asset.id}
                          type="button"
                          onClick={() => {
                            handleFieldChange(field.key, asset.url);
                            setLibraryActiveField(null);
                          }}
                          className="group relative aspect-square rounded border border-slate-200 bg-white overflow-hidden hover:border-amber-400 hover:ring-2 hover:ring-amber-200 transition-all p-0.5"
                          title={asset.name}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={asset.url}
                            alt={asset.name}
                            className="w-full h-full object-cover rounded"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Встроенная карточка ИИ генерации (Qwen Image 2.1) */}
                {isAiOpen && (
                  <div className="mt-2 p-3 rounded-xl bg-slate-950 text-slate-100 border border-slate-800 shadow-md space-y-2.5 animate-in fade-in-50 duration-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-[11px] font-black uppercase tracking-wider text-amber-300">
                          Qwen Image 2.1 · ИИ Арт
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAiActiveField(null)}
                        className="text-slate-400 hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Переключатель режимов: Персонаж ARGB (без фона) vs Фон */}
                    <div className="grid grid-cols-2 gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-[11px] font-bold">
                      <button
                        type="button"
                        onClick={() => setAiFieldMode("cutout")}
                        className={cn(
                          "py-1 px-1.5 rounded text-center transition-all",
                          aiFieldMode === "cutout"
                            ? "bg-[#FFD92E] text-slate-950 shadow-xs"
                            : "text-slate-400 hover:text-white"
                        )}
                      >
                        Персонаж (ARGB без фона)
                      </button>
                      <button
                        type="button"
                        onClick={() => setAiFieldMode("background")}
                        className={cn(
                          "py-1 px-1.5 rounded text-center transition-all",
                          aiFieldMode === "background"
                            ? "bg-[#FFD92E] text-slate-950 shadow-xs"
                            : "text-slate-400 hover:text-white"
                        )}
                      >
                        Фон (свободный центр)
                      </button>
                    </div>

                    {/* Быстрые подсказки-чипы */}
                    <div className="flex flex-wrap gap-1">
                      {(aiFieldMode === "cutout"
                        ? [
                            "Киберспортсмен в худи с наушниками",
                            "Капитан команды с кубком",
                            "Снайпер CS2 в экипировке",
                            design?.mascot ? `Маскот: ${design.mascot}` : "Маскот клуба в боевой стойке",
                          ]
                        : [
                            "Киберарена с неоном",
                            "Темный лаундж, пустой центр",
                            "Турнирная сцена в дыму",
                            "Графит и карбон",
                          ]
                      ).map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => setAiFieldPrompt(chip)}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                        >
                          {chip}
                        </button>
                      ))}
                    </div>

                    {/* Поле ввода описания */}
                    <div>
                      <Textarea
                        rows={2}
                        value={aiFieldPrompt}
                        onChange={(e) => setAiFieldPrompt(e.target.value)}
                        placeholder={
                          aiFieldMode === "cutout"
                            ? "Опишите персонажа без фона (Qwen 2.1 создаст чистый ARGB слой)..."
                            : "Опишите фон (центр останется пустым под надписи)..."
                        }
                        className="text-xs bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500 focus-visible:ring-amber-400"
                      />
                    </div>

                    {/* Опции: Маскот и 2K */}
                    <div className="flex items-center gap-4 text-[11px] text-slate-300">
                      {design?.mascot && (
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={aiFieldWithMascot}
                            onChange={(e) => setAiFieldWithMascot(e.target.checked)}
                            className="rounded border-slate-700 text-amber-500 focus:ring-amber-400 bg-slate-900"
                          />
                          <span>Маскот клуба</span>
                        </label>
                      )}
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={aiFieldHd}
                          onChange={(e) => setAiFieldHd(e.target.checked)}
                          className="rounded border-slate-700 text-amber-500 focus:ring-amber-400 bg-slate-900"
                        />
                        <span>2K HD</span>
                      </label>
                    </div>

                    {/* Сообщение об ошибке */}
                    {aiFieldError && (
                      <div className="text-[11px] text-rose-400 bg-rose-950/50 p-2 rounded border border-rose-900">
                        {aiFieldError}
                      </div>
                    )}

                    {/* Кнопка вызова генерации */}
                    <Button
                      type="button"
                      onClick={() => handleRunAiGeneration(field.key)}
                      disabled={aiFieldLoading || !aiFieldPrompt.trim()}
                      className="w-full h-8 bg-[#FFD92E] text-slate-950 hover:bg-[#ffe156] font-black text-xs gap-1.5 shadow"
                    >
                      {aiFieldLoading ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Qwen 2.1 генерирует...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Сгенерировать</span>
                        </>
                      )}
                    </Button>

                    {/* Превью результата генерации с проверкой прозрачности ARGB */}
                    {aiFieldResult && (
                      <div className="space-y-2 pt-2 border-t border-slate-800">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                          <span>Результат:</span>
                          {aiFieldMode === "cutout" && (
                            <span className="text-emerald-400 font-bold">
                              ✓ ARGB чистая альфа
                            </span>
                          )}
                        </div>
                        <div
                          className="rounded-lg border border-slate-700 overflow-hidden max-h-44 flex items-center justify-center p-2 relative bg-slate-900"
                          style={{
                            backgroundImage:
                              aiFieldMode === "cutout"
                                ? "repeating-conic-gradient(#334155 0% 25%, #1e293b 0% 50%)"
                                : undefined,
                            backgroundSize: "16px 16px",
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={aiFieldResult}
                            alt="Generated"
                            className="max-h-40 object-contain"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleApplyAiImage(field.key, field.label)}
                            className="h-7 text-xs bg-[#FFD92E] text-slate-950 font-black hover:bg-[#ffe156] gap-1"
                          >
                            <Check className="w-3 h-3" />
                            Вставить в поле
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              handleApplyAiImage(field.key, field.label);
                            }}
                            className="h-7 text-xs border-slate-700 hover:bg-slate-800 text-slate-200 bg-slate-900 font-medium"
                          >
                            В пост и базу
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          }

          if (field.type === "list") {
            const listItems: any[] = Array.isArray(data[field.key]) ? data[field.key] : [];
            const subfields = field.itemFields || [];

            return (
              <div key={field.key} className="space-y-2 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    {field.label} ({listItems.length})
                  </label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAddListItem(field)}
                    className="h-6 text-[10px] px-2 gap-1 bg-white border-slate-300 hover:border-amber-400 font-bold"
                  >
                    <Plus className="w-3 h-3" /> Добавить
                  </Button>
                </div>

                <div className="space-y-2">
                  {listItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 space-y-1.5 relative group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400">
                          #{idx + 1}
                        </span>
                        <button
                          onClick={() => handleRemoveListItem(field.key, idx)}
                          className="text-slate-400 hover:text-rose-600 p-0.5"
                          title="Удалить карточку"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        {subfields.map((sub) => (
                          <div key={sub.key} className="space-y-0.5">
                            <span className="text-[10px] text-slate-500 font-medium">
                              {sub.label}
                            </span>
                            <Input
                              value={item[sub.key] ?? ""}
                              onChange={(e) =>
                                handleListItemChange(field.key, idx, sub.key, e.target.value)
                              }
                              placeholder={sub.label}
                              className="h-7 text-xs bg-white border-slate-200"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}
