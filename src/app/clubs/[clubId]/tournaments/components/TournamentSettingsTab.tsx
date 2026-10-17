"use client";

import React, { useState, useEffect, useMemo } from "react";
import { X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TournamentDiscipline, formatTypeLabel } from "../types";

interface TournamentSettingsTabProps {
  clubId: string;
}

const COMMON_FORMATS = [
  { id: "1vs1", label: "1 vs 1" },
  { id: "2vs2", label: "2 vs 2" },
  { id: "3vs3", label: "3 vs 3" },
  { id: "5vs5", label: "5 vs 5" },
  { id: "mix_2vs2", label: "Mix 2 vs 2" },
  { id: "mix_5vs5", label: "Mix 5 vs 5" },
];

export function TournamentSettingsTab({ clubId }: TournamentSettingsTabProps) {
  const [disciplines, setDisciplines] = useState<TournamentDiscipline[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "system" | "custom">("all");

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingDiscipline, setEditingDiscipline] = useState<TournamentDiscipline | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formKey, setFormKey] = useState("");
  const [formBadge, setFormBadge] = useState("Ручной ввод");
  const [formFormats, setFormFormats] = useState<string[]>(["1vs1", "2vs2"]);
  const [formDescription, setFormDescription] = useState("");
  const [customFormatInput, setCustomFormatInput] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchDisciplines = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/clubs/${clubId}/tournaments?action=disciplines`);
      if (res.ok) {
        const data = await res.json();
        setDisciplines(data.disciplines || []);
      }
    } catch (e) {
      console.error("Failed to load disciplines:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDisciplines();
  }, [clubId]);

  const handleOpenCreate = () => {
    setEditingDiscipline(null);
    setFormName("");
    setFormKey("");
    setFormBadge("Ручной ввод");
    setFormFormats(["1vs1", "2vs2"]);
    setFormDescription("");
    setCustomFormatInput("");
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (d: TournamentDiscipline) => {
    setEditingDiscipline(d);
    setFormName(d.name || "");
    setFormKey(d.key || "");
    setFormBadge(d.badge || "Ручной ввод");
    setFormFormats(
      Array.isArray(d.formats) && d.formats.length > 0 ? d.formats : ["1vs1", "2vs2"]
    );
    setFormDescription(d.description || "");
    setCustomFormatInput("");
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleToggleFormat = (fmtId: string) => {
    setFormFormats((prev) =>
      prev.includes(fmtId) ? prev.filter((f) => f !== fmtId) : [...prev, fmtId]
    );
  };

  const handleAddCustomFormat = () => {
    const trimmed = customFormatInput.trim().toLowerCase().replace(/\s+/g, "_");
    if (!trimmed) return;
    if (!formFormats.includes(trimmed)) {
      setFormFormats([...formFormats, trimmed]);
    }
    setCustomFormatInput("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setErrorMessage("Введите название дисциплины");
      return;
    }
    if (!editingDiscipline && !formKey.trim()) {
      setErrorMessage("Укажите уникальный код дисциплины");
      return;
    }
    if (formFormats.length === 0) {
      setErrorMessage("Выберите хотя бы один формат участия");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/clubs/${clubId}/tournaments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_discipline",
          id: editingDiscipline?.id,
          key: formKey.trim().toLowerCase(),
          name: formName.trim(),
          badge: formBadge.trim(),
          formats: formFormats,
          description: formDescription.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || "Ошибка сохранения дисциплины");
        return;
      }

      setIsModalOpen(false);
      await fetchDisciplines();
    } catch (err: any) {
      console.error(err);
      setErrorMessage("Ошибка сети при сохранении");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (d: TournamentDiscipline) => {
    if (d.is_system || d.key === "cs2" || d.key === "dota2") {
      alert("Системную дисциплину (CS2 или Dota 2) удалить нельзя.");
      return;
    }

    if (
      !confirm(
        `Вы уверены, что хотите удалить дисциплину "${d.name}"? Это действие необратимо.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/clubs/${clubId}/tournaments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_discipline",
          id: d.id,
        }),
      });

      if (res.ok) {
        await fetchDisciplines();
      } else {
        const data = await res.json();
        alert(data.error || "Не удалось удалить дисциплину");
      }
    } catch (err) {
      console.error(err);
      alert("Ошибка сети при удалении дисциплины");
    }
  };

  // Filtered disciplines
  const filteredDisciplines = useMemo(() => {
    return disciplines.filter((d) => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        d.name.toLowerCase().includes(q) ||
        d.key.toLowerCase().includes(q) ||
        (d.description && d.description.toLowerCase().includes(q));

      const isSys = Boolean(d.is_system || d.key === "cs2" || d.key === "dota2");
      if (filterType === "system" && !isSys) return false;
      if (filterType === "custom" && isSys) return false;

      return matchQuery;
    });
  }, [disciplines, searchQuery, filterType]);

  const systemCount = disciplines.filter(
    (d) => d.is_system || d.key === "cs2" || d.key === "dota2"
  ).length;
  const customCount = disciplines.length - systemCount;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Banner & Actions */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 uppercase">
            Настройки дисциплин
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-2xl font-medium">
            Управляйте киберспортивными дисциплинами клуба. Системные дисциплины (CS2 и Dota 2)
            интегрированы с игровыми серверами, а для кастомных можно задавать свои форматы и правила.
          </p>
        </div>

        <Button
          onClick={handleOpenCreate}
          className="h-11 sm:h-12 rounded-2xl px-5 bg-slate-900 text-white hover:bg-slate-800 font-bold transition-all shadow-sm shrink-0 cursor-pointer"
        >
          Создать дисциплину
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
            Всего дисциплин
          </span>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">
            {disciplines.length}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">
            Доступно при создании турниров
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 block">
            Системные дисциплины
          </span>
          <div className="text-2xl sm:text-3xl font-black text-blue-700 mt-2">
            {systemCount}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">
            CS2 и Dota 2 (автосерверы и API)
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 block">
            Пользовательские
          </span>
          <div className="text-2xl sm:text-3xl font-black text-emerald-700 mt-2">
            {customCount}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">
            Консольные, мобильные и другие игры
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Поиск по названию или коду дисциплины..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all font-medium"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 self-start sm:self-auto overflow-x-auto">
          {(
            [
              { id: "all", label: "Все" },
              { id: "system", label: "Системные" },
              { id: "custom", label: "Пользовательские" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap",
                filterType === tab.id
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Disciplines Grid */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Загрузка дисциплин...
          </span>
        </div>
      ) : filteredDisciplines.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-12 text-center space-y-3">
          <h4 className="text-base font-bold text-slate-800">Дисциплины не найдены</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {searchQuery
              ? "По вашему поисковому запросу ничего не найдено."
              : "Список дисциплин пуст. Создайте новую дисциплину для проведения турниров."}
          </p>
          {searchQuery && (
            <Button
              variant="outline"
              onClick={() => setSearchQuery("")}
              className="rounded-xl text-xs h-9"
            >
              Сбросить поиск
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredDisciplines.map((d) => {
            const isSys = Boolean(d.is_system || d.key === "cs2" || d.key === "dota2");
            return (
              <div
                key={d.id}
                className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col justify-between transition-all hover:border-slate-300 relative"
              >
                <div className="space-y-4">
                  {/* Top Bar of Card */}
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-black text-slate-900 tracking-tight">
                        {d.name}
                      </h3>
                      <span className="text-slate-400 font-mono text-xs font-semibold">
                        {d.key}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium line-clamp-2 mt-1">
                      {d.description || "Описание не указано"}
                    </p>
                  </div>

                  {/* Formats Tags */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Доступные форматы
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {Array.isArray(d.formats) && d.formats.length > 0 ? (
                        d.formats.map((fmt) => (
                          <span
                            key={fmt}
                            className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] font-bold text-slate-700 uppercase"
                          >
                            {formatTypeLabel(fmt)}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400">Форматы не заданы</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="pt-5 mt-5 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-slate-400 font-medium">
                    {isSys ? "Системная дисциплина" : "Пользовательская дисциплина"}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEdit(d)}
                      className="h-8 rounded-xl px-3 border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
                    >
                      Редактировать
                    </Button>

                    {!isSys ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(d)}
                        className="h-8 rounded-xl px-3 border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold cursor-pointer"
                      >
                        Удалить
                      </Button>
                    ) : (
                      <span
                        title="Системную дисциплину нельзя удалить"
                        className="h-8 px-2.5 flex items-center text-[10px] font-bold text-slate-400 cursor-not-allowed select-none"
                      >
                        Неудаляемая
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT DISCIPLINE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-xs animate-in fade-in-0">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-slate-900 animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex justify-between items-start pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight uppercase">
                  {editingDiscipline
                    ? editingDiscipline.is_system || editingDiscipline.key === "cs2" || editingDiscipline.key === "dota2"
                      ? `Редактирование: ${editingDiscipline.name}`
                      : "Редактировать дисциплину"
                    : "Новая дисциплина"}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  {editingDiscipline?.is_system || editingDiscipline?.key === "cs2" || editingDiscipline?.key === "dota2"
                    ? "Настройка параметров системной дисциплины"
                    : "Добавление дисциплины для создания турниров в клубе"}
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Error Banner */}
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-700">
                {errorMessage}
              </div>
            )}

            {/* System Discipline Notice */}
            {editingDiscipline &&
              (editingDiscipline.is_system ||
                editingDiscipline.key === "cs2" ||
                editingDiscipline.key === "dota2") && (
                <div className="p-3.5 bg-blue-50 border border-blue-200/80 rounded-2xl text-xs text-blue-800 space-y-0.5">
                  <span className="font-bold block">Системная дисциплина</span>
                  <span className="text-[11px] text-blue-700 font-medium block">
                    Код дисциплины фиксирован для взаимодействия с серверами DashMatch и Steam API.
                    Вы можете отредактировать название, поддерживаемые форматы и описание.
                  </span>
                </div>
              )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-700">
                  Название дисциплины *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Например: Mortal Kombat 1, Valorant..."
                  className="w-full bg-slate-50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-900 font-bold placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all"
                />
              </div>

              {/* Key */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-700">
                  Идентификатор (код) *
                </label>
                <input
                  type="text"
                  required
                  disabled={
                    Boolean(
                      editingDiscipline &&
                        (editingDiscipline.is_system ||
                          editingDiscipline.key === "cs2" ||
                          editingDiscipline.key === "dota2")
                    )
                  }
                  value={formKey}
                  onChange={(e) => setFormKey(e.target.value)}
                  placeholder="valorant, mk1, apex..."
                  className={cn(
                    "w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-mono font-bold transition-all",
                    editingDiscipline &&
                      (editingDiscipline.is_system ||
                        editingDiscipline.key === "cs2" ||
                        editingDiscipline.key === "dota2")
                      ? "text-slate-400 cursor-not-allowed bg-slate-100"
                      : "text-slate-900 hover:bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                  )}
                />
                <span className="text-[10px] text-slate-400 block font-medium">
                  Только латинские буквы в нижнем регистре, цифры и дефис.
                </span>
              </div>

              {/* Badge */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-700">
                  Бейдж / Тип проведения
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {["Ручной ввод", "Автосервер", "Консоли / LAN", "Мобильные"].map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setFormBadge(b)}
                      className={cn(
                        "py-2.5 px-3 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer",
                        formBadge === b
                          ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100/70"
                      )}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              {/* Formats Selection */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 block">
                  Поддерживаемые форматы матчей *
                </label>
                <div className="flex flex-wrap gap-2">
                  {COMMON_FORMATS.map((f) => {
                    const isSelected = formFormats.includes(f.id);
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => handleToggleFormat(f.id)}
                        className={cn(
                          "px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer",
                          isSelected
                            ? "bg-orange-500 text-white border-orange-500 shadow-xs"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        )}
                      >
                        <span>{f.label}</span>
                      </button>
                    );
                  })}
                  {/* Any custom formats already added */}
                  {formFormats
                    .filter((f) => !COMMON_FORMATS.some((cf) => cf.id === f))
                    .map((cf) => (
                      <button
                        key={cf}
                        type="button"
                        onClick={() => handleToggleFormat(cf)}
                        className="px-3 py-2 rounded-xl border border-orange-500 bg-orange-500 text-white text-xs font-bold cursor-pointer"
                      >
                        <span>{cf}</span>
                      </button>
                    ))}
                </div>

                {/* Add Custom Format inline */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Добавить другой формат (например: 4vs4)..."
                    value={customFormatInput}
                    onChange={(e) => setCustomFormatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddCustomFormat();
                      }
                    }}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddCustomFormat}
                    className="h-8 rounded-xl px-3 text-xs font-bold"
                  >
                    Добавить
                  </Button>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-700">
                  Описание дисциплины
                </label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Краткое описание игры, платформ или особенностей проведения..."
                  className="w-full bg-slate-50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-2xl px-4 py-2.5 text-xs text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="rounded-xl px-4 h-10 text-xs font-bold"
                >
                  Отмена
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl px-5 h-10 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Сохранение...</span>
                    </>
                  ) : (
                    <span>{editingDiscipline ? "Сохранить изменения" : "Создать"}</span>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
