"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, Save, Plus, Trash2, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

interface EquipmentType {
  code: string;
  name_ru: string;
  icon: string;
}

interface Instruction {
  id: string;
  equipment_type_code: string;
  instructions: string;
  performance_instructions?: string;
  default_interval_days?: number;
}

interface PerformanceMetric {
  id?: string;
  name: string;
  unit: string;
  equipment_type_code: string;
  is_active: boolean;
  sort_order: number;
}

export function InstructionsTab() {
  const { clubId } = useParams();
  const [equipmentTypes, setEquipmentTypes] = useState<EquipmentType[]>([]);
  const [instructions, setInstructions] = useState<Record<string, Instruction>>(
    {},
  );
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [selectedType, setSelectedType] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [content, setContent] = useState("");
  const [perfContent, setPerfContent] = useState("");
  const [interval, setInterval] = useState<number>(30);
  const [localMetrics, setLocalMetrics] = useState<PerformanceMetric[]>([]);

  useEffect(() => {
    fetchData();
  }, [clubId]);

  useEffect(() => {
    if (selectedType) {
      const savedInstr = instructions[selectedType];
      setContent(savedInstr?.instructions || "");
      setPerfContent(savedInstr?.performance_instructions || "");
      setInterval(savedInstr?.default_interval_days || 30);

      const typeMetrics = (Array.isArray(metrics) ? metrics : []).filter(
        (m) => m.equipment_type_code === selectedType,
      );
      setLocalMetrics(typeMetrics);
    }
  }, [selectedType, instructions, metrics]);

  const selectedInstruction = useMemo(
    () => (selectedType ? instructions[selectedType] : undefined),
    [instructions, selectedType],
  );

  const savedContent = selectedInstruction?.instructions || "";
  const savedPerfContent = selectedInstruction?.performance_instructions || "";
  const savedInterval = selectedInstruction?.default_interval_days || 30;

  const savedMetrics = useMemo(
    () =>
      (Array.isArray(metrics) ? metrics : []).filter(
        (m) => m.equipment_type_code === selectedType,
      ),
    [metrics, selectedType],
  );
  const hasMetricsChanged =
    JSON.stringify(localMetrics) !== JSON.stringify(savedMetrics);

  const hasUnsavedChanges =
    content !== savedContent ||
    perfContent !== savedPerfContent ||
    interval !== savedInterval ||
    hasMetricsChanged;
  const selectedTypeMeta = (
    Array.isArray(equipmentTypes) ? equipmentTypes : []
  ).find((type) => type.code === selectedType);

  const handleSelectType = (typeCode: string) => {
    if (typeCode === selectedType) return;
    if (
      hasUnsavedChanges &&
      !confirm("У вас есть несохраненные изменения. Продолжить?")
    ) {
      return;
    }
    setSelectedType(typeCode);
  };

  const fetchData = async () => {
    try {
      const [typesRes, instrRes, metricsRes] = await Promise.all([
        fetch(`/api/equipment-types?clubId=${clubId}`),
        fetch(`/api/clubs/${clubId}/equipment-instructions`),
        fetch(`/api/clubs/${clubId}/equipment/performance/metrics`),
      ]);

      const types = typesRes.ok ? await typesRes.json() : [];
      const instrs = instrRes.ok ? await instrRes.json() : [];
      const metricsData = metricsRes.ok ? await metricsRes.json() : [];

      setEquipmentTypes(Array.isArray(types) ? types : []);
      setMetrics(Array.isArray(metricsData) ? metricsData : []);

      const instrMap: Record<string, Instruction> = {};
      if (Array.isArray(instrs)) {
        instrs.forEach((i: Instruction) => {
          instrMap[i.equipment_type_code] = i;
        });
      }
      setInstructions(instrMap);

      if (Array.isArray(types) && types.length > 0 && !selectedType) {
        setSelectedType(types[0].code);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddMetric = () => {
    setLocalMetrics((prev) => [
      ...prev,
      {
        name: "",
        unit: "",
        equipment_type_code: selectedType,
        is_active: true,
        sort_order: prev.length,
      },
    ]);
  };

  const handleRemoveMetric = (index: number) => {
    setLocalMetrics((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMetricChange = (
    index: number,
    field: keyof PerformanceMetric,
    value: any,
  ) => {
    setLocalMetrics((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleSave = async () => {
    if (!selectedType) return;

    setIsSaving(true);
    try {
      const [instrRes, metricsRes] = await Promise.all([
        fetch(`/api/clubs/${clubId}/equipment-instructions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            equipment_type_code: selectedType,
            instructions: content,
            performance_instructions: perfContent,
            default_interval_days: interval,
          }),
        }),
        fetch(`/api/clubs/${clubId}/equipment/performance/metrics`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            metrics: localMetrics,
          }),
        }),
      ]);

      if (instrRes.ok && metricsRes.ok) {
        const updatedInstr = await instrRes.json();
        const updatedMetrics = await metricsRes.json();

        setInstructions((prev) => ({
          ...prev,
          [selectedType]: updatedInstr,
        }));

        // Refresh all metrics to get updated IDs and order
        const freshMetricsRes = await fetch(
          `/api/clubs/${clubId}/equipment/performance/metrics`,
        );
        const freshMetrics = freshMetricsRes.ok
          ? await freshMetricsRes.json()
          : [];
        setMetrics(Array.isArray(freshMetrics) ? freshMetrics : []);

        alert("Настройки сохранены");
      } else {
        alert("Ошибка при сохранении");
      }
    } catch (error) {
      console.error("Error saving instructions:", error);
      alert("Ошибка при сохранении");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4 md:space-y-6">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-8 border-b border-slate-100 pb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Настройки обслуживания
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Интервал, инструкции и метрики производительности.
              </p>
            </div>
            <Button
              onClick={handleSave}
              disabled={isSaving || !hasUnsavedChanges}
              className={cn(
                "hidden md:inline-flex rounded-xl h-11 px-6 font-medium",
                hasUnsavedChanges
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-slate-900 text-white hover:bg-slate-800",
              )}
            >
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {hasUnsavedChanges ? "Сохранить изменения" : "Сохранено"}
            </Button>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(320px,1fr)_180px] lg:items-end mb-8">
            <div className="space-y-2">
              <Label htmlFor="equipment-type" className="text-sm font-medium">
                Тип оборудования
              </Label>
              <Select value={selectedType} onValueChange={handleSelectType}>
                <SelectTrigger
                  id="equipment-type"
                  className="h-11 rounded-xl bg-white px-4 text-base"
                >
                  <SelectValue placeholder="Выберите тип оборудования" />
                </SelectTrigger>
                <SelectContent>
                  {equipmentTypes.map((type) => (
                    <SelectItem key={type.code} value={type.code}>
                      {type.name_ru}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="default-interval" className="text-sm font-medium">
                Интервал чистки
              </Label>
              <div className="flex h-11 w-fit items-center overflow-hidden rounded-xl border bg-white">
                <Input
                  id="default-interval"
                  type="number"
                  min="1"
                  max="365"
                  value={interval}
                  onChange={(e) =>
                    setInterval(parseInt(e.target.value, 10) || 30)
                  }
                  className="h-full w-20 border-0 bg-transparent px-3 text-center text-lg font-semibold tabular-nums shadow-none focus-visible:ring-0"
                />
                <div className="flex h-full items-center border-l bg-slate-50 px-3 text-sm text-muted-foreground">
                  дней
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            {/* Общая инструкция */}
            <div className="space-y-3">
              <div>
                <div className="text-lg font-semibold text-slate-950">
                  Общая инструкция для персонала
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Пошаговый регламент чистки и критерии проверки для{" "}
                  {selectedTypeMeta?.name_ru || "выбранного типа"}.
                </div>
              </div>

              <RichTextEditor
                value={content}
                onChange={setContent}
                placeholder="Опиши порядок действий, критерии проверки, фото-примеры и важные замечания для сотрудников."
                className="min-h-50"
              />
            </div>

            <Separator className="bg-slate-100" />

            {/* Инструкция по производительности */}
            <div className="space-y-3">
              <div>
                <div className="text-lg font-semibold text-slate-950">
                  Проверка производительности
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Инструкция по проведению стресс-тестов или замеру FPS для{" "}
                  {selectedTypeMeta?.name_ru || "выбранного типа"}.
                </div>
              </div>

              <RichTextEditor
                value={perfContent}
                onChange={setPerfContent}
                placeholder="Например: Запустите FurMark на 5 минут, зафиксируйте пиковую температуру. Или: Запустите бенчмарк в CS2 на настройках High..."
                className="min-h-50"
              />
            </div>

            {/* Метрики производительности */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-base font-semibold text-slate-950">
                    Поля для замеров (метрики)
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Добавьте параметры, которые сотрудник должен зафиксировать.
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddMetric}
                  className="rounded-lg h-9 border-slate-200 text-slate-600"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Добавить поле
                </Button>
              </div>

              <div className="space-y-2">
                {localMetrics.length === 0 ? (
                  <div className="text-center py-6 border-2 border-dashed border-slate-100 rounded-2xl text-slate-400 text-sm">
                    Нет настроенных полей. Добавьте первое поле (например,
                    Температура CPU).
                  </div>
                ) : (
                  localMetrics.map((metric, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100"
                    >
                      <div className="cursor-grab text-slate-300">
                        <GripVertical className="h-4 w-4" />
                      </div>
                      <div className="grid grid-cols-2 gap-3 flex-1">
                        <Input
                          placeholder="Название (напр. Temp CPU)"
                          value={metric.name}
                          onChange={(e) =>
                            handleMetricChange(index, "name", e.target.value)
                          }
                          className="h-9 rounded-lg bg-white"
                        />
                        <Input
                          placeholder="Ед. изм (напр. °C, fps)"
                          value={metric.unit}
                          onChange={(e) =>
                            handleMetricChange(index, "unit", e.target.value)
                          }
                          className="h-9 rounded-lg bg-white"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveMetric(index)}
                        className="h-9 w-9 text-slate-400 hover:text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2 px-1 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>
                Настройки сохраняются отдельно для каждого типа оборудования.
              </span>
              {hasUnsavedChanges && (
                <span className="font-medium text-amber-600">
                  Есть несохранённые изменения
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="sticky bottom-4 z-20 md:hidden">
        <div className="rounded-2xl border bg-white/95 p-3 shadow-lg backdrop-blur">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-900">
                {selectedTypeMeta?.name_ru}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Настройки обслуживания
              </div>
            </div>
            {hasUnsavedChanges && (
              <span className="shrink-0 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700">
                Не сохранено
              </span>
            )}
          </div>
          <Button
            onClick={handleSave}
            disabled={isSaving || !hasUnsavedChanges}
            className={cn(
              "h-11 w-full rounded-xl",
              hasUnsavedChanges && "bg-green-600 hover:bg-green-700",
            )}
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {hasUnsavedChanges ? "Сохранить изменения" : "Сохранено"}
          </Button>
        </div>
      </div>
    </>
  );
}
